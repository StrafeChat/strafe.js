import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../src/client/Client.js';
import type { ClientOptions } from '../../src/client/Client.js';
import { Events } from '../../src/client/ClientEvents.js';
import { ErrorCodes } from '../../src/errors/ErrorCodes.js';
import { StrafeError } from '../../src/errors/StrafeError.js';
import { Status } from '../../src/gateway/WebSocketManager.js';
import { RoomType } from '../../src/types/api/room.js';
import { BOT_ID, OWNER_ID, PM_ID, SECRET_ID, SPACE_ID, TEXT_ID, THREAD_ID, apiSpace, message, role, selfUser, spaceRoom } from '../helpers.js';
import { dispatch, flush, loggedIn, nthSocket, offline, readyPayload } from './helpers.js';

const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.destroy();
  vi.unstubAllEnvs();
});

function track<T extends { client: Client }>(value: T): T {
  clients.push(value.client);
  return value;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'invalid bot token' }), { status: 401, headers: { 'content-type': 'application/json' } });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rejection(promise: Promise<unknown>): Promise<StrafeError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(StrafeError);
    return error as StrafeError;
  }
  throw new Error('expected a rejection');
}

describe('login', () => {
  it('checks the token over REST, connects with the Bot header and resolves at READY', async () => {
    const seen: string[] = [];
    const { client, socket, api } = track(
      await loggedIn({}, readyPayload(), (c) => {
        c.on(Events.ClientReady, (ready) => seen.push(`clientReady:${ready.user.id}`));
        c.on('ready', () => seen.push('ready'));
        c.on(Events.GatewayReady, () => seen.push('gatewayReady'));
      }),
    );
    expect(socket.url).toBe('wss://chat.example/gateway/events');
    expect(socket.init.headers.Authorization).toBe('Bot test-token');
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual(expect.arrayContaining(['GET /users/@me', 'GET /']));
    expect(seen).toEqual(['gatewayReady', `clientReady:${BOT_ID}`, 'ready']);
    expect(client.isReady()).toBe(true);
    expect(client.readyAt).toBeInstanceOf(Date);
    expect(client.uptime).toBeGreaterThanOrEqual(0);
    expect(client.ws.status).toBe(Status.Ready);
    expect(client.token).toBe('test-token');
    expect(client.federationDomain).toBe('chat.example');
    expect(client.user.presence?.status).toBe('online');
  });

  it('fills the caches from READY and merges its light copies of space rooms', async () => {
    const { client } = track(await loggedIn());
    const space = client.spaces.cache.get(SPACE_ID);
    expect(space?.rooms.cache.size).toBe(6);
    expect(space?.roles.cache.size).toBe(3);
    expect(client.rooms.cache.size).toBe(7);
    const text = client.rooms.cache.get(TEXT_ID);
    expect(text?.isTextRoom() && text.lastMessageId).toBe('99');
    expect(text?.isTextRoom() && text.topic).toBe('hello');
    expect(client.rooms.cache.get(PM_ID)?.isPM()).toBe(true);
    expect(space?.voiceStates.cache.get(OWNER_ID)?.roomId).toBeTruthy();
  });

  it('reads STRAFE_TOKEN and strips a Bot prefix', async () => {
    vi.stubEnv('STRAFE_TOKEN', 'Bot env-token');
    const { client, gateway } = track(offline());
    const login = client.login();
    const socket = await nthSocket(gateway, 1);
    expect(socket.init.headers.Authorization).toBe('Bot env-token');
    socket.open();
    socket.receive({ op: 4, d: readyPayload() });
    await expect(login).resolves.toBe('env-token');
  });

  it('rejects with TokenMissing without a token', async () => {
    vi.stubEnv('STRAFE_TOKEN', '');
    const { client, gateway } = track(offline());
    expect((await rejection(client.login())).code).toBe(ErrorCodes.TokenMissing);
    expect(gateway.sockets).toHaveLength(0);
  });

  it('rejects with TokenInvalid when the API refuses the token, without connecting', async () => {
    const { client, gateway, api } = track(offline());
    api.on('GET /users/@me', unauthorized);
    expect((await rejection(client.login('nope'))).code).toBe(ErrorCodes.TokenInvalid);
    expect(gateway.sockets).toHaveLength(0);
    expect(client.token).toBeNull();
  });

  it('rejects with TokenInvalid when the handshake is refused (checked over REST)', async () => {
    const { client, gateway, api } = track(offline());
    const login = client.login('test-token');
    const socket = await nthSocket(gateway, 1);
    api.on('GET /users/@me', unauthorized);
    socket.fail();
    expect((await rejection(login)).code).toBe(ErrorCodes.TokenInvalid);
    expect(client.ws.status).toBe(Status.Disconnected);
    await sleep(20);
    expect(gateway.sockets).toHaveLength(1);
  });

  it('handles a failed handshake that never fires close (Node 22) without waiting for READY', async () => {
    const { client, gateway, api } = track(offline({ ws: { readyTimeout: 60_000 } }));
    const login = client.login('test-token');
    const socket = await nthSocket(gateway, 1);
    api.on('GET /users/@me', unauthorized);
    socket.failWithoutClose();
    expect((await rejection(login)).code).toBe(ErrorCodes.TokenInvalid);
    expect(client.ws.status).toBe(Status.Disconnected);
  });

  it('reconnects after failed handshakes that never fire close (Node 22)', async () => {
    const { client, gateway } = track(offline({ ws: { loginAttempts: 2, readyTimeout: 60_000 } }));
    const login = client.login('test-token');
    (await nthSocket(gateway, 1)).failWithoutClose();
    (await nthSocket(gateway, 2)).failWithoutClose();
    expect((await rejection(login)).code).toBe(ErrorCodes.GatewayUnreachable);
  });

  it('drops a socket stuck connecting on READY timeout without re-entering its error handler (Node 22)', async () => {
    const { client, gateway } = track(offline({ ws: { readyTimeout: 30, loginAttempts: 2 } }));
    const login = client.login('test-token');
    const first = await nthSocket(gateway, 1);
    first.node22 = true;
    const second = await nthSocket(gateway, 2);
    second.open();
    second.receive({ op: 4, d: readyPayload() });
    await login;
    expect(client.isReady()).toBe(true);
    expect(gateway.sockets).toHaveLength(2);
  });

  it('gives up with GatewayUnreachable after ws.loginAttempts failed connections', async () => {
    const { client, gateway } = track(offline({ ws: { loginAttempts: 2 } }));
    const login = client.login('test-token');
    (await nthSocket(gateway, 1)).fail();
    (await nthSocket(gateway, 2)).fail();
    expect((await rejection(login)).code).toBe(ErrorCodes.GatewayUnreachable);
  });

  it('retries when READY does not arrive in time', async () => {
    const { client, gateway } = track(offline({ ws: { readyTimeout: 60 } }));
    const login = client.login('test-token');
    const first = await nthSocket(gateway, 1);
    first.open();
    const second = await nthSocket(gateway, 2);
    expect(first.closedWith?.code).toBe(4000);
    second.open();
    second.receive({ op: 4, d: readyPayload() });
    await expect(login).resolves.toBe('test-token');
  });

  it('refuses a second login while connected', async () => {
    const { client } = track(await loggedIn());
    expect((await rejection(client.login('again'))).code).toBe(ErrorCodes.WSConnectionExists);
  });

  it('warns once per discord.js option that does not exist on Strafe', async () => {
    const warnings: string[] = [];
    track(
      await loggedIn({ intents: [1, 2], partials: [] } as ClientOptions, readyPayload(), (c) => {
        c.on(Events.Warn, (warning) => warnings.push(warning));
      }),
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/intents/);
    expect(warnings[1]).toMatch(/partials/);
  });

  it('applies options.presence after the first READY', async () => {
    const { client, gateway, api } = track(offline({ presence: { status: 'idle', activities: [{ name: 'Factory Builder' }] } }));
    api.on('PATCH /users/@me', { ...selfUser, presence: { status: 'idle' } });
    const login = client.login('test-token');
    const socket = await nthSocket(gateway, 1);
    socket.open();
    socket.receive({ op: 4, d: readyPayload() });
    await login;
    expect(socket.sent).toContainEqual({ op: 9, d: { activities: [{ type: 'playing', name: 'Factory Builder' }] } });
    await vi.waitFor(() => {
      expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ presence: { status: 'idle' } });
    });
  });
});

describe('connection', () => {
  it('measures latency with op 6 and detects a dead connection', async () => {
    const { client, gateway, socket } = track(await loggedIn({ ws: { pingInterval: 25 } }));
    expect(socket.sent).toContainEqual({ op: 6 });
    expect(client.ws.ping).toBe(-1);
    socket.receive({ op: 7 });
    expect(client.ws.ping).toBeGreaterThanOrEqual(0);
    expect(client.ws.lastPingTimestamp).not.toBeNull();
    const reconnecting = vi.fn();
    client.on(Events.Reconnecting, reconnecting);
    // Leave the next ping unanswered: the one after it finds the connection dead.
    const next = await nthSocket(gateway, 2);
    expect(socket.closedWith?.code).toBe(4009);
    expect(reconnecting).toHaveBeenCalledTimes(1);
    expect(client.ws.status).toBe(Status.Reconnecting);
    next.open();
    next.receive({ op: 4, d: readyPayload() });
    await flush();
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('emits gateway error frames as warnings and keeps the connection', async () => {
    const { client, socket } = track(await loggedIn());
    const warn = vi.fn();
    client.on(Events.Warn, warn);
    socket.receive({ op: 8, d: { code: 4005, message: 'not subscribed to space' } });
    expect(warn).toHaveBeenCalledWith('Gateway error 4005: not subscribed to space');
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('an op 8 frame without d (or a d that is not an object) is a warning, never a throw out of the socket', async () => {
    const { client, socket } = track(await loggedIn());
    const warn = vi.fn();
    const error = vi.fn();
    client.on(Events.Warn, warn);
    client.on(Events.Error, error);
    // A throw out of onmessage escapes the WebSocket's dispatch: Node exits with an uncaught exception.
    expect(() => socket.receive({ op: 8 })).not.toThrow();
    expect(() => socket.receive({ op: 8, d: null })).not.toThrow();
    expect(() => socket.receive({ op: 8, d: 'boom' })).not.toThrow();
    expect(warn.mock.calls).toEqual([['Gateway error unknown: '], ['Gateway error unknown: '], ['Gateway error unknown: ']]);
    expect(error).not.toHaveBeenCalled();
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('a frame that fails to decode goes to the error event instead of escaping the socket', async () => {
    const { client, socket } = track(await loggedIn());
    const error = vi.fn();
    client.on(Events.Error, error);
    const decode = vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(() => {
      throw new TypeError('bad bytes');
    });
    try {
      expect(() => socket.onmessage?.({ data: new Uint8Array([1, 2, 3]).buffer })).not.toThrow();
    } finally {
      decode.mockRestore();
    }
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'bad bytes' }));
    class UnreadableBlob extends Blob {
      public override text(): Promise<string> {
        return Promise.reject(new Error('unreadable'));
      }
    }
    socket.onmessage?.({ data: new UnreadableBlob(['x']) });
    await flush();
    expect(error).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'unreadable' }));
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('emits raw for every frame and decodes binary frames', async () => {
    const { client, socket } = track(await loggedIn());
    const raw = vi.fn();
    const created = vi.fn();
    client.on(Events.Raw, raw);
    client.on(Events.MessageCreate, created);
    const frame = { op: 3, t: 'MESSAGE_CREATE', d: { t: 'MESSAGE_CREATE', room_id: TEXT_ID, space_id: SPACE_ID, d: { ...message('600'), space_id: SPACE_ID } } };
    socket.onmessage?.({ data: new TextEncoder().encode(JSON.stringify(frame)).buffer });
    socket.receive({ op: 7 });
    socket.onmessage?.({ data: 'not json' });
    await flush();
    expect(raw).toHaveBeenCalledTimes(2);
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('sends subscribe and unsubscribe frames, and refuses to send while closed', async () => {
    const { client, socket } = track(await loggedIn());
    client.ws.subscribe(SECRET_ID);
    client.ws.unsubscribe(SECRET_ID);
    expect(socket.sent.slice(-2)).toEqual([
      { op: 1, d: { space_id: SECRET_ID } },
      { op: 5, d: { space_id: SECRET_ID } },
    ]);
    await client.destroy();
    let error: unknown;
    try {
      client.ws.subscribe(SECRET_ID);
    } catch (caught) {
      error = caught;
    }
    expect((error as StrafeError).code).toBe(ErrorCodes.WSNotOpen);
  });

  it('sends the activity over op 9 and again after every reconnect', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    client.user.setActivity('Factory Builder');
    const frame = { op: 9, d: { activities: [{ type: 'playing', name: 'Factory Builder' }] } };
    expect(socket.sent.at(-1)).toEqual(frame);
    socket.serverClose();
    const next = await nthSocket(gateway, 2);
    next.open();
    next.receive({ op: 4, d: readyPayload() });
    await flush();
    expect(next.sent).toContainEqual(frame);
    client.user.setActivity(null);
    expect(next.sent.at(-1)).toEqual({ op: 9, d: { activities: [] } });
  });

  it('turns listener errors into error events without stopping the event loop', async () => {
    const { client, socket } = track(await loggedIn());
    const errors: Error[] = [];
    const seen: string[] = [];
    client.on(Events.Error, (error) => errors.push(error));
    client.on(Events.MessageCreate, (msg) => {
      seen.push(msg.id);
      if (msg.id === '601') throw new Error('boom');
    });
    dispatch(socket, 'MESSAGE_CREATE', message('601'), { room_id: TEXT_ID, space_id: SPACE_ID });
    dispatch(socket, 'MESSAGE_CREATE', message('602'), { room_id: TEXT_ID, space_id: SPACE_ID });
    await flush();
    expect(seen).toEqual(['601', '602']);
    expect(errors.map((error) => error.message)).toEqual(['boom']);
  });
});

describe('reconnect and reconciliation', () => {
  it('re-READYs, emits what changed while offline, and does not emit clientReady again', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    const events: string[] = [];
    for (const name of [Events.ClientReady, Events.GatewayReady, Events.Reconnecting, Events.Reconnected] as const) {
      client.on(name, () => events.push(name));
    }
    client.on(Events.SpaceCreate, (space) => events.push(`spaceCreate:${space.name}`));
    client.on(Events.SpaceDelete, (space) => events.push(`spaceDelete:${space.name}`));
    client.on(Events.RoomCreate, (room) => events.push(`roomCreate:${room.id}`));
    client.on(Events.RoomDelete, (room) => events.push(`roomDelete:${room.id}`));
    client.on(Events.ThreadDelete, (thread) => events.push(`threadDelete:${thread.id}`));

    const { rooms = [], ...space } = apiSpace();
    const NEW_ID = '4000000000000000009';
    const OTHER_ID = '2000000000000000002';
    const OTHER_EVERYONE = '3000000000000000009';
    const next = readyPayload({
      spaces: [space, { ...space, id: OTHER_ID, name: 'Other', everyone_role_id: OTHER_EVERYONE, roles: [role(OTHER_EVERYONE, 0, 0, { name: '@everyone' })] }],
      space_rooms: {
        [SPACE_ID]: [...rooms.filter((room) => room.id !== SECRET_ID && room.id !== THREAD_ID), spaceRoom(NEW_ID, RoomType.SpaceText, { name: 'new' })],
        [OTHER_ID]: [spaceRoom('4000000000000000010', RoomType.SpaceText, { space_id: OTHER_ID })],
      },
      rooms: [],
    });

    socket.serverClose(1006);
    expect(client.ws.status).toBe(Status.Reconnecting);
    const second = await nthSocket(gateway, 2);
    expect(second.init.headers.Authorization).toBe('Bot test-token');
    second.open();
    second.receive({ op: 4, d: next });
    await flush();

    expect(events).toEqual([
      'reconnecting',
      'spaceCreate:Other',
      `roomCreate:${NEW_ID}`,
      `roomDelete:${SECRET_ID}`,
      `threadDelete:${THREAD_ID}`,
      `roomDelete:${PM_ID}`,
      'gatewayReady',
      'reconnected',
    ]);
    expect(client.rooms.cache.has(SECRET_ID)).toBe(false);
    expect(client.rooms.cache.has(THREAD_ID)).toBe(false);
    expect(client.rooms.cache.has(PM_ID)).toBe(false);
    expect(client.spaces.cache.get(SPACE_ID)?.rooms.cache.has(NEW_ID)).toBe(true);
    expect(client.spaces.cache.get(OTHER_ID)?.rooms.cache.size).toBe(1);
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('keeps a thread that READY leaves out (archived meanwhile) instead of reporting it deleted', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    const deleted = vi.fn();
    client.on(Events.ThreadDelete, deleted);
    const ARCHIVED_ID = '4000000000000000011';
    // A public thread the bot never joined, cached from THREAD_CREATE.
    dispatch(
      socket,
      'THREAD_CREATE',
      {
        ...spaceRoom(ARCHIVED_ID, RoomType.Thread, {
          name: 'old news',
          parent_id: TEXT_ID,
          thread: { archived: false, locked: false, private: false, invitable: true, auto_archive_minutes: 60, owner_id: OWNER_ID, archived_at: null },
        }),
        room_id: ARCHIVED_ID,
      },
      { space_id: SPACE_ID },
    );
    await flush();
    const thread = client.rooms.cache.get(ARCHIVED_ID);
    expect(thread?.isThread() && thread.archived).toBe(false);

    // It auto-archives while the socket is down: the next READY has it in neither list.
    socket.serverClose(1006);
    const second = await nthSocket(gateway, 2);
    second.open();
    second.receive({ op: 4, d: readyPayload() });
    await flush();
    expect(deleted).not.toHaveBeenCalled();
    expect(client.rooms.cache.get(ARCHIVED_ID)).toBe(thread);
    expect(client.spaces.cache.get(SPACE_ID)?.rooms.cache.has(ARCHIVED_ID)).toBe(true);
    expect(thread).toMatchObject({ archived: true, joined: false });
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('removes spaces the client left while offline', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    const deleted = vi.fn();
    client.on(Events.SpaceDelete, deleted);
    socket.serverClose(1005);
    const second = await nthSocket(gateway, 2);
    second.open();
    second.receive({ op: 4, d: readyPayload({ spaces: [], space_rooms: {}, rooms: [] }) });
    await flush();
    expect(deleted).toHaveBeenCalledTimes(1);
    expect(client.spaces.cache.size).toBe(0);
    expect(client.rooms.cache.size).toBe(0);
  });

  it('keeps cached objects (and references to them) across a reconnect', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    const space = client.spaces.cache.get(SPACE_ID);
    const room = client.rooms.cache.get(TEXT_ID);
    socket.serverClose();
    const second = await nthSocket(gateway, 2);
    second.open();
    const { rooms = [], ...data } = apiSpace({ name: 'Renamed' });
    second.receive({ op: 4, d: readyPayload({ spaces: [data], space_rooms: { [SPACE_ID]: rooms } }) });
    await flush();
    expect(client.spaces.cache.get(SPACE_ID)).toBe(space);
    expect(space?.name).toBe('Renamed');
    expect(client.rooms.cache.get(TEXT_ID)).toBe(room);
  });
});

describe('ending the session', () => {
  it('stops for good on SESSION_REVOKED and emits invalidated', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    const invalidated = vi.fn();
    client.on(Events.Invalidated, invalidated);
    dispatch(socket, 'SESSION_REVOKED', { reason: 'bot token reset' }, { user_id: BOT_ID });
    await flush();
    expect(invalidated).toHaveBeenCalledWith('bot token reset');
    expect(client.ws.status).toBe(Status.Disconnected);
    expect(client.token).toBeNull();
    expect(client.isReady()).toBe(false);
    socket.serverClose();
    await sleep(20);
    expect(gateway.sockets).toHaveLength(1);
  });

  it('stops for good when a reconnect finds the token refused', async () => {
    const { client, gateway, socket, api } = track(await loggedIn());
    const invalidated = vi.fn();
    client.on(Events.Invalidated, invalidated);
    socket.serverClose();
    const second = await nthSocket(gateway, 2);
    api.on('GET /users/@me', unauthorized);
    second.fail();
    await vi.waitFor(() => {
      expect(invalidated).toHaveBeenCalledWith('token refused');
    });
    expect(client.ws.status).toBe(Status.Disconnected);
    await sleep(20);
    expect(gateway.sockets).toHaveLength(2);
  });

  it('destroy() closes the socket, stops reconnecting and allows logging in again', async () => {
    const { client, gateway, socket } = track(await loggedIn());
    await client.destroy();
    expect(socket.closedWith?.code).toBe(1000);
    expect(client.ws.status).toBe(Status.Idle);
    expect(client.token).toBeNull();
    expect(client.isReady()).toBe(false);
    await sleep(20);
    expect(gateway.sockets).toHaveLength(1);

    const ready = vi.fn();
    client.on(Events.ClientReady, ready);
    const login = client.login('test-token');
    const second = await nthSocket(gateway, 2);
    second.open();
    second.receive({ op: 4, d: readyPayload() });
    await login;
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('Symbol.asyncDispose destroys the client', async () => {
    const { client, socket } = track(await loggedIn());
    await client[Symbol.asyncDispose]();
    expect(socket.closedWith?.code).toBe(1000);
    expect(client.ws.status).toBe(Status.Idle);
  });

  it('destroy() during login rejects it with ClientDestroyed', async () => {
    const { client, gateway } = track(offline());
    const login = client.login('test-token');
    await nthSocket(gateway, 1);
    await client.destroy();
    expect((await rejection(login)).code).toBe(ErrorCodes.ClientDestroyed);
  });
});

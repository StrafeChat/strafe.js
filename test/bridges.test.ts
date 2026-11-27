import { describe, expect, it } from 'vitest';
import { BridgeAPIError, WebhookAPIError } from '../src/errors/APIErrors.js';
import { ErrorCodes } from '../src/errors/ErrorCodes.js';
import { Bridge } from '../src/structures/Bridge.js';
import type { TextRoom } from '../src/structures/rooms/TextRoom.js';
import { BOT_ID, BRIDGE_ID, OWNER_ID, PUPPET_ID, TEXT_ID, apiBridge, bridgedMessage, message, setup } from './helpers.js';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function bridgeSetup() {
  const value = setup();
  const room = value.client.rooms.cache.get(TEXT_ID) as TextRoom;
  return { ...value, room };
}

const alice = { id: '81726354', name: 'Alice', avatarURL: 'https://cdn.discordapp.com/avatars/81726354/ab12.png', bot: false };

describe('creating and managing bridges', () => {
  it('creates a bridge the bot drives and caches it in client.bridges and room.bridges', async () => {
    const { api, client, room } = bridgeSetup();
    api.on('POST /rooms/:id/bridges', apiBridge());
    const bridge = await room.createBridge({
      platform: 'discord',
      name: 'Discord #general',
      remote: { name: 'Example #general', url: 'https://discord.gg/example' },
      settings: { relayBots: false, replyPings: true },
      acknowledgePrivate: true,
    });
    expect(api.last().path).toBe(`/rooms/${TEXT_ID}/bridges`);
    expect(api.last().body).toEqual({
      platform: 'discord',
      name: 'Discord #general',
      remote: { name: 'Example #general', url: 'https://discord.gg/example' },
      settings: { relay_bots: false, reply_pings: true },
      acknowledge_private: true,
    });
    expect(bridge).toBeInstanceOf(Bridge);
    expect(bridge.driven).toBe(true);
    expect(bridge.partial).toBe(false);
    expect(bridge.settings).toEqual({ relayBots: false, relayOtherBridges: false, replyPings: true, allowColour: false, showProfileLinks: false });
    expect(bridge.remote).toEqual({ name: 'Example #general', url: 'https://discord.gg/example' });
    expect(client.bridges.cache.get(BRIDGE_ID)).toBe(bridge);
    expect(room.bridges.get(BRIDGE_ID)).toBe(bridge);
    expect(room.bridged).toBe(true);
    expect(bridge.room).toBe(room);
  });

  it('lists a room’s bridges as summaries, and pauses, resumes, changes and deletes', async () => {
    const { api, client, room } = bridgeSetup();
    const { settings: _s, creator: _c, updated_at: _u, last_used_at: _l, ...summary } = apiBridge({ id: '1310000000000000010', driver_id: '1000000000000000099', application_id: '1000000000000000099', driver_name: 'Other' });
    api.on('GET /rooms/:id/bridges', [summary]);
    const listed = await room.fetchBridges();
    const other = listed.get('1310000000000000010')!;
    expect(other.partial).toBe(true);
    expect(other.driven).toBe(false);
    expect(client.bridges.cache.has(other.id)).toBe(false);
    expect(room.bridges.has(other.id)).toBe(true);

    api.on('POST /rooms/:id/bridges', apiBridge());
    const bridge = await room.createBridge({ platform: 'discord', name: 'Discord #general' });
    api.on('PATCH /bridges/:id', (call: { body: { state?: string; settings?: Record<string, boolean> } }) =>
      apiBridge({
        state: call.body.state === 'paused' ? 'paused' : 'active',
        state_reason: call.body.state === 'paused' ? 'paused_by_driver' : null,
      }),
    );
    await bridge.pause('maintenance');
    expect(api.last().body).toEqual({ state: 'paused', reason: 'maintenance' });
    expect(bridge.paused).toBe(true);
    expect(bridge.stateReason).toBe('paused_by_driver');
    await bridge.resume({ acknowledgePrivate: true });
    expect(api.last().body).toEqual({ state: 'active', acknowledge_private: true });
    expect(bridge.active).toBe(true);
    await bridge.setSettings({ relayOtherBridges: true, allowColour: false });
    expect(api.last().body).toEqual({ settings: { relay_other_bridges: true, allow_colour: false } });
    await bridge.edit({ remote: null, name: 'Discord' });
    expect(api.last().body).toEqual({ name: 'Discord', remote: null });

    api.on('DELETE /bridges/:id', undefined);
    await bridge.delete('unbridged');
    expect(api.last()).toMatchObject({ method: 'DELETE', path: `/bridges/${BRIDGE_ID}`, body: { reason: 'unbridged' } });
    expect(client.bridges.cache.has(BRIDGE_ID)).toBe(false);
    expect(room.bridges.has(BRIDGE_ID)).toBe(false);
  });
});

describe('driving a bridge', () => {
  async function driven() {
    const value = bridgeSetup();
    const bridge = value.client.bridges._add(apiBridge());
    return { ...value, bridge };
  }

  it('sends as a bridged user with external ids, a reply and the reply ping', async () => {
    const { api, client, bridge, room } = await driven();
    api.on('POST /bridges/:id/messages', { ...bridgedMessage('7000000000000000010'), puppet_id: PUPPET_ID, reply_dropped: true });
    const result = await bridge.send({
      externalUser: { ...alice, colour: null, profileURL: 'https://discord.com/users/81726354' },
      externalMessageId: '1300000000000000',
      part: 0,
      content: 'hello from discord',
      replyTo: { externalMessageId: '1299999999999999' },
      repliedUser: true,
    });
    expect(api.last().path).toBe(`/bridges/${BRIDGE_ID}/messages`);
    expect(api.last().body).toEqual({
      external_user: {
        id: '81726354',
        name: 'Alice',
        avatar_url: 'https://cdn.discordapp.com/avatars/81726354/ab12.png',
        colour: null,
        bot: false,
        profile_url: 'https://discord.com/users/81726354',
      },
      external_message_id: '1300000000000000',
      part: 0,
      content: 'hello from discord',
      reply_to: { external_message_id: '1299999999999999' },
      allowed_mentions: { replied_user: true },
    });
    expect(result).toMatchObject({ messageId: '7000000000000000010', puppetId: PUPPET_ID, duplicate: false, replyDropped: true });
    const sent = result.message!;
    expect(room.messages.cache.get(sent.id)).toBe(sent);
    expect(sent.isBridged).toBe(true);
    expect(sent.webhookId).toBe(BRIDGE_ID);
    expect(sent.author.id).toBe(PUPPET_ID);
    expect(sent.author.username).toBe('Alice');
    expect(client.users.cache.has(PUPPET_ID)).toBe(false);
    expect(sent.masquerade?.via?.id).toBe(BOT_ID);
    expect(sent.masquerade?.colour).toBe(15158332);
    expect(sent.masquerade?.bridge).toEqual({ id: BRIDGE_ID, name: 'Discord #general', platform: 'discord', platformName: null, puppetId: PUPPET_ID, externalBot: false, profileURL: null });
  });

  it('replies to a Strafe message, sends files as multipart, and reports duplicates and deleted ones', async () => {
    const { api, bridge, room } = await driven();
    const parent = room.messages._add(message('7000000000000000001'));
    api.on('POST /bridges/:id/messages', { ...bridgedMessage('7000000000000000011'), puppet_id: PUPPET_ID, duplicate: true });
    const result = await bridge.send({ externalUser: alice, externalMessageId: 'a/b?c', replyTo: parent, files: [{ attachment: new Uint8Array([1, 2]), name: 'cat.txt' }] });
    const form = api.last().form!;
    expect(JSON.parse(form.get('payload_json') as string)).toMatchObject({ external_message_id: 'a/b?c', reply_to: { message_id: '7000000000000000001' } });
    expect((form.get('files[0]') as File).name).toBe('cat.txt');
    expect(result.duplicate).toBe(true);

    api.on('POST /bridges/:id/messages', { id: '7000000000000000012', room_id: TEXT_ID, deleted: true, puppet_id: PUPPET_ID, duplicate: true });
    const gone = await bridge.send({ externalUser: alice, externalMessageId: 'old', content: 'again' });
    expect(gone).toMatchObject({ message: null, messageId: '7000000000000000012', duplicate: true });
  });

  it('refuses a send without external ids before any request', async () => {
    const { api, bridge } = await driven();
    await expect(bridge.send({ externalUser: { id: '', name: 'x' }, externalMessageId: '1', content: 'x' })).rejects.toMatchObject({ code: ErrorCodes.BridgeSendInvalid });
    await expect(bridge.send({ externalUser: alice, externalMessageId: '', content: 'x' })).rejects.toMatchObject({ code: ErrorCodes.BridgeSendInvalid });
    await expect(bridge.send({ externalUser: alice, externalMessageId: '1' })).rejects.toMatchObject({ code: ErrorCodes.MessageEmpty });
    expect(api.calls).toHaveLength(0);
  });

  it('retries a send after a 502: bridge sends are idempotent', async () => {
    const { client, api } = setup({ rest: { retries: 1 } });
    const bridge = client.bridges._add(apiBridge());
    let attempts = 0;
    api.on('POST /bridges/:id/messages', () => {
      attempts++;
      if (attempts === 1) return new Response('bad gateway', { status: 502 });
      return { ...bridgedMessage('7000000000000000013'), puppet_id: PUPPET_ID };
    });
    const result = await bridge.send({ externalUser: alice, externalMessageId: '1300', content: 'hi' });
    expect(attempts).toBe(2);
    expect(result.messageId).toBe('7000000000000000013');
  }, 10_000);

  it('waits for a send still in progress and answers its duplicate', async () => {
    const { api, bridge } = await driven();
    let attempts = 0;
    api.on('POST /bridges/:id/messages', () => {
      attempts++;
      if (attempts === 1) return json(409, { error: 'in progress', code: 'send_in_progress' })();
      return { ...bridgedMessage('7000000000000000014'), puppet_id: PUPPET_ID, duplicate: true };
    });
    await expect(bridge.send({ externalUser: alice, externalMessageId: '1301', content: 'hi' })).resolves.toMatchObject({ messageId: '7000000000000000014', duplicate: true });
    expect(attempts).toBe(2);
  });

  it('edits, deletes and reacts by external id or Strafe id', async () => {
    const { api, bridge, room } = await driven();
    api.on('PATCH /bridges/:id/messages/external/:ext', bridgedMessage('7000000000000000010', { plaintext: 'hi!' }));
    const edited = await bridge.editMessage('1300', { content: 'hi!', part: 1 });
    expect(api.last()).toMatchObject({ path: `/bridges/${BRIDGE_ID}/messages/external/1300`, body: { content: 'hi!', part: 1 } });
    expect(edited.content).toBe('hi!');

    api.on('PATCH /bridges/:id/messages/:id', bridgedMessage('7000000000000000010', { plaintext: 'again' }));
    await bridge.editMessage(edited, 'again');
    expect(api.last().path).toBe(`/bridges/${BRIDGE_ID}/messages/7000000000000000010`);

    api.on('DELETE /bridges/:id/messages/external/:ext', undefined);
    await bridge.deleteMessage({ externalMessageId: 'x/y', part: 2 });
    expect(api.last().path).toBe(`/bridges/${BRIDGE_ID}/messages/external/x%2Fy`);
    expect(api.last().query.get('part')).toBe('2');

    api.on('PUT /bridges/:id/messages/external/:ext/reactions/:emoji/:user', undefined);
    await bridge.react('1300', '👍', { externalUserId: '81726354', externalUser: { name: 'Alice' } });
    expect(api.last().path).toBe(`/bridges/${BRIDGE_ID}/messages/external/1300/reactions/${encodeURIComponent('👍')}/81726354`);
    expect(api.last().body).toEqual({ external_user: { name: 'Alice' } });

    api.on('DELETE /bridges/:id/messages/:id/reactions/:emoji/:user', undefined);
    await bridge.unreact({ messageId: '7000000000000000001' }, '<:party:5000000000000000009>', { externalUserId: '81726354' });
    expect(api.last().path).toBe(`/bridges/${BRIDGE_ID}/messages/7000000000000000001/reactions/custom:5000000000000000009/81726354`);
    expect(room.id).toBe(TEXT_ID);
  });

  it('links copies and looks the id map up both ways', async () => {
    const { api, bridge } = await driven();
    api.on('PUT /bridges/:id/messages/:id/external', undefined);
    await bridge.link('7000000000000000001', '1301', { part: 0 });
    expect(api.last()).toMatchObject({ path: `/bridges/${BRIDGE_ID}/messages/7000000000000000001/external`, body: { external_message_id: '1301', part: 0 } });

    const entry = { message_id: '7000000000000000010', room_id: TEXT_ID, part: 0, direction: 'inbound', external_message_id: '1300' };
    api.on('GET /bridges/:id/messages/external/:ext', { ...entry, parts: [entry, { ...entry, part: 1, message_id: '7000000000000000011' }] });
    expect(await bridge.lookup('1300')).toEqual([
      { messageId: '7000000000000000010', roomId: TEXT_ID, part: 0, direction: 'inbound', externalMessageId: '1300' },
      { messageId: '7000000000000000011', roomId: TEXT_ID, part: 1, direction: 'inbound', externalMessageId: '1300' },
    ]);
    expect(await bridge.lookup({ externalMessageId: '1300', part: 1 })).toHaveLength(1);

    api.on('GET /bridges/:id/messages/:id/external', [{ ...entry, direction: 'outbound' }]);
    expect((await bridge.lookup({ messageId: '7000000000000000010' }))[0]?.direction).toBe('outbound');

    api.on('GET /bridges/:id/messages/external/:ext', json(404, { error: 'unknown external message', code: 'unknown_external_message' }));
    await expect(bridge.lookup('expired')).resolves.toEqual([]);
  });

  it('catches up through the backlog a page at a time', async () => {
    const { api, bridge } = await driven();
    const pages: Record<string, unknown[]> = {
      start: [
        { bridge_id: BRIDGE_ID, room_id: TEXT_ID, message: message('7000000000000000020') },
        { bridge_id: BRIDGE_ID, room_id: TEXT_ID, message: message('7000000000000000021', { reply_to_id: '7000000000000000020' }), reply_external: { external_message_id: '1300', part: 0 } },
      ],
      '7000000000000000021': [{ bridge_id: BRIDGE_ID, room_id: TEXT_ID, message: message('7000000000000000022') }],
      '7000000000000000022': [],
    };
    api.on('GET /bridges/:id/messages', (call: { query: URLSearchParams }) => pages[call.query.get('after') ?? 'start']);
    const seen: string[] = [];
    let reply = null;
    for await (const entry of bridge.backlog({ limit: 2 })) {
      seen.push(entry.message.id);
      if (entry.replyExternal) reply = entry.replyExternal;
    }
    expect(seen).toEqual(['7000000000000000020', '7000000000000000021', '7000000000000000022']);
    expect(reply).toEqual({ externalMessageId: '1300', part: 0 });
    expect(api.calls.map((c) => c.query.get('after'))).toEqual([null, '7000000000000000021', '7000000000000000022']);
    expect(api.calls[0]!.query.get('limit')).toBe('2');
  });

  it('manages puppets and blocks', async () => {
    const { api, client, bridge } = await driven();
    const puppet = {
      puppet_id: PUPPET_ID,
      bridge_id: BRIDGE_ID,
      external_user_id: '81726354',
      name: 'Alice',
      avatar: null,
      bot: false,
      profile_url: null,
      blocked: false,
      last_seen_at: '2026-11-20T10:00:00Z',
      lookalike: { id: OWNER_ID, username: 'alice' },
    };
    api.on('GET /bridges/:id/puppets/:ext', puppet);
    api.on('PATCH /bridges/:id/puppets/:ext', { ...puppet, name: 'Alice B' });
    api.on('DELETE /bridges/:id/puppets/:ext', undefined);
    expect(await bridge.puppets.fetch('81726354')).toMatchObject({ puppetId: PUPPET_ID, externalUserId: '81726354', lookalike: { id: OWNER_ID, username: 'alice' } });
    expect((await bridge.puppets.edit('81726354', { name: 'Alice B', avatarURL: null })).name).toBe('Alice B');
    expect(api.last().body).toEqual({ name: 'Alice B', avatar_url: null });
    await bridge.puppets.delete('81726354');
    expect(api.last()).toMatchObject({ method: 'DELETE', path: `/bridges/${BRIDGE_ID}/puppets/81726354` });

    api.on('PUT /bridges/:id/blocks/:id', undefined);
    api.on('DELETE /bridges/:id/blocks/:id', undefined);
    api.on('GET /bridges/:id/blocks', [
      { puppet_id: PUPPET_ID, bridge_id: BRIDGE_ID, name: 'Alice', avatar: null, reason: 'spam', blocked_at: '2026-11-20T10:00:00Z', blocked_by: { id: OWNER_ID, username: 'owner', display_name: 'The Owner', avatar: '', bot: false } },
    ]);
    await bridge.blocks.create(PUPPET_ID, { reason: 'spam' });
    expect(api.last()).toMatchObject({ method: 'PUT', path: `/bridges/${BRIDGE_ID}/blocks/${PUPPET_ID}`, body: { reason: 'spam' } });
    const blocks = await bridge.blocks.fetch({ before: '1310000000000000099' });
    expect(api.last().query.get('before')).toBe('1310000000000000099');
    expect(blocks[0]).toMatchObject({ puppetId: PUPPET_ID, reason: 'spam', blockedBy: client.users.cache.get(OWNER_ID) });
    await bridge.blocks.remove(PUPPET_ID);
    expect(api.last()).toMatchObject({ method: 'DELETE', path: `/bridges/${BRIDGE_ID}/blocks/${PUPPET_ID}` });
  });

  it('maps bridge error codes to BridgeAPIError with their fields', async () => {
    const { api, bridge, room } = await driven();
    api.on('POST /bridges/:id/messages', json(403, { error: 'this bridge is paused', code: 'bridge_inactive', state: 'paused', state_reason: 'became_private' }));
    const inactive = (await bridge.send({ externalUser: alice, externalMessageId: '1', content: 'x' }).catch((e: unknown) => e)) as BridgeAPIError;
    expect(inactive).toBeInstanceOf(BridgeAPIError);
    expect(inactive).toBeInstanceOf(WebhookAPIError);
    expect(inactive.code).toBe('bridge_inactive');
    expect(inactive.state).toBe('paused');
    expect(inactive.stateReason).toBe('became_private');
    expect(inactive.name).toBe('BridgeAPIError[bridge_inactive]');

    api.on('POST /bridges/:id/messages', json(403, { error: 'blocked', code: 'puppet_blocked' }));
    await expect(bridge.send({ externalUser: alice, externalMessageId: '2', content: 'x' })).rejects.toMatchObject({ code: 'puppet_blocked', status: 403 });

    api.on('POST /rooms/:id/bridges', json(409, { error: 'ack', code: 'private_room_ack_required', audience: 4 }));
    const ack = (await room.createBridge({ platform: 'discord', name: 'x' }).catch((e: unknown) => e)) as BridgeAPIError;
    expect(ack).toBeInstanceOf(BridgeAPIError);
    expect(ack.audience).toBe(4);

    api.on('POST /bridges/:id/messages', json(403, { error: 'missing permission: Attach Files', code: 'missing_permissions', permission: 'Attach Files' }));
    const perm = (await bridge.send({ externalUser: alice, externalMessageId: '3', content: 'x' }).catch((e: unknown) => e)) as BridgeAPIError;
    expect(perm.permission).toBe('Attach Files');
  });

  it("waits out a bridged user's slowmode in the bridge's own queue", async () => {
    const { api, client, bridge } = await driven();
    let first = true;
    api.on('POST /bridges/:id/messages', () => {
      if (!first) return { ...bridgedMessage('7000000000000000030'), puppet_id: PUPPET_ID };
      first = false;
      return json(429, { error: 'slowmode is on in this room', code: 'slowmode', scope: 'puppet', retry_after: 0.01 }, { 'retry-after': '0' })();
    });
    const limits: unknown[] = [];
    client.rest.on('rateLimited', (data) => limits.push(data));
    await expect(bridge.send({ externalUser: alice, externalMessageId: '1', content: 'x' })).resolves.toMatchObject({ messageId: '7000000000000000030' });
    expect(limits).toEqual([expect.objectContaining({ scope: 'shared', serverScope: 'puppet', majorParameter: BRIDGE_ID })]);
  });
});

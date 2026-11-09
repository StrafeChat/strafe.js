import { expect, vi } from 'vitest';
import { Client } from '../../src/client/Client.js';
import type { ClientOptions } from '../../src/client/Client.js';
import type { GatewayReadyData } from '../../src/types/api/gateway.js';
import { RoomType } from '../../src/types/api/room.js';
import { BOT_ID, OWNER_ID, PM_ID, SPACE_ID, TEXT_ID, VOICE_ID, apiSpace, fakeAPI, selfUser } from '../helpers.js';

const now = '2026-11-09T10:00:00Z';

/** A fake WebSocket the tests drive: `open()`, `receive(packet)`, `serverClose()`. */
export interface FakeSocket {
  url: string;
  init: { headers: Record<string, string> };
  readyState: number;
  sent: { op: number; d?: unknown }[];
  closedWith: { code: number; reason: string } | null;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  open(): void;
  receive(packet: unknown): void;
  serverClose(code?: number): void;
  fail(): void;
  failWithoutClose(): void;
  node22: boolean;
}

export function fakeGateway() {
  const sockets: FakeSocket[] = [];
  class Socket implements FakeSocket {
    public readyState = 0;
    public sent: { op: number; d?: unknown }[] = [];
    public closedWith: { code: number; reason: string } | null = null;
    public onopen: FakeSocket['onopen'] = null;
    public onmessage: FakeSocket['onmessage'] = null;
    public onclose: FakeSocket['onclose'] = null;
    public onerror: FakeSocket['onerror'] = null;
    /** Behave like Node 22's WebSocket while connecting (see failWithoutClose and close). */
    public node22 = false;
    public constructor(
      public url: string,
      public init: { headers: Record<string, string> },
    ) {
      sockets.push(this);
    }
    public send(data: string): void {
      if (this.readyState !== 1) throw new Error('not open');
      this.sent.push(JSON.parse(data));
    }
    public close(code = 1000, reason = ''): void {
      if (this.node22 && this.readyState === 0) {
        // Node 22: closing a socket that is still connecting fires `error` synchronously, every time.
        this.onerror?.({ type: 'error', message: 'Connection was closed before it was established.' });
        return;
      }
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.closedWith = { code, reason };
      queueMicrotask(() => this.onclose?.({ code, reason }));
    }
    public open(): void {
      this.readyState = 1;
      this.onopen?.({});
    }
    public receive(packet: unknown): void {
      this.onmessage?.({ data: JSON.stringify(packet) });
    }
    public serverClose(code = 1006): void {
      this.readyState = 3;
      this.onclose?.({ code, reason: '' });
    }
    public fail(): void {
      this.onerror?.({ type: 'error' });
      this.serverClose(1006);
    }
    public failWithoutClose(): void {
      // Node 22: a refused handshake fires `error` only, and the socket stays CONNECTING.
      this.node22 = true;
      this.onerror?.({ type: 'error', message: 'Received network error or non-101 status code.' });
    }
  }
  return {
    sockets,
    WebSocket: Socket,
    last(): FakeSocket {
      const socket = sockets.at(-1);
      if (!socket) throw new Error('no socket');
      return socket;
    },
  };
}

/** READY for the fixture space: full space rooms, a PM, a light copy of the text room and a voice state. */
export function readyPayload(extra: Partial<GatewayReadyData> = {}): GatewayReadyData {
  const { rooms, ...space } = apiSpace();
  const base: GatewayReadyData = {
    user: { ...selfUser, presence: { status: 'online' } },
    session_id: '0',
    relationships: [],
    spaces: [space],
    space_rooms: { [SPACE_ID]: rooms ?? [] },
    rooms: [
      { id: PM_ID, type: RoomType.PM, recipients: [BOT_ID, OWNER_ID], created_at: now },
      // The lighter copy of a space room READY also lists: it must patch, not duplicate.
      { id: TEXT_ID, type: RoomType.SpaceText, space_id: SPACE_ID, last_message_id: '99', e2ee_enabled: false, created_at: now, recipients: [] },
    ] as NonNullable<GatewayReadyData['rooms']>,
    voice_states: [{ user_id: OWNER_ID, room_id: VOICE_ID, space_id: SPACE_ID, session_id: 's1', self_mute: false, self_deaf: false, connected: true } as never],
  };
  return Object.assign(base, extra);
}

/** A client on a fake API and gateway, not logged in yet. */
export function offline(options: ClientOptions = {}) {
  const api = fakeAPI();
  api.on('GET /users/@me', selfUser);
  api.on('GET /', { strafe: { version: 'test' }, federation: { enabled: true, domain: 'chat.example' } });
  const gateway = fakeGateway();
  const client = new Client({
    instance: 'https://chat.example',
    ...options,
    rest: { makeRequest: api.fetch, retries: 0, ...options.rest },
    ws: { WebSocket: gateway.WebSocket, reconnectDelay: 2, maxReconnectDelay: 10, ...options.ws },
  });
  return { api, gateway, client };
}

/** Waits for the gateway's `n`th socket. */
export async function nthSocket(gateway: ReturnType<typeof fakeGateway>, n: number): Promise<FakeSocket> {
  await vi.waitFor(
    () => {
      expect(gateway.sockets.length).toBeGreaterThanOrEqual(n);
    },
    { interval: 1 },
  );
  const socket = gateway.sockets[n - 1];
  if (!socket) throw new Error('no socket');
  return socket;
}

/**
 * A client logged in on a fake API and gateway, after its first READY. `before` runs before
 * `login()` (to add listeners).
 */
export async function loggedIn(options: ClientOptions = {}, ready: GatewayReadyData = readyPayload(), before?: (client: Client) => void) {
  const { api, gateway, client } = offline(options);
  before?.(client);
  const login = client.login('test-token');
  await vi.waitFor(() => {
    expect(gateway.sockets.length).toBe(1);
  });
  gateway.last().open();
  gateway.last().receive({ op: 4, d: ready });
  await login;
  return { api, gateway, client: client as Client<true>, socket: gateway.last() };
}

/** Sends a dispatch frame the way the server does (top-level `t` plus the envelope). */
export function dispatch(socket: FakeSocket, t: string, d: unknown, envelope: Record<string, unknown> = {}): void {
  socket.receive({ op: 3, t, d: { t, ...envelope, d } });
}

/** Lets queued handlers run. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

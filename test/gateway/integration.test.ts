// The runtime's own WebSocket against a minimal gateway on 127.0.0.1 (nothing leaves the
// machine): checks that the handshake carries the Bot header, that READY and events arrive through
// a real socket, and that a refused handshake ends login with TokenInvalid.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '../../src/client/Client.js';
import { Events } from '../../src/client/ClientEvents.js';
import { ErrorCodes } from '../../src/errors/ErrorCodes.js';
import { StrafeError } from '../../src/errors/StrafeError.js';
import { Status } from '../../src/gateway/WebSocketManager.js';
import { OWNER_ID, SPACE_ID, TEXT_ID, fakeAPI, message, selfUser } from '../helpers.js';
import { readyPayload } from './helpers.js';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

interface Gateway {
  url: string;
  headers: IncomingMessage['headers'][];
  received: unknown[];
  send(packet: unknown): void;
  close(): Promise<void>;
}

function frame(text: string): Buffer {
  const payload = Buffer.from(text);
  const length = payload.length;
  let header: Buffer;
  if (length < 126) header = Buffer.from([0x81, length]);
  else if (length < 65536) header = Buffer.from([0x81, 126, length >> 8, length & 0xff]);
  else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Reads the client's masked frames; calls `onText` for text frames, closes on a close frame. */
function readFrames(socket: Duplex, onText: (text: string) => void): void {
  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const opcode = (buffer[0] ?? 0) & 0x0f;
      let length = (buffer[1] ?? 0) & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (buffer.length < offset + 4 + length) return;
      const mask = buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
      for (let i = 0; i < payload.length; i++) payload[i] = (payload[i] ?? 0) ^ (mask[i % 4] ?? 0);
      buffer = buffer.subarray(offset + 4 + length);
      if (opcode === 0x1) onText(payload.toString());
      else if (opcode === 0x8) {
        socket.end(Buffer.from([0x88, 0]));
        return;
      }
    }
  });
}

async function startGateway(options: { refuse?: boolean; onOpen?: (gateway: Gateway) => void } = {}): Promise<Gateway> {
  const sockets = new Set<Duplex>();
  let current: Duplex | null = null;
  const server: Server = createServer((_req, res) => {
    res.writeHead(404).end();
  });
  const gateway: Gateway = {
    url: '',
    headers: [],
    received: [],
    send(packet) {
      current?.write(frame(JSON.stringify(packet)));
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
  server.on('upgrade', (req: IncomingMessage, socket: Duplex) => {
    sockets.add(socket);
    gateway.headers.push(req.headers);
    if (options.refuse === true || req.headers.authorization !== 'Bot test-token') {
      const body = JSON.stringify({ op: 8, d: { code: 401, message: 'invalid bot token' } });
      socket.end(`HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
      return;
    }
    const accept = createHash('sha1')
      .update(`${String(req.headers['sec-websocket-key'])}${GUID}`)
      .digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    current = socket;
    readFrames(socket, (text) => {
      const packet = JSON.parse(text) as { op: number };
      gateway.received.push(packet);
      if (packet.op === 6 || packet.op === 0) socket.write(frame(JSON.stringify({ op: 7 })));
    });
    gateway.send({ op: 4, d: readyPayload() });
    options.onOpen?.(gateway);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  gateway.url = `ws://127.0.0.1:${port}/events`;
  return gateway;
}

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});

function client(gateway: Gateway, api: ReturnType<typeof fakeAPI>): Client {
  const c = new Client({ instance: 'https://chat.example', rest: { makeRequest: api.fetch, retries: 0 }, ws: { gateway: gateway.url, reconnectDelay: 5, loginAttempts: 2 } });
  cleanup.push(() => c.destroy());
  return c;
}

describe.skipIf(typeof globalThis.WebSocket !== 'function')('with the runtime WebSocket', () => {
  it('logs in, receives events and measures latency over a real socket', async () => {
    const gateway = await startGateway();
    cleanup.push(() => gateway.close());
    const api = fakeAPI().on('GET /users/@me', selfUser).on('GET /', { strafe: { version: 'test' } });
    const bot = client(gateway, api);
    await bot.login('test-token');
    expect(gateway.headers[0]?.authorization).toBe('Bot test-token');
    expect(bot.isReady()).toBe(true);
    expect(bot.rooms.cache.has(TEXT_ID)).toBe(true);

    const created = vi.fn();
    bot.on(Events.MessageCreate, created);
    gateway.send({ op: 3, t: 'MESSAGE_CREATE', d: { t: 'MESSAGE_CREATE', room_id: TEXT_ID, space_id: SPACE_ID, d: message('900') } });
    await vi.waitFor(() => {
      expect(created).toHaveBeenCalledTimes(1);
    });
    expect((created.mock.calls[0]?.[0] as { author: { id: string } }).author.id).toBe(OWNER_ID);
    await vi.waitFor(() => {
      expect(bot.ws.ping).toBeGreaterThanOrEqual(0);
    });
    expect(gateway.received).toContainEqual({ op: 6 });
  });

  it('turns a refused handshake into TokenInvalid', async () => {
    const gateway = await startGateway({ refuse: true });
    cleanup.push(() => gateway.close());
    const api = fakeAPI().on('GET /', { strafe: { version: 'test' } });
    let checks = 0;
    // The first check (login) passes; the re-check after the refused handshake fails, as it would
    // for a token reset between the two.
    api.on('GET /users/@me', () =>
      ++checks === 1 ? selfUser : new Response(JSON.stringify({ error: 'invalid bot token' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    );
    const bot = client(gateway, api);
    const attempts: string[] = [];
    bot.on(Events.Debug, (line) => {
      if (line.includes('Connecting to')) attempts.push(line);
    });
    let error: unknown;
    try {
      await bot.login('test-token');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(StrafeError);
    expect((error as StrafeError).code).toBe(ErrorCodes.TokenInvalid);
    // One connection attempt by the library (the runtime's HTTP client may repeat the refused
    // handshake request on its own), and no reconnect after the token was refused.
    expect(attempts).toHaveLength(1);
    expect(gateway.headers.every((headers) => headers.authorization === 'Bot test-token')).toBe(true);
    expect(bot.ws.status).toBe(Status.Disconnected);
  });
});

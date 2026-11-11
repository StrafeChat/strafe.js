import type { Client } from '../client/Client.js';
import { Events } from '../client/ClientEvents.js';
import { HTTPError, StrafeAPIError } from '../errors/APIErrors.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { APIActivity } from '../types/api/common.js';
import type { GatewayReceivePayload, GatewaySendPayload } from '../types/api/gateway.js';
import { GatewayOpcodes } from '../types/api/gateway.js';
import type { Snowflake } from '../util/Snowflake.js';
import { handlePacket } from './handlers/index.js';

/**
 * The gateway connection's state (`client.ws.status`), numbered like discord.js's `Status` where
 * the states exist on Strafe.
 */
export enum Status {
  /** READY received; events flow. */
  Ready = 0,
  /** Connecting for the first time (during `login()`). */
  Connecting = 1,
  /** The connection dropped; a new one is scheduled or opening. */
  Reconnecting = 2,
  /** Not connected: before `login()` or after `destroy()`. */
  Idle = 3,
  /** Stopped for good: the token was refused or revoked. */
  Disconnected = 5,
}

/** What the library hands a WebSocket constructor as its second argument. */
export interface WebSocketInitLike {
  /** Handshake headers: `Authorization: Bot <token>`. */
  headers: Record<string, string>;
}

/**
 * A WebSocket class the gateway can use: the runtime's global `WebSocket` (Node 22+, Bun, Deno), or
 * the `ws` package's class. It is called as `new WebSocket(url, { headers })`, so it must accept
 * handshake headers in its second argument (Node's, Bun's and `ws`'s do; browsers' do not).
 */
export type WebSocketConstructorLike = new (url: string, init: WebSocketInitLike) => unknown;

/** The part of the standard WebSocket API the gateway uses. @internal */
interface WebSocketLike {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

const OPEN = 1;

/** Gateway options (`new Client({ ws: { ... } })`). */
export interface ClientWebSocketOptions {
  /** The gateway URL, when it is not `wss://<host>/gateway/events` or what the instance advertises. */
  gateway?: string;
  /**
   * The WebSocket class (default: the global `WebSocket`). Pass the `ws` package's class on a
   * runtime without a global one, or a fake in tests.
   */
  WebSocket?: WebSocketConstructorLike;
  /**
   * Milliseconds between latency pings (op 6). A ping left unanswered until the next one marks the
   * connection as dead and reconnects. Default 40 000 (the server drops a silent socket after 60 s).
   */
  pingInterval?: number;
  /** Milliseconds to wait for READY after connecting before trying again. Default 30 000. */
  readyTimeout?: number;
  /** First reconnect delay in milliseconds; it doubles per failed attempt, with jitter. Default 1000. */
  reconnectDelay?: number;
  /** Longest reconnect delay in milliseconds. Default 60 000. */
  maxReconnectDelay?: number;
  /**
   * How many connection attempts `login()` makes before it rejects. Once the client has been ready,
   * reconnects go on until `destroy()`. Default 5.
   */
  loginAttempts?: number;
}

/** {@link ClientWebSocketOptions} with defaults applied. */
export interface ResolvedWebSocketOptions {
  /** The WebSocket class, if one was given. */
  WebSocket: WebSocketConstructorLike | undefined;
  /** See {@link ClientWebSocketOptions.pingInterval}. */
  pingInterval: number;
  /** See {@link ClientWebSocketOptions.readyTimeout}. */
  readyTimeout: number;
  /** See {@link ClientWebSocketOptions.reconnectDelay}. */
  reconnectDelay: number;
  /** See {@link ClientWebSocketOptions.maxReconnectDelay}. */
  maxReconnectDelay: number;
  /** See {@link ClientWebSocketOptions.loginAttempts}. */
  loginAttempts: number;
}

/** The defaults of {@link ClientWebSocketOptions}. */
export const DefaultWebSocketOptions: Readonly<ResolvedWebSocketOptions> = Object.freeze({
  WebSocket: undefined,
  pingInterval: 40_000,
  readyTimeout: 30_000,
  reconnectDelay: 1_000,
  maxReconnectDelay: 60_000,
  loginAttempts: 5,
});

interface PendingLogin {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * The connection to Strafe's gateway (`client.ws`):
 *
 * - one connection, authenticated with `Authorization: Bot <token>` on the handshake (there is no
 *   identify frame, no intents and no sharding);
 * - READY (op 4) is the first frame of every connection, and the server subscribes a bot to every
 *   space and room it can see, so {@link WebSocketManager.subscribe} is rarely needed;
 * - latency is measured with op 6 / op 7 ({@link WebSocketManager.ping});
 * - there is no resume: after a drop it reconnects with exponential backoff and jitter, and the
 *   new READY replaces the caches (spaces and rooms that appeared or vanished meanwhile are emitted
 *   as create/delete events). Messages sent while disconnected are only available through
 *   `room.messages.fetch({ after })`.
 *
 * The server keeps at most 512 unsent frames per connection and drops events beyond that, so frames
 * are read immediately and handled in order from a local queue; slow listeners never block the socket.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `WebSocketManager`.
 */
export class WebSocketManager {
  /** The client. */
  declare public readonly client: Client;
  /** The options in use. */
  public readonly options: ResolvedWebSocketOptions;
  /** The connection state. */
  public status: Status = Status.Idle;
  /** Round-trip latency of the last op 6 ping in milliseconds; `-1` until measured. */
  public ping = -1;
  /** When the last pong arrived (Unix ms), or `null`. */
  public lastPingTimestamp: number | null = null;

  private socket: WebSocketLike | null = null;
  private opened = false;
  private receivedReady = false;
  private everReady = false;
  private destroyed = true;
  private failures = 0;
  private pingSentAt: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: PendingLogin | null = null;
  private readonly queue: unknown[] = [];
  private draining = false;

  /**
   * @param client - The client.
   * @param options - Gateway options.
   */
  public constructor(client: Client, options: ClientWebSocketOptions = {}) {
    Object.defineProperty(this, 'client', { value: client, enumerable: false });
    this.options = {
      WebSocket: options.WebSocket,
      pingInterval: options.pingInterval ?? DefaultWebSocketOptions.pingInterval,
      readyTimeout: options.readyTimeout ?? DefaultWebSocketOptions.readyTimeout,
      reconnectDelay: options.reconnectDelay ?? DefaultWebSocketOptions.reconnectDelay,
      maxReconnectDelay: options.maxReconnectDelay ?? DefaultWebSocketOptions.maxReconnectDelay,
      loginAttempts: options.loginAttempts ?? DefaultWebSocketOptions.loginAttempts,
    };
  }

  /** The gateway URL (`client.urls.gateway`). */
  public get gateway(): string {
    return this.client.urls.gateway;
  }

  /**
   * Opens the connection and resolves at the first READY. `client.login()` calls this; call it
   * yourself only after setting a token another way.
   *
   * @throws {@link StrafeError} `WSConnectionExists` when already connected or connecting.
   */
  public connect(): Promise<void> {
    if (!this.destroyed) return Promise.reject(new StrafeError(ErrorCodes.WSConnectionExists));
    this.destroyed = false;
    this.failures = 0;
    this.everReady = false;
    this.status = Status.Connecting;
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.open();
    });
  }

  /**
   * Closes the connection and stops reconnecting. A `login()` still waiting rejects with
   * `ClientDestroyed`.
   */
  public destroy(): void {
    this.stop(Status.Idle);
    this.rejectPending(new StrafeError(ErrorCodes.ClientDestroyed));
  }

  /**
   * Sends a raw frame.
   *
   * @param payload - The frame.
   * @throws {@link StrafeError} `WSNotOpen` when the socket is not open.
   */
  public send(payload: GatewaySendPayload): void {
    const socket = this.socket;
    if (socket?.readyState !== OPEN) throw new StrafeError(ErrorCodes.WSNotOpen);
    socket.send(JSON.stringify(payload));
  }

  /**
   * Subscribes the connection to a space or room's events (op 1). Bots are subscribed by the server
   * to everything they can see, at READY and whenever they gain access, so this is for completeness.
   * The server refuses ids the bot cannot view (a `warn` event) and ignores subscriptions past 5000
   * per connection.
   *
   * @param id - A space or room id.
   */
  public subscribe(id: Snowflake): void {
    this.send({ op: GatewayOpcodes.Subscribe, d: { space_id: id } });
  }

  /**
   * Stops receiving a space or room's events on this connection (op 5) until the next reconnect.
   *
   * @param id - A space or room id.
   */
  public unsubscribe(id: Snowflake): void {
    this.send({ op: GatewayOpcodes.Unsubscribe, d: { space_id: id } });
  }

  /**
   * Sends the activity (op 9) when the connection is ready; `client.user.setActivity()` is the
   * public way, and the client re-sends it after every reconnect.
   *
   * @internal
   */
  public _sendActivity(activity: APIActivity | null): void {
    if (this.status !== Status.Ready || this.socket?.readyState !== OPEN) return;
    this.send({ op: GatewayOpcodes.Activity, d: { activities: activity === null ? [] : [activity] } });
  }

  /**
   * Marks the connection ready (called by the READY handler before events are emitted).
   *
   * @internal
   */
  public _markReady(): { first: boolean } {
    const first = !this.everReady;
    this.receivedReady = true;
    this.everReady = true;
    this.failures = 0;
    this.status = Status.Ready;
    this.clearTimer('readyTimer');
    this.startPinging();
    this._sendActivity(this.client._activity);
    return { first };
  }

  /** Resolves a waiting `login()`. @internal */
  public _resolveLogin(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.resolve();
  }

  /**
   * Stops for good after `SESSION_REVOKED` or a refused token: no reconnect.
   *
   * @internal
   */
  public _invalidate(error: StrafeError): void {
    this.stop(Status.Disconnected);
    this.rejectPending(error);
  }

  private open(): void {
    if (this.destroyed) return;
    const Ctor = this.options.WebSocket ?? (globalThis as { WebSocket?: WebSocketConstructorLike }).WebSocket;
    if (!Ctor) {
      this._invalidate(new StrafeError(ErrorCodes.UnsupportedRuntime, 'a global WebSocket (pass one as `ws.WebSocket`, e.g. the `ws` package)'));
      return;
    }
    const token = this.client.token;
    if (token === null) {
      this._invalidate(new StrafeError(ErrorCodes.TokenMissing));
      return;
    }
    this.debug(`Connecting to ${this.gateway}`);
    this.opened = false;
    this.receivedReady = false;
    let socket: WebSocketLike;
    try {
      socket = new Ctor(this.gateway, { headers: { Authorization: `Bot ${token}` } }) as WebSocketLike;
    } catch (error) {
      this.debug(`Could not open the socket: ${describe(error)}`);
      this.onClose(null, { code: 1006, reason: describe(error) });
      return;
    }
    this.socket = socket;
    try {
      // Text frames arrive as strings anyway; binary ones are easier to decode in order this way.
      (socket as { binaryType?: string }).binaryType = 'arraybuffer';
    } catch {
      // A WebSocket class without binaryType.
    }
    socket.onopen = () => {
      if (socket !== this.socket) return;
      this.opened = true;
      this.debug('Connected; waiting for READY');
    };
    socket.onmessage = (event) => {
      if (socket !== this.socket) return;
      // A throw here would escape the WebSocket's event dispatch, which Node reports as an
      // uncaught exception (the process exits) whatever `error` listeners the client has.
      try {
        this.onData(event.data);
      } catch (error) {
        this.client._emitError(error);
      }
    };
    socket.onerror = (event) => {
      if (socket !== this.socket) return;
      const message = (event as { message?: unknown } | null)?.message;
      this.debug(`Socket error${typeof message === 'string' && message !== '' ? `: ${message}` : ''}`);
      // Node 22's WebSocket fires no `close` after a refused or failed handshake and leaves the socket
      // CONNECTING, so an error before `open` is handled as the close here; a `close` the runtime still
      // sends afterwards is ignored, as the socket is no longer ours.
      if (!this.opened) this.dropSocket(socket, 1006, typeof message === 'string' ? message : '');
    };
    socket.onclose = (event) => {
      this.onClose(socket, event);
    };
    this.clearTimer('readyTimer');
    this.readyTimer = setTimeout(() => {
      this.readyTimer = null;
      if (socket !== this.socket || this.receivedReady) return;
      this.debug(`No READY within ${this.options.readyTimeout} ms; reconnecting`);
      this.dropSocket(socket, 4000, 'ready timeout');
    }, this.options.readyTimeout);
  }

  private onData(data: unknown): void {
    let text: string;
    if (typeof data === 'string') text = data;
    else if (data instanceof ArrayBuffer) text = new TextDecoder().decode(new Uint8Array(data));
    else if (ArrayBuffer.isView(data)) text = new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      data
        .text()
        .then((value) => {
          this.onData(value);
        })
        .catch((error: unknown) => {
          this.client._emitError(error);
        });
      return;
    } else return;
    let packet: GatewayReceivePayload;
    try {
      packet = JSON.parse(text) as GatewayReceivePayload;
    } catch {
      this.debug(`Ignored a frame that is not JSON (${text.length} characters)`);
      return;
    }
    if (typeof packet !== 'object' || (packet as unknown) === null) return;
    this.client.emit(Events.Raw, packet);
    switch (packet.op) {
      case GatewayOpcodes.Pong:
        if (this.pingSentAt !== null) {
          const now = Date.now();
          this.ping = now - this.pingSentAt;
          this.lastPingTimestamp = now;
          this.pingSentAt = null;
        }
        return;
      case GatewayOpcodes.Error: {
        // `d` comes from the network: it may be missing or not an object.
        const detail = (packet as { d?: unknown }).d;
        const { code, message } = typeof detail === 'object' && detail !== null ? (detail as { code?: unknown; message?: unknown }) : {};
        this.client.emit(Events.Warn, `Gateway error ${describe(code ?? 'unknown')}: ${describe(message ?? '')}`);
        return;
      }
      case GatewayOpcodes.Ready:
      case GatewayOpcodes.Dispatch:
        this.enqueue(packet);
        return;
      default:
        this.debug(`Ignored a frame with op ${String((packet as { op?: unknown }).op)}`);
    }
  }

  private enqueue(packet: unknown): void {
    this.queue.push(packet);
    if (!this.draining) void this.drain();
  }

  private async drain(): Promise<void> {
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const packet = this.queue.shift();
        try {
          const result = handlePacket(this.client, packet as GatewayReceivePayload, this);
          if (result) await result;
        } catch (error) {
          this.client._emitError(error);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private startPinging(): void {
    this.clearTimer('pingTimer');
    this.pingSentAt = null;
    this.sendPing();
    this.pingTimer = setInterval(() => {
      if (this.pingSentAt !== null) {
        const socket = this.socket;
        this.debug(`No pong for ${Date.now() - this.pingSentAt} ms; the connection looks dead, reconnecting`);
        if (socket) this.dropSocket(socket, 4009, 'zombie connection');
        return;
      }
      this.sendPing();
    }, this.options.pingInterval);
  }

  private sendPing(): void {
    try {
      this.send({ op: GatewayOpcodes.Ping });
      this.pingSentAt = Date.now();
    } catch {
      // The close handler reconnects.
    }
  }

  /**
   * Handles a socket we gave up on as closed right away (a dead socket may never fire `close`), then
   * closes it. In that order: closing a socket that is still connecting fires `error` synchronously on
   * Node 22, and by then the socket must no longer be ours or the handler would close it again.
   *
   * @param code - The close code to report; 1006 (a failed connection) is reported but never sent.
   */
  private dropSocket(socket: WebSocketLike, code: number, reason: string): void {
    this.onClose(socket, { code, reason });
    try {
      if (code === 1006) socket.close();
      else socket.close(code, reason);
    } catch {
      // Already closing.
    }
  }

  private onClose(socket: WebSocketLike | null, event: { code?: number; reason?: string }): void {
    if (socket !== null && socket !== this.socket) return;
    const opened = this.opened;
    const wasReady = this.receivedReady;
    this.detach();
    if (this.destroyed) return;
    const code = event.code ?? 1006;
    this.debug(`Connection closed (code ${code}${event.reason ? `, ${event.reason}` : ''})`);
    if (!wasReady) this.failures++;
    else this.failures = 0;
    if (!this.everReady && this.failures >= this.options.loginAttempts) {
      this._invalidate(new StrafeError(ErrorCodes.GatewayUnreachable, this.gateway, this.failures));
      return;
    }
    this.status = Status.Reconnecting;
    if (this.everReady) this.client.emit(Events.Reconnecting);
    const delay = this.backoff();
    if (!opened) {
      // A refused handshake looks like any network error through the WebSocket API, so ask the REST
      // API whether the token still works before trying again.
      void this.checkToken().then((valid) => {
        if (valid && !this.destroyed && this.status === Status.Reconnecting) this.schedule(delay);
      });
      return;
    }
    this.schedule(delay);
  }

  private schedule(delay: number): void {
    this.clearTimer('reconnectTimer');
    this.debug(`Reconnecting in ${delay} ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private backoff(): number {
    const attempt = Math.max(0, this.failures - 1);
    const base = Math.min(this.options.maxReconnectDelay, this.options.reconnectDelay * 2 ** Math.min(attempt, 30));
    return Math.round(base / 2 + Math.random() * (base / 2));
  }

  private async checkToken(): Promise<boolean> {
    try {
      await this.client.rest.get(Routes.user());
      return true;
    } catch (error) {
      if ((error instanceof StrafeAPIError || error instanceof HTTPError) && error.status === 401) {
        this.debug('The token was refused; not reconnecting');
        const invalid = new StrafeError(ErrorCodes.TokenInvalid);
        if (this.everReady) this.client._invalidated('token refused', invalid);
        else this._invalidate(invalid);
        return false;
      }
      return true;
    }
  }

  private stop(status: Status): void {
    this.destroyed = true;
    const socket = this.socket;
    this.detach();
    this.queue.length = 0;
    this.status = status;
    this.ping = -1;
    if (socket) {
      try {
        socket.close(1000, 'client destroyed');
      } catch {
        // Already closed.
      }
    }
  }

  private detach(): void {
    this.socket = null;
    this.opened = false;
    this.receivedReady = false;
    this.pingSentAt = null;
    this.clearTimer('pingTimer');
    this.clearTimer('readyTimer');
    this.clearTimer('reconnectTimer');
  }

  private rejectPending(error: unknown): void {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(error);
  }

  private clearTimer(name: 'pingTimer' | 'readyTimer' | 'reconnectTimer'): void {
    const timer = this[name];
    if (timer !== null) {
      if (name === 'pingTimer') clearInterval(timer);
      else clearTimeout(timer);
      this[name] = null;
    }
  }

  private debug(message: string): void {
    this.client.emit(Events.Debug, `[gateway] ${message}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

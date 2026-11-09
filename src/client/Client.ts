import { HTTPError, StrafeAPIError } from '../errors/APIErrors.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { errorDetails, StrafeError } from '../errors/StrafeError.js';
import type { ClientWebSocketOptions } from '../gateway/WebSocketManager.js';
import { Status, WebSocketManager } from '../gateway/WebSocketManager.js';
import { ClientEmojiManager } from '../managers/ClientEmojiManager.js';
import { RoomManager } from '../managers/RoomManager.js';
import { SpaceManager } from '../managers/SpaceManager.js';
import { UserManager } from '../managers/UserManager.js';
import { REST } from '../rest/REST.js';
import { Routes } from '../rest/Routes.js';
import type { RESTOptions } from '../rest/types.js';
import { ClientUser } from '../structures/ClientUser.js';
import type { PresenceData } from '../structures/ClientUser.js';
import { Invite } from '../structures/Invite.js';
import type { APIActivity } from '../types/api/common.js';
import type { APIInstanceIndex } from '../types/api/instance.js';
import type { APIInvitePreview } from '../types/api/space.js';
import type { GatewayReadyData } from '../types/api/gateway.js';
import type { APIOwnProfile, APISelfUser } from '../types/api/user.js';
import { readEnv } from '../util/env.js';
import { TypedEmitter } from '../util/EventEmitter.js';
import type { InstanceURLs } from '../util/instance.js';
import { resolveInstanceURLs } from '../util/instance.js';
import type { CacheFactory } from '../util/Options.js';
import { Options } from '../util/Options.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { If } from '../util/Util.js';
import type { ClientEvents } from './ClientEvents.js';
import type { BotInviteOptions, InviteGenerationOptions } from '../oauth2/authorize.js';
import { buildBotInviteURL } from '../oauth2/authorize.js';
import { formatInviteCode, parseInviteCode } from '../util/invite.js';
import { Events } from './ClientEvents.js';

export type { ClientWebSocketOptions } from '../gateway/WebSocketManager.js';

/** discord.js options that do not exist on Strafe; passing one emits a `warn` at login. */
const UnsupportedOptions: Record<string, string> = {
  intents: 'Strafe has no gateway intents: a bot receives every event about what it can see. Remove `intents`.',
  partials: 'Strafe needs no partials option: events about uncached messages, members and reactions always arrive, as partial objects. Remove `partials`.',
  shards: 'Strafe has no sharding: one connection receives everything. Remove `shards`.',
  shardCount: 'Strafe has no sharding: one connection receives everything. Remove `shardCount`.',
  allowedMentions:
    'Strafe has no allowedMentions: the server reads mentions from the text itself. Use escapeMentions() on text you do not control. Remove `allowedMentions`.',
};

/**
 * Options of a {@link Client}. Only `instance` matters for most bots (or the `STRAFE_INSTANCE`
 * environment variable). There are no intents: a bot receives everything it can see.
 */
export interface ClientOptions {
  /**
   * The instance: a domain (`app.strafe.chat`) or URL. Defaults to `STRAFE_INSTANCE`. Every
   * instance is independent, so there is no default.
   */
  instance?: string | undefined;
  /** REST options (retries, timeouts, rate-limit behaviour, `api` override, fetch injection). */
  rest?: Partial<RESTOptions>;
  /** Gateway options. */
  ws?: ClientWebSocketOptions;
  /** The web client's origin, when it is not the instance origin (invite links, OAuth2 consent). */
  web?: string | undefined;
  /** The CDN base, when it differs. */
  cdn?: string | undefined;
  /** How caches are built ({@link Options.cacheWithLimits}); default keeps 200 messages per room. */
  makeCache?: CacheFactory;
  /** The presence to set after logging in. */
  presence?: PresenceData;
}

/**
 * The bot's application, as {@link Client.application} gives it. On Strafe a bot's user id is its
 * application's client id, so the id is all there is to know without the developer portal.
 */
export interface ClientApplication {
  /** The application's client id (the same as the bot's user id). */
  readonly id: Snowflake;
}

/** {@link ClientOptions} with defaults applied. */
export interface ClientOptionsResolved extends ClientOptions {
  /** The cache factory in use. */
  makeCache: CacheFactory;
}

/**
 * The entry point of a bot, shaped like discord.js's `Client`: caches (`spaces`, `rooms`,
 * `users`, `emojis`), the REST client and, once logged in, the gateway connection.
 *
 * @typeParam Ready - Whether the client is ready; `Client<true>` has non-null `user`, `readyAt`...
 * @example
 * ```ts
 * const client = new Client({ instance: process.env.STRAFE_INSTANCE });
 * client.once(Events.ClientReady, (ready) => console.log(`Ready as ${ready.user.tag}`));
 * ```
 */
export class Client<Ready extends boolean = boolean> extends TypedEmitter<ClientEvents> {
  /** The options, with defaults applied. */
  declare public readonly options: ClientOptionsResolved;
  /** Where the instance's API, gateway, web client and CDN live. */
  declare public readonly urls: InstanceURLs;
  /** The REST client (usable directly with {@link Routes}). */
  declare public readonly rest: REST;
  /** Users the client has seen. */
  declare public readonly users: UserManager;
  /** Spaces the client is in. */
  declare public readonly spaces: SpaceManager;
  /** Every known room: space rooms, threads, PMs. */
  declare public readonly rooms: RoomManager;
  /** Custom emojis of every space. */
  declare public readonly emojis: ClientEmojiManager;
  /** The gateway connection (`client.ws.ping`, `client.ws.status`). */
  declare public readonly ws: WebSocketManager;
  /** The client's account, once ready. */
  public user: If<Ready, ClientUser> = null as If<Ready, ClientUser>;
  /** When the client became ready (Unix ms). */
  public readyTimestamp: If<Ready, number> = null as If<Ready, number>;
  /**
   * The instance's federation domain (from `GET /`), used to tell local users from remote ones.
   * `null` until known; the host is used meanwhile.
   */
  public federationDomain: string | null = null;
  /** @internal */
  public _activity: APIActivity | null = null;
  /** @internal */
  public _warnedAllowedMentions = false;
  /** @internal */
  public _onActivityChange: ((activity: APIActivity | null) => void) | null = null;
  /** @internal */
  declare public _token: string | null;
  #application: ClientApplication | null = null;

  /**
   * @param options - The instance and other options.
   * @throws {@link StrafeError} `InstanceMissing` when no instance is given and `STRAFE_INSTANCE` is unset.
   */
  public constructor(options: ClientOptions = {}) {
    super();
    const urls = resolveInstanceURLs(options.instance, {
      api: options.rest?.api,
      gateway: options.ws?.gateway,
      web: options.web,
      cdn: options.cdn,
    });
    const resolved: ClientOptionsResolved = { ...options, makeCache: options.makeCache ?? Options.cacheWithLimits(Options.DefaultMakeCacheSettings) };
    const define = (key: string, value: unknown): void => {
      Object.defineProperty(this, key, { value, enumerable: false, writable: false });
    };
    define('options', resolved);
    define('urls', urls);
    define('rest', new REST({ ...options.rest, api: urls.api }));
    Object.defineProperty(this, '_token', { value: null, enumerable: false, writable: true });
    define('users', new UserManager(this));
    define('spaces', new SpaceManager(this));
    define('rooms', new RoomManager(this));
    define('emojis', new ClientEmojiManager(this));
    define('ws', new WebSocketManager(this, options.ws));
    this._onActivityChange = (activity) => {
      this.ws._sendActivity(activity);
    };
  }

  /** The token, once set by `login()`. Never logged or serialized. */
  public get token(): If<Ready, string, string | null> {
    return this._token as If<Ready, string, string | null>;
  }

  /**
   * Sets the token on the client and its REST client (a leading `Bot ` is stripped).
   *
   * @internal
   */
  public _setToken(token: string | null): void {
    this._token = token === null ? null : token.replace(/^Bot\s+/i, '').trim();
    this.rest.setToken(this._token ?? '');
  }

  /**
   * Logs in: checks the token with the REST API, reads the instance's index (federation domain,
   * CDN and advertised gateway), then connects to the gateway and resolves at READY, after
   * {@link Events.ClientReady} was emitted.
   *
   * @param token - The bot token; defaults to the `STRAFE_TOKEN` environment variable. A leading
   *   `Bot ` is accepted.
   * @returns The token, like discord.js.
   * @throws {@link StrafeError} `TokenMissing` without a token, `TokenInvalid` when the instance
   *   refuses it, `GatewayUnreachable` when the gateway cannot be reached after
   *   `ws.loginAttempts` tries, `WSConnectionExists` when already logged in, `ClientDestroyed`
   *   when `destroy()` is called meanwhile.
   * @example
   * ```ts
   * const client = new Client({ instance: process.env.STRAFE_INSTANCE });
   * client.once(Events.ClientReady, (ready) => console.log(`Ready as ${ready.user.tag}`));
   * await client.login(); // reads STRAFE_TOKEN
   * ```
   */
  public async login(token: string | undefined = readEnv('STRAFE_TOKEN')): Promise<string> {
    if (token === undefined || token.trim() === '') throw new StrafeError(ErrorCodes.TokenMissing);
    if (this.ws.status !== Status.Idle && this.ws.status !== Status.Disconnected) throw new StrafeError(ErrorCodes.WSConnectionExists);
    this._setToken(token);
    this.warnUnsupportedOptions();
    this.emit(Events.Debug, `Logging in to ${this.urls.api}`);
    try {
      const [self] = await Promise.all([
        this.rest.get<APISelfUser>(Routes.user()),
        this.fetchInstance().catch((error: unknown) => {
          this.emit(Events.Debug, `Could not read the instance index: ${error instanceof Error ? error.message : String(error)}`);
        }),
      ]);
      this._setClientUser(self);
    } catch (error) {
      this._setToken(null);
      if ((error instanceof StrafeAPIError || error instanceof HTTPError) && error.status === 401) {
        throw new StrafeError(ErrorCodes.TokenInvalid, errorDetails({ cause: error }));
      }
      throw error;
    }
    try {
      await this.ws.connect();
    } catch (error) {
      this._setToken(null);
      throw error;
    }
    return this._token ?? '';
  }

  /**
   * Closes the gateway connection and forgets the token. Caches are kept; `login()` may be called
   * again.
   */
  public destroy(): Promise<void> {
    this.ws.destroy();
    this._setToken(null);
    this.readyTimestamp = null as If<Ready, number>;
    this.emit(Events.Debug, 'Client destroyed');
    return Promise.resolve();
  }

  /** `await using client = new Client(...)` destroys the client at the end of the scope. */
  public [Symbol.asyncDispose](): Promise<void> {
    return this.destroy();
  }

  /**
   * The session ended for good (`SESSION_REVOKED`, or the token was refused on a reconnect): stops
   * the gateway without reconnecting and emits {@link Events.Invalidated}.
   *
   * @internal
   */
  public _invalidated(reason: string, error: StrafeError = new StrafeError(ErrorCodes.SessionRevoked, reason)): void {
    this.ws._invalidate(error);
    this._setToken(null);
    this.readyTimestamp = null as If<Ready, number>;
    this.emit(Events.Invalidated, reason);
  }

  /**
   * Reports an error from the library's own event handling: emitted as {@link Events.Error} when
   * something listens, else rethrown asynchronously like an unhandled `error` event.
   *
   * @internal
   */
  public _emitError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    if (this.listenerCount(Events.Error) > 0) this.emit(Events.Error, err);
    else
      queueMicrotask(() => {
        throw err;
      });
  }

  /**
   * A listener threw (or an async listener rejected): emitted as {@link Events.Error} when
   * something listens, so one failing handler never stops the gateway.
   */
  protected override onListenerError(error: unknown, event: keyof ClientEvents): void {
    if (event !== 'error' && this.listenerCount(Events.Error) > 0) {
      this.emit(Events.Error, error instanceof Error ? error : new Error(String(error)));
      return;
    }
    super.onListenerError(error, event);
  }

  /** Applies `options.presence` after the first READY. @internal */
  public _applyInitialPresence(): void {
    const presence = this.options.presence;
    const user = this.user;
    if (!presence || !user) return;
    user.setPresence(presence).catch((error: unknown) => {
      this._emitError(error);
    });
  }

  private warnUnsupportedOptions(): void {
    for (const [key, message] of Object.entries(UnsupportedOptions)) {
      if (key in this.options) this.emit(Events.Warn, message);
    }
  }

  /** The client's user id, or `null` before login. @internal */
  public get _userId(): string | null {
    return (this.user)?.id ?? null;
  }

  /**
   * The bot's application, like discord.js's `client.application`: `{ id }`, where the id is the
   * bot's user id (Strafe uses one id for both). `null` before `login()` has verified the token.
   *
   * @example
   * ```ts
   * const oauth = new OAuth2Client({ instance: process.env.STRAFE_INSTANCE, clientId: client.application.id });
   * ```
   */
  public get application(): If<Ready, ClientApplication> {
    const id = this._userId;
    if (id === null) return null as If<Ready, ClientApplication>;
    if (this.#application?.id !== id) this.#application = Object.freeze({ id });
    return this.#application as If<Ready, ClientApplication>;
  }

  /** When the client became ready. */
  public get readyAt(): If<Ready, Date> {
    return (this.readyTimestamp === null ? null : new Date(this.readyTimestamp)) as If<Ready, Date>;
  }

  /** Milliseconds since the client became ready. */
  public get uptime(): If<Ready, number> {
    return (this.readyTimestamp === null ? null : Date.now() - this.readyTimestamp) as If<Ready, number>;
  }

  /** Whether the client is ready (narrows to `Client<true>`). */
  public isReady(): this is Client<true> & this {
    return this.readyTimestamp !== null;
  }

  /**
   * Creates or patches the client's own user from `GET /users/@me` or READY.
   *
   * @internal
   */
  public _setClientUser(data: APISelfUser | APIOwnProfile | GatewayReadyData['user']): ClientUser {
    const current = this.user;
    if (current) {
      current._patch(data);
      return current;
    }
    const user = new ClientUser(this, data);
    this.user = user as If<Ready, ClientUser>;
    this.users._cache.set(user.id, user);
    return user;
  }

  /**
   * Records the activity to show ("Playing X") and hands it to the gateway, which sends it now
   * and after every reconnect.
   *
   * @internal
   */
  public _setActivity(activity: APIActivity | null): void {
    this._activity = activity;
    this._onActivityChange?.(activity);
  }

  /**
   * Fetches an invite's preview (no login needed): the space, the inviter's name and the member
   * count. An invite to a space on another instance is `code@domain`; a link from another
   * instance's web client is read the same way (`https://other.example/invite/abc` asks this
   * instance for `abc@other.example`, which it looks up over federation).
   *
   * @param code - A code, `code@domain`, an invite link, or an {@link Invite}.
   * @throws {@link StrafeTypeError} `InviteInvalid` for input that is not an invite.
   * @example
   * ```ts
   * const invite = await client.fetchInvite('https://app.strafe.chat/invite/abc123');
   * console.log(invite.spaceName, invite.memberCount);
   * ```
   */
  public async fetchInvite(code: string | Invite): Promise<Invite> {
    const clean = this.resolveInviteCode(code);
    const data = await this.rest.get<APIInvitePreview>(Routes.invite(clean), { auth: this.rest.hasToken });
    return new Invite(this, { ...data, code: clean });
  }

  /**
   * Turns a code, `code@domain`, link or {@link Invite} into the code this instance's API takes:
   * a link from another host becomes `code@host`, and this instance's own domain is dropped.
   *
   * @param invite - Code, `code@domain`, link or invite.
   * @throws {@link StrafeTypeError} `InviteInvalid` for input that is not an invite.
   */
  public resolveInviteCode(invite: string | Invite): string {
    if (typeof invite !== 'string') return invite.code;
    const parts = parseInviteCode(invite);
    const local = new Set(
      [this.federationDomain, hostOf(this.urls.web), hostOf(this.urls.api), hostOf(this.urls.origin), this.urls.domain]
        .filter((host): host is string => host !== null && host !== '')
        .map((host) => host.toLowerCase()),
    );
    let domain = parts.domain ?? parts.linkHost;
    if (domain !== null && local.has(domain)) domain = null;
    return formatInviteCode({ code: parts.code, domain });
  }

  /**
   * Builds the install link of this bot (the `bot` scope): people open it, pick a space they have
   * Manage Space in, and the bot joins with a managed role holding `permissions` (as far as they
   * may grant them). The bot's user id is its application's client id, so no lookup is needed.
   *
   * @param options - Permissions, a preselected space, extra scopes.
   * @throws {@link StrafeError} `ClientNotReady` before `login()` has verified the token.
   * @example
   * ```ts
   * const link = client.generateInvite({
   *   permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
   * });
   * ```
   */
  public generateInvite(options: InviteGenerationOptions = {}): string {
    const id = this._userId;
    if (id === null) throw new StrafeError(ErrorCodes.ClientNotReady, 'generate an invite');
    return buildBotInviteURL(this.urls.web, id, options);
  }

  /**
   * The same as {@link Client.generateInvite}: the bot's install link.
   *
   * @param options - Permissions, a preselected space, extra scopes.
   */
  public generateBotInvite(options: BotInviteOptions = {}): string {
    return this.generateInvite(options);
  }

  /**
   * Fetches the instance's public index (`GET /` of the API): version, features, services and
   * federation domain. Also records {@link Client.federationDomain}, the CDN when none was
   * configured, and the gateway URL the instance advertises when `ws.gateway` was not given.
   */
  public async fetchInstance(): Promise<APIInstanceIndex> {
    const index = await this.rest.get<APIInstanceIndex>(Routes.instance(), { auth: false });
    if (index.federation?.domain !== undefined && index.federation.domain !== '') this.federationDomain = index.federation.domain;
    const cdn = index.services?.cdn?.url;
    if (this.urls.cdn === null && this.options.cdn === undefined && cdn !== undefined && /^https?:\/\//.test(cdn)) this.urls.cdn = cdn.replace(/\/+$/, '');
    const gateway = index.services?.stargate?.url;
    if (this.options.ws?.gateway === undefined && gateway !== undefined && /^wss?:\/\//.test(gateway)) this.urls.gateway = gateway;
    return index;
  }

  /** Plain JSON (no token). */
  public toJSON(): Record<string, unknown> {
    return {
      urls: this.urls,
      user: (this.user)?.id ?? null,
      readyTimestamp: this.readyTimestamp,
      spaces: this.spaces.toJSON(),
      rooms: this.rooms.toJSON(),
      users: this.users.toJSON(),
    };
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

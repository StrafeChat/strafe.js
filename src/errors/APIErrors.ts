import type { RateLimitData, RequestBody } from '../rest/types.js';

/**
 * The `code` slugs Strafe puts in error bodies. Most errors carry only a human `error` message (and
 * many 404s/403s no code at all), so branch on `status` when there is no code:
 * `error.status === 404` is the equivalent of discord.js's `RESTJSONErrorCodes.UnknownMessage`.
 */
export const APIErrorCodes = {
  /** An embed broke a limit; `error.path` says where. */
  InvalidEmbed: 'invalid_embed',
  /** The space's verification level refused the message (bots are exempt). Body adds `requirement`, `level`. */
  VerificationLevel: 'verification_level',
  /** Automod refused the message. Body adds `rule` (`repeated` | `invite` | `mentions`). */
  AutomodBlocked: 'automod_blocked',
  /** The member's space profile cannot be edited by you. */
  CannotEditMemberProfile: 'cannot_edit_member_profile',
  /** The voice room is full. */
  RoomFull: 'room_full',
  /** The instance's official account cannot be called. */
  OfficialNoCalls: 'official_no_calls',
  /** An OAuth2 access token reached a route it may not use (403). */
  InsufficientScope: 'insufficient_scope',
  /** OAuth2: the code, refresh token or user token is invalid or expired. */
  InvalidGrant: 'invalid_grant',
  /** OAuth2: wrong client id or secret (Strafe answers 400, not 401). */
  InvalidClient: 'invalid_client',
  /** OAuth2: unknown or disallowed scope. */
  InvalidScope: 'invalid_scope',
  /** OAuth2: the access token is invalid or expired. */
  InvalidToken: 'invalid_token',
  /** OAuth2: a parameter is missing or malformed. */
  InvalidRequest: 'invalid_request',
  /** OAuth2: the grant type is not supported. */
  UnsupportedGrantType: 'unsupported_grant_type',
  /** OAuth2: the person denied the request. */
  AccessDenied: 'access_denied',
  /** OAuth2: server error. */
  ServerError: 'server_error',

  /** A webhook, `username` or bridged-user name is refused; `reason`: `empty`, `length`, `characters`, `reserved`, `staff`, `role`. */
  InvalidName: 'invalid_name',
  /** A webhook or bridge avatar is not a PNG, JPEG, GIF or WebP `data:` URI within the size limit. */
  InvalidAvatar: 'invalid_avatar',
  /** `allowed_mentions` is malformed (a kind both in `parse` and listed by id). */
  InvalidAllowedMentions: 'invalid_allowed_mentions',
  /** A field Strafe does not take (`poll`, `thread_name`, `applied_tags`, an unknown flag); `field` names it. */
  UnsupportedField: 'unsupported_field',
  /** A webhook or bridge send with no content, embeds or files. */
  EmptyMessage: 'empty_message',
  /** A permission write names a bit the instance does not define (or is negative, or at least 2^53). */
  UnknownPermissionBits: 'unknown_permission_bits',
  /** `thread_id` is not a thread of the webhook's room. */
  ThreadNotInRoom: 'thread_not_in_room',
  /** The thread is locked. */
  ThreadLocked: 'thread_locked',
  /** A wrong or reset webhook token (401). */
  InvalidWebhookToken: 'invalid_webhook_token',
  /** A permission is missing; `permission` names it. */
  MissingPermissions: 'missing_permissions',
  /** The room is end-to-end encrypted: no webhooks or bridges there (409 on create, 403 on send). */
  RoomEncrypted: 'room_encrypted',
  /** The webhook is gone. */
  UnknownWebhook: 'unknown_webhook',
  /** The message is not this webhook's or bridge's (or is gone). */
  UnknownMessage: 'unknown_message',
  /** The room has 15 webhooks or the space 200; `max` and `scope` say which. */
  WebhookLimit: 'webhook_limit',
  /** Webhooks and bridges live only in a space's text rooms. */
  InvalidRoom: 'invalid_room',
  /** A webhook or bridge of a mirrored space is managed on the instance hosting it. */
  ManagedOnOrigin: 'managed_on_origin',
  /** A webhook, bridge, bridged user or room budget is spent; `retry_after` and `scope` say which. */
  RateLimited: 'rate_limited',
  /** Slowmode, applied to each bridged user on their own (429, `scope: "puppet"`). */
  Slowmode: 'slowmode',
  /** `platform` is not one of the known platforms (or `other` without `platform_name`). */
  InvalidPlatform: 'invalid_platform',
  /** `remote` is not `{ name, url? }`. */
  InvalidRemote: 'invalid_remote',
  /** `external_user` is missing an id or a name. */
  InvalidExternalUser: 'invalid_external_user',
  /** `external_message_id` is not 1-256 printable ASCII characters. */
  InvalidExternalMessageId: 'invalid_external_message_id',
  /** `part` is not 0-9. */
  InvalidPart: 'invalid_part',
  /** `profile_url` is not an `https://` URL of at most 512 characters. */
  InvalidProfileURL: 'invalid_profile_url',
  /** A bridge state other than `active` or `paused`. */
  InvalidState: 'invalid_state',
  /** A reaction emoji the server does not take. */
  InvalidReaction: 'invalid_reaction',
  /** Bridges are made by the bot that drives them (token-driven bridges are not available yet). */
  DriverUnsupported: 'driver_unsupported',
  /** Only the bot driving the bridge may do that. */
  NotDriver: 'not_driver',
  /** The bridge is paused or disabled; `state` and `state_reason` say why. */
  BridgeInactive: 'bridge_inactive',
  /** `@everyone` cannot send in the room, so neither can bridged users: the bridge is one-way. */
  PuppetCannotSend: 'puppet_cannot_send',
  /** A moderator blocked this bridged user from the bridge. */
  PuppetBlocked: 'puppet_blocked',
  /** Bridged users may only react with the space's own custom emoji. */
  ExternalEmoji: 'external_emoji',
  /** The bridge is gone. */
  UnknownBridge: 'unknown_bridge',
  /** The external message id is not in the bridge's map (never posted, or the entry expired after 30 days). */
  UnknownExternalMessage: 'unknown_external_message',
  /** The bridged user is not known to the bridge. */
  UnknownPuppet: 'unknown_puppet',
  /** The room has 3 bridges or the space 20; `max` and `scope` say which. */
  BridgeLimit: 'bridge_limit',
  /** The room is not open to everyone in the space: pass `acknowledgePrivate`; `audience` says how many can see it. */
  PrivateRoomAckRequired: 'private_room_ack_required',
  /** That external message id already maps to another message. */
  ExternalMessageConflict: 'external_message_conflict',
  /** A send with this external message id is still being written; retry shortly. */
  SendInProgress: 'send_in_progress',
  /** The instance cannot run bridges right now. */
  BridgesUnavailable: 'bridges_unavailable',
} as const;

/** One of the {@link APIErrorCodes} values (or any other slug a newer server sends). */
export type APIErrorCode = (typeof APIErrorCodes)[keyof typeof APIErrorCodes] | (string & {});

/** The JSON error body Strafe returns: `{ "error": "...", "code"?: "...", ... }`. */
export interface APIErrorBody {
  /** Human-readable message (for OAuth2 endpoints: the RFC 6749 error code). */
  error: string;
  /** Machine-readable slug, when the server sets one. */
  code?: string;
  /** OAuth2 detail. */
  error_description?: string;
  /** Embed errors: where the problem is. */
  path?: string;
  /** 429s: seconds to wait. */
  retry_after?: number;
  /** 413 attachment too large: the instance's limit. */
  max_bytes?: number;
  /** Any other field the server adds (`requirement`, `level`, `rule`...). */
  [key: string]: unknown;
}

/**
 * An error response from the Strafe API (any non-2xx status with a JSON body).
 *
 * @example
 * ```ts
 * try { await message.delete(); }
 * catch (error) {
 *   if (error instanceof StrafeAPIError && error.status === 404) return; // already gone
 *   throw error;
 * }
 * ```
 */
export class StrafeAPIError extends Error {
  /** HTTP status. */
  public readonly status: number;
  /** HTTP method of the request. */
  public readonly method: string;
  /** Full URL of the request. */
  public readonly url: string;
  /**
   * The body's `code` slug (e.g. `invalid_embed`, `automod_blocked`), or for OAuth2 endpoints the
   * RFC 6749 `error` (e.g. `invalid_grant`). `null` when the server sent none.
   */
  public readonly code: APIErrorCode | null;
  /** Where in the request the problem is (embed errors), when the server says. */
  public readonly path: string | null;
  /** Seconds to wait, on 429s. */
  public readonly retryAfter: number | null;
  /** The parsed error body. */
  public readonly rawError: APIErrorBody;
  /** What was sent. */
  public readonly requestBody: RequestBody;

  /**
   * @param rawError - Parsed JSON error body.
   * @param status - HTTP status.
   * @param method - HTTP method.
   * @param url - Request URL.
   * @param requestBody - What was sent.
   */
  public constructor(rawError: APIErrorBody, status: number, method: string, url: string, requestBody: RequestBody) {
    const isOAuth = typeof rawError.error === 'string' && /^[a-z_]+$/.test(rawError.error) && rawError.code === undefined;
    const description = typeof rawError.error_description === 'string' ? rawError.error_description : undefined;
    super(
      description
        ? `${rawError.error}: ${description}`
        : typeof rawError.error === 'string' && rawError.error.length > 0
          ? rawError.error
          : `${status} ${method} ${url}`,
    );
    this.status = status;
    this.method = method;
    this.url = url;
    this.code = typeof rawError.code === 'string' ? rawError.code : isOAuth ? rawError.error : null;
    this.path = typeof rawError.path === 'string' ? rawError.path : null;
    this.retryAfter = typeof rawError.retry_after === 'number' ? rawError.retry_after : null;
    this.rawError = rawError;
    this.requestBody = requestBody;
  }

  /** `StrafeAPIError[code]` (or `StrafeAPIError[status]`). */
  public override get name(): string {
    return `StrafeAPIError[${this.code ?? this.status}]`;
  }
}

/**
 * A {@link StrafeAPIError} from a webhook route (`/webhooks/...`, `/rooms/:id/webhooks`,
 * `/spaces/:id/webhooks`), with the extra fields its codes carry read out.
 *
 * @example
 * ```ts
 * try { await room.createWebhook({ name: 'Admin' }); }
 * catch (error) {
 *   if (error instanceof WebhookAPIError && error.code === APIErrorCodes.InvalidName) console.log(error.nameReason);
 * }
 * ```
 */
export class WebhookAPIError extends StrafeAPIError {
  /** `missing_permissions`: the permission that is missing (`Manage Webhooks`...), else `null`. */
  public get permission(): string | null {
    return stringField(this.rawError, 'permission');
  }

  /** `invalid_name`: why (`empty`, `length`, `characters`, `reserved`, `staff`, `role`), else `null`. */
  public get nameReason(): string | null {
    return this.code === APIErrorCodes.InvalidName ? stringField(this.rawError, 'reason') : null;
  }

  /** `unsupported_field`: the field, else `null`. */
  public get field(): string | null {
    return stringField(this.rawError, 'field');
  }

  /** `webhook_limit` / `bridge_limit`: the limit, else `null`. */
  public get max(): number | null {
    return typeof this.rawError.max === 'number' ? this.rawError.max : null;
  }

  /**
   * The scope the server named: `room` or `space` for a limit; `webhook`, `room`, `bridge`,
   * `puppet` or `token` for a 429. `null` when none.
   */
  public get scope(): string | null {
    return stringField(this.rawError, 'scope');
  }

  /** `WebhookAPIError[code]`. */
  public override get name(): string {
    return `WebhookAPIError[${this.code ?? this.status}]`;
  }
}

/**
 * A {@link StrafeAPIError} from a bridge route (`/bridges/...`, `/rooms/:id/bridges`), with the
 * extra fields its codes carry read out. Bridges are a kind of webhook, so this is also a
 * {@link WebhookAPIError}.
 *
 * @example
 * ```ts
 * try { await bridge.send({ externalUser, externalMessageId, content }); }
 * catch (error) {
 *   if (error instanceof BridgeAPIError && error.code === APIErrorCodes.PuppetBlocked) return; // tell the other side
 *   throw error;
 * }
 * ```
 */
export class BridgeAPIError extends WebhookAPIError {
  /** `bridge_inactive`: the bridge's state (`paused`, `disabled`), else `null`. */
  public get state(): string | null {
    return stringField(this.rawError, 'state');
  }

  /** `bridge_inactive`: why it is not running (`paused_by_manager`, `became_private`...), else `null`. */
  public get stateReason(): string | null {
    return stringField(this.rawError, 'state_reason');
  }

  /** `private_room_ack_required`: how many people can see the room, else `null`. */
  public get audience(): number | null {
    return typeof this.rawError.audience === 'number' ? this.rawError.audience : null;
  }

  /** `BridgeAPIError[code]`. */
  public override get name(): string {
    return `BridgeAPIError[${this.code ?? this.status}]`;
  }
}

function stringField(body: APIErrorBody, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' ? value : null;
}

/**
 * An HTTP error whose body is not Strafe JSON, such as a reverse proxy's 502 page or a plain-text
 * `Too Many Requests`.
 */
export class HTTPError extends Error {
  /** HTTP status. */
  public readonly status: number;
  /** HTTP status text. */
  public readonly statusText: string;
  /** HTTP method of the request. */
  public readonly method: string;
  /** Full URL of the request. */
  public readonly url: string;
  /** The body as text (may be empty). */
  public readonly body: string;
  /** What was sent. */
  public readonly requestBody: RequestBody;

  /**
   * @param status - HTTP status.
   * @param statusText - HTTP status text.
   * @param method - HTTP method.
   * @param url - Request URL.
   * @param body - Response body text.
   * @param requestBody - What was sent.
   */
  public constructor(status: number, statusText: string, method: string, url: string, body: string, requestBody: RequestBody) {
    super(statusText || `HTTP ${status}`);
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
    this.body = body;
    this.requestBody = requestBody;
  }

  /** `HTTPError`. */
  public override get name(): string {
    return 'HTTPError';
  }
}

/**
 * Thrown instead of waiting when a request hits a rate limit and `rejectOnRateLimit` matches it, or
 * when the wait is longer than `maxRetryAfter` (a long slowmode, for example).
 */
export class RateLimitError extends Error implements RateLimitData {
  /** Milliseconds until the limit resets. */
  public readonly timeToReset: number;
  /** Requests allowed per window (0 when unknown). */
  public readonly limit: number;
  /** HTTP method. */
  public readonly method: string;
  /** Route template, e.g. `/rooms/:id/messages`. */
  public readonly hash: string;
  /** Full URL. */
  public readonly url: string;
  /** Route template, e.g. `/rooms/:id/messages`. */
  public readonly route: string;
  /** The room or space id the request was queued under. */
  public readonly majorParameter: string;
  /** Always false: Strafe has no global limit. */
  public readonly global: boolean;
  /** `user` for the account's per-route limit, `shared` for one room, webhook, bridge or bridged user. */
  public readonly scope: RateLimitData['scope'];
  /** The server's name for the limit (`webhook`, `room`, `bridge`, `puppet`, `token`), or `null`. */
  public readonly serverScope: string | null;
  /** Milliseconds to wait (same as `timeToReset`). */
  public readonly retryAfter: number;
  /** Always 0 (no sub-limits). */
  public readonly sublimitTimeout: number;

  /**
   * @param data - The rate limit that was hit.
   */
  public constructor(data: RateLimitData) {
    super(`Rate limited on ${data.method} ${data.route}: retry in ${data.timeToReset} ms`);
    this.timeToReset = data.timeToReset;
    this.limit = data.limit;
    this.method = data.method;
    this.hash = data.hash;
    this.url = data.url;
    this.route = data.route;
    this.majorParameter = data.majorParameter;
    this.global = data.global;
    this.scope = data.scope;
    this.serverScope = data.serverScope ?? null;
    this.retryAfter = data.retryAfter;
    this.sublimitTimeout = data.sublimitTimeout;
  }

  /** `RateLimitError`. */
  public override get name(): string {
    return 'RateLimitError';
  }
}

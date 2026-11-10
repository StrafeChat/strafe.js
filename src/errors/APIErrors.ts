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
  /** Always `user`: limits are per account (or per IP for a few routes). */
  public readonly scope: RateLimitData['scope'];
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
    this.retryAfter = data.retryAfter;
    this.sublimitTimeout = data.sublimitTimeout;
  }

  /** `RateLimitError`. */
  public override get name(): string {
    return 'RateLimitError';
  }
}

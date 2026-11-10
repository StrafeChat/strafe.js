/** HTTP methods the API uses. */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A path relative to the API base, starting with `/` (what {@link Routes} returns). */
export type RouteLike = `/${string}`;

/** The authorization scheme: `Bot` for bot tokens, `Bearer` for OAuth2 access tokens. */
export type AuthPrefix = 'Bot' | 'Bearer';

/** A function with `fetch`'s shape, injectable for tests, proxies or a custom dispatcher. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Raw data for a file part of a multipart request. */
export type RawFileData = Blob | ArrayBuffer | ArrayBufferView | string | ReadableStream<Uint8Array>;

/** A file to upload with a request. */
export interface RawFile {
  /** File name the server sees (Strafe sanitizes it: `[^A-Za-z0-9._-]` becomes `_`). */
  name: string;
  /** The bytes. A string is sent as its UTF-8 text, not read as a path. */
  data: RawFileData;
  /** The form field. Strafe's upload routes read `file` (the default). */
  key?: string;
  /** MIME type; guessed by the server from the extension when omitted. */
  contentType?: string;
}

/** Explicit credentials for one request, overriding the REST instance's token. */
export interface AuthData {
  /** The scheme. */
  prefix: AuthPrefix;
  /** The token. */
  token: string;
}

/** Options for one request (the second argument of `rest.get/post/...`). */
export interface RequestData {
  /**
   * The JSON body. Serialized with `JSON.stringify`; `bigint`s (permission bitfields) become JSON
   * numbers, as Strafe expects. With `files`, each top-level key becomes a form field instead.
   */
  body?: unknown;
  /** Files to send as `multipart/form-data`. */
  files?: readonly RawFile[];
  /** Query string parameters; `undefined`/`null` values are left out. */
  query?: URLSearchParams | Record<string, string | number | boolean | null | undefined>;
  /**
   * Whether to send the token (default true), or explicit credentials. Set false for public routes
   * (`GET /`, invite previews). A request with explicit credentials (a person's OAuth2 access
   * token) is another account: it skips the queues and rate-limit budget of the REST instance's own
   * token, and only waits out its own 429s.
   */
  auth?: boolean | AuthData;
  /** Extra headers. */
  headers?: Record<string, string>;
  /**
   * An audit-log reason. Strafe has no reason header; only ban stores a reason, and the ban helper
   * puts it in the body. Accepted here so discord.js-shaped code compiles, and otherwise ignored.
   */
  reason?: string | undefined;
  /** Send `body` as is (a `URLSearchParams`, `FormData`, `Blob`...) instead of as JSON. */
  passThroughBody?: boolean;
  /** Abort the request. */
  signal?: AbortSignal | undefined;
  /** Milliseconds before the request is aborted; overrides the REST option. */
  timeout?: number;
  /** Return the raw `Response` instead of the parsed body (the body is not read). */
  raw?: boolean;
  /** Put the request in the queue of this id instead of the route's first id (advanced). */
  majorParameter?: string;
  /**
   * Top-level body fields holding secrets (a person's access token, an OAuth2 code). They are sent
   * as given, but show as `[redacted]` wherever the request is reported: errors' `requestBody` and
   * the `response` event. Works on JSON objects and form-encoded bodies.
   */
  redact?: readonly string[];
}

/** A request as the REST manager handles it. */
export interface InternalRequest extends RequestData {
  /** HTTP method. */
  method: RequestMethod;
  /** Path relative to the API base. */
  fullRoute: RouteLike;
}

/** What was sent, attached to errors for debugging. */
export interface RequestBody {
  /** The JSON body, when there was one. */
  json: unknown;
  /** The files, when there were any. */
  files: readonly RawFile[] | undefined;
}

/** Details of a rate limit, passed to the `rateLimited` event and to `rejectOnRateLimit`. */
export interface RateLimitData {
  /** Milliseconds until the request may be sent. */
  timeToReset: number;
  /** Requests allowed per window (0 when the server did not say). */
  limit: number;
  /** HTTP method. */
  method: string;
  /** Bucket key: the route template (`/rooms/:id/messages`). */
  hash: string;
  /** Full URL. */
  url: string;
  /** Route template. */
  route: string;
  /** The room or space id the request was queued under (`global` when none). */
  majorParameter: string;
  /** Always false: Strafe has no global limit. */
  global: boolean;
  /**
   * `user`: the route's per-account limit (a few routes count per IP; reported the same way).
   * `shared`: a limit on one room, such as slowmode; only that room's queue waits.
   */
  scope: 'user' | 'global' | 'shared';
  /** Milliseconds to wait. */
  retryAfter: number;
  /** Always 0. */
  sublimitTimeout: number;
}

/** Information about a finished request, passed to the `response` event. */
export interface APIRequest {
  /** HTTP method. */
  method: RequestMethod;
  /** Path relative to the API base. */
  path: RouteLike;
  /** Route template used as the bucket key. */
  route: string;
  /** Full URL. */
  url: string;
  /** What was sent. */
  data: RequestBody;
  /** Attempt number, starting at 0. */
  retries: number;
}

/** Events emitted by {@link REST}. */
export interface RESTEventsMap {
  /** A request is waiting for a rate limit (or a 429 arrived). */
  rateLimited: [data: RateLimitData];
  /** A response arrived (before its body is parsed; the response is a clone). */
  response: [request: APIRequest, response: Response];
  /** Diagnostic text. */
  debug: [message: string];
}

/** Names of the events {@link REST} emits, like discord.js's `RESTEvents`. */
export const RESTEvents = {
  /** A request is waiting for a rate limit (or a 429 arrived). */
  RateLimited: 'rateLimited',
  /** A response arrived. */
  Response: 'response',
  /** Diagnostic text. */
  Debug: 'debug',
} as const;

/** Options for {@link REST}. */
export interface RESTOptions {
  /**
   * The instance: a domain (`app.strafe.chat`) or URL. The API base is derived from it
   * (`https://app.strafe.chat/api`). Falls back to the `STRAFE_INSTANCE` environment variable.
   */
  instance?: string | undefined;
  /** The API base URL, overriding what `instance` derives (`http://localhost:4000` in development). */
  api?: string | undefined;
  /** Scheme for the token. Default `Bot`. */
  authPrefix: AuthPrefix;
  /** Retries after a network error, timeout or 5xx. Default 3. 429s are always waited out and do not count. */
  retries: number;
  /**
   * Milliseconds before a request is aborted. Default 15 000, and at least 120 000 for uploads. A
   * function decides per request.
   */
  timeout: number | ((route: string, method: RequestMethod, hasFiles: boolean) => number);
  /** Extra milliseconds added to every rate-limit wait. Default 50. */
  offset: number;
  /**
   * Reject with {@link RateLimitError} instead of waiting: `true` for every route, a list of route
   * prefixes (`['/rooms']`), or a function deciding per limit. Default: never.
   */
  rejectOnRateLimit: boolean | readonly string[] | ((data: RateLimitData) => boolean | Promise<boolean>) | null;
  /**
   * The longest wait (ms) the queue accepts; a longer 429 (a long slowmode, say) rejects with
   * {@link RateLimitError} instead of stalling every later message to that room. Default 60 000.
   */
  maxRetryAfter: number;
  /** Text appended to the User-Agent. */
  userAgentAppendix: string;
  /** Headers sent with every request. */
  headers: Record<string, string>;
  /** The `fetch` to use. Default: the global one. */
  makeRequest: FetchLike | undefined;
}

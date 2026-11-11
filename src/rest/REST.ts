import { HTTPError, RateLimitError, StrafeAPIError, type APIErrorBody } from '../errors/APIErrors.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeTypeError, errorDetails } from '../errors/StrafeError.js';
import { TypedEmitter } from '../util/EventEmitter.js';
import { resolveInstanceURLs } from '../util/instance.js';
import { version } from '../util/version.js';
import { AsyncQueue, RateLimitBucket } from './Bucket.js';
import { bigintReplacer, buildFormData } from './multipart.js';
import { majorParameter, routeTemplate } from './Routes.js';
import type {
  APIRequest,
  FetchLike,
  InternalRequest,
  RateLimitData,
  RequestBody,
  RequestData,
  RequestMethod,
  RESTEventsMap,
  RESTOptions,
  RouteLike,
} from './types.js';

/** Default {@link RESTOptions}. */
export const DefaultRestOptions = {
  authPrefix: 'Bot',
  retries: 3,
  timeout: 15_000,
  offset: 50,
  rejectOnRateLimit: null,
  maxRetryAfter: 60_000,
  userAgentAppendix: '',
  headers: {},
  makeRequest: undefined,
} as const satisfies Omit<RESTOptions, 'instance' | 'api'>;

/** Minimum timeout for uploads when `timeout` is a number. */
const UPLOAD_TIMEOUT = 120_000;

/** Connection errors that happen before a request reaches the server, so even a POST may be retried. */
const PRE_SEND_ERRORS = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT']);

const IDEMPOTENT = new Set<RequestMethod>(['GET', 'PUT', 'DELETE']);

/** Above this many rate-limit buckets, idle ones whose window is over are dropped (they only hold what the next response teaches again). */
const MAX_IDLE_BUCKETS = 256;

class TimeoutError extends Error {}

/**
 * The Strafe REST client: queues, rate limits, retries and errors handled for you. `client.rest` is
 * one; it also works on its own.
 *
 * - Every route has one budget per account (Strafe's limiter), learned from `X-RateLimit-*`.
 * - Requests to the same route and room (or space) run one at a time, in order, so messages to a
 *   room arrive in the order they were sent; other rooms are not held up.
 * - A 429 waits out `Retry-After` and retries (not counted as a retry); one longer than
 *   `maxRetryAfter` (a long slowmode) rejects with {@link RateLimitError}.
 * - Network errors, timeouts and 5xx are retried with backoff for GET/PUT/DELETE. POST and PATCH
 *   are retried only on 503 and on errors before the request was sent: Strafe has no idempotency
 *   key, so retrying a POST could post a message twice (discord.js retries them; this does not).
 *
 * @remarks
 * Coming from discord.js: the counterpart of `@discordjs/rest`.
 *
 * @example
 * ```ts
 * const rest = new REST({ instance: 'app.strafe.chat' }).setToken(process.env.STRAFE_TOKEN!);
 * const me = await rest.get<APISelfUser>(Routes.user());
 * await rest.post(Routes.roomMessages(roomId), { body: { plaintext: `Hello from ${me.username}` } });
 * ```
 */
export class REST extends TypedEmitter<RESTEventsMap> {
  /** The resolved options. */
  public readonly options: Readonly<RESTOptions>;
  /** The API base URL, without a trailing slash. */
  public readonly api: string;

  // A real private field: unlike a TypeScript `private` property it is not enumerable, so
  // `console.log(rest)`, `util.inspect()` and `JSON.stringify()` never print the token.
  #token: string | null = null;
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly queues = new Map<string, AsyncQueue>();

  /**
   * @param options - Instance or API URL, retries, timeouts, rate-limit behaviour, fetch injection.
   * @throws {@link StrafeError} `InstanceMissing` when neither `instance`, `api` nor `STRAFE_INSTANCE` is set.
   */
  public constructor(options: Partial<RESTOptions> = {}) {
    super();
    this.options = { ...DefaultRestOptions, ...stripUndefined(options) };
    this.api = trimSlash(options.api ?? resolveInstanceURLs(options.instance).api);
  }

  /**
   * Sets the token. A leading `Bot ` or `Bearer ` is stripped (the scheme comes from `authPrefix`).
   *
   * @param token - The bot token (or an OAuth2 access token with `authPrefix: 'Bearer'`).
   */
  public setToken(token: string): this {
    this.#token = token.replace(/^(Bot|Bearer)\s+/i, '').trim();
    return this;
  }

  /** Whether a token is set. */
  public get hasToken(): boolean {
    return this.#token !== null && this.#token.length > 0;
  }

  /**
   * `GET` a route.
   *
   * @param route - Path from {@link Routes}.
   * @param options - Query, auth, headers, signal...
   */
  public get<T = unknown>(route: RouteLike, options: RequestData = {}): Promise<T> {
    return this.request<T>({ ...options, method: 'GET', fullRoute: route });
  }

  /**
   * `POST` to a route.
   *
   * @param route - Path from {@link Routes}.
   * @param options - Body, files, query, auth, headers, signal...
   */
  public post<T = unknown>(route: RouteLike, options: RequestData = {}): Promise<T> {
    return this.request<T>({ ...options, method: 'POST', fullRoute: route });
  }

  /**
   * `PUT` a route.
   *
   * @param route - Path from {@link Routes}.
   * @param options - Body, query, auth, headers, signal...
   */
  public put<T = unknown>(route: RouteLike, options: RequestData = {}): Promise<T> {
    return this.request<T>({ ...options, method: 'PUT', fullRoute: route });
  }

  /**
   * `PATCH` a route.
   *
   * @param route - Path from {@link Routes}.
   * @param options - Body, query, auth, headers, signal...
   */
  public patch<T = unknown>(route: RouteLike, options: RequestData = {}): Promise<T> {
    return this.request<T>({ ...options, method: 'PATCH', fullRoute: route });
  }

  /**
   * `DELETE` a route.
   *
   * @param route - Path from {@link Routes}.
   * @param options - Body, query, auth, headers, signal...
   */
  public delete<T = unknown>(route: RouteLike, options: RequestData = {}): Promise<T> {
    return this.request<T>({ ...options, method: 'DELETE', fullRoute: route });
  }

  /**
   * Sends a request through its queue. Resolves with the parsed JSON body (`undefined` for an empty
   * body such as a 204), or the raw `Response` with `raw: true`.
   *
   * @param request - Method, route and options.
   * @throws {@link StrafeAPIError} for an API error, {@link HTTPError} for a non-JSON error,
   *   {@link RateLimitError} when a rate limit is rejected, {@link StrafeError} for a missing token or an abort,
   *   {@link StrafeTypeError} `RouteInvalid` for a path with a `.`/`..` segment or a backslash.
   */
  public async request<T = unknown>(request: InternalRequest): Promise<T> {
    assertRoute(request.fullRoute);
    const route = routeTemplate(request.fullRoute);
    const bucketKey = `${request.method} ${route}`;
    const major = request.majorParameter ?? majorParameter(request.fullRoute);
    if (typeof request.auth === 'object') {
      // Another account's credentials (an OAuth2 access token): Strafe counts its limits per
      // account, so it neither shares the instance token's budget nor waits in its queues. Its
      // own 429s are still waited out.
      return (await this.run(request, route, major, new RateLimitBucket())) as T;
    }
    const queueKey = `${bucketKey}:${major}`;
    let queue = this.queues.get(queueKey);
    if (!queue) {
      queue = new AsyncQueue();
      this.queues.set(queueKey, queue);
    }
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = new RateLimitBucket();
      this.buckets.set(bucketKey, bucket);
    }
    bucket.users++;
    await queue.wait();
    try {
      return (await this.run(request, route, major, bucket)) as T;
    } finally {
      bucket.users--;
      queue.shift();
      if (queue.size === 0) this.queues.delete(queueKey);
      if (this.buckets.size > MAX_IDLE_BUCKETS) this.sweepBuckets();
    }
  }

  /** Drops buckets no request is using whose window is over, so the map cannot grow without bound. */
  private sweepBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.users === 0 && bucket.inFlight === 0 && bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  private async run(request: InternalRequest, route: string, major: string, bucket: RateLimitBucket): Promise<unknown> {
    const url = this.buildURL(request);
    const headers = this.buildHeaders(request);
    const requestBody: RequestBody = { json: request.files ? undefined : redactFields(request.body, request.redact), files: request.files };
    const fetchFn = this.fetch();
    const hasFiles = request.files !== undefined && request.files.length > 0;
    const timeout = this.timeoutFor(request, route, hasFiles);
    let retries = 0;

    for (;;) {
      throwIfAborted(request, url);
      for (;;) {
        const wait = bucket.delay(Date.now());
        if (wait <= 0) break;
        const data = this.rateLimitData(request, route, major, url, wait, bucket.limit, 'user');
        await this.onRateLimit(data);
        await pause(wait + this.options.offset, request, url);
      }

      const body = await this.buildBody(request, headers);
      bucket.take();
      let response: Response;
      try {
        const init: RequestInit = body === undefined ? { method: request.method, headers } : { method: request.method, headers, body };
        response = await this.fetchWithTimeout(fetchFn, url, init, timeout, request.signal);
      } catch (error) {
        bucket.release();
        if (request.signal?.aborted) {
          throw new StrafeError(ErrorCodes.RequestAborted, request.method, url, errorDetails({ cause: error }));
        }
        if (retries < this.options.retries && this.canRetryError(request.method, error)) {
          retries++;
          this.emit('debug', `[REST] ${request.method} ${route} failed (${describe(error)}); retry ${retries}/${this.options.retries}`);
          await pause(backoff(retries), request, url);
          continue;
        }
        if (error instanceof TimeoutError) {
          throw new StrafeError(ErrorCodes.RequestAborted, request.method, url, errorDetails({ cause: error }));
        }
        throw error;
      }

      const now = Date.now();
      bucket.update(response.headers, now);
      if (this.listenerCount('response') > 0) {
        const info: APIRequest = { method: request.method, path: request.fullRoute, route, url, data: requestBody, retries };
        this.emit('response', info, response.clone());
      }

      if (response.status === 429) {
        const text = await response.text();
        const parsed = parseJSON(text) as APIErrorBody | undefined;
        const retryAfterMs = retryAfterOf(response.headers, parsed);
        const remaining = Number(response.headers.get('x-ratelimit-remaining'));
        const perRoom =
          (typeof parsed?.error === 'string' && /slowmode/i.test(parsed.error)) ||
          (response.headers.has('x-ratelimit-remaining') && Number.isFinite(remaining) && remaining > 0);
        if (!perRoom) bucket.block(retryAfterMs, now);
        const data = this.rateLimitData(request, route, major, url, retryAfterMs, bucket.limit, perRoom ? 'shared' : 'user');
        this.emit('debug', `[REST] 429 on ${request.method} ${route} (${perRoom ? 'slowmode' : 'rate limit'}); waiting ${retryAfterMs} ms`);
        await this.onRateLimit(data);
        await pause(retryAfterMs + this.options.offset, request, url);
        continue;
      }

      if (response.status >= 500 && retries < this.options.retries && this.canRetryStatus(request.method, response.status)) {
        retries++;
        await response.arrayBuffer().catch(() => undefined);
        this.emit('debug', `[REST] ${request.method} ${route} answered ${response.status}; retry ${retries}/${this.options.retries}`);
        await pause(backoff(retries), request, url);
        continue;
      }

      if (!response.ok) throw await toError(response, request.method, url, requestBody);
      if (request.raw === true) return response;
      return parseBody(response);
    }
  }

  private fetch(): FetchLike {
    const fetchFn = this.options.makeRequest ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (fetchFn === undefined) throw new StrafeError(ErrorCodes.UnsupportedRuntime, 'fetch');
    return fetchFn;
  }

  private buildURL(request: InternalRequest): string {
    let url = `${this.api}${request.fullRoute}`;
    if (request.query !== undefined) {
      const params =
        request.query instanceof URLSearchParams
          ? request.query
          : new URLSearchParams(
              Object.entries(request.query)
                .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null)
                .map(([key, value]): [string, string] => [key, String(value)]),
            );
      const query = params.toString();
      if (query.length > 0) url += `${url.includes('?') ? '&' : '?'}${query}`;
    }
    return url;
  }

  private buildHeaders(request: InternalRequest): Record<string, string> {
    const appendix = this.options.userAgentAppendix ? ` ${this.options.userAgentAppendix}` : '';
    const headers: Record<string, string> = {
      'User-Agent': `StrafeBot (https://github.com/StrafeChat/strafe.js, ${version})${appendix}`,
      ...this.options.headers,
      ...request.headers,
    };
    if (request.auth !== false) {
      if (typeof request.auth === 'object') {
        headers.Authorization = `${request.auth.prefix} ${request.auth.token}`;
      } else {
        if (!this.hasToken) throw new StrafeError(ErrorCodes.TokenMissing);
        headers.Authorization = `${this.options.authPrefix} ${this.#token ?? ''}`;
      }
    }
    return headers;
  }

  private async buildBody(request: InternalRequest, headers: Record<string, string>): Promise<RequestInit['body']> {
    if (request.files !== undefined && request.files.length > 0) {
      delete headers['Content-Type'];
      return buildFormData(request.files, request.body);
    }
    if (request.body === undefined) return undefined;
    if (request.passThroughBody === true) return request.body as RequestInit['body'];
    headers['Content-Type'] = 'application/json';
    return JSON.stringify(request.body, bigintReplacer);
  }

  private timeoutFor(request: InternalRequest, route: string, hasFiles: boolean): number {
    if (request.timeout !== undefined) return request.timeout;
    const { timeout } = this.options;
    if (typeof timeout === 'function') return timeout(route, request.method, hasFiles);
    return hasFiles ? Math.max(timeout, UPLOAD_TIMEOUT) : timeout;
  }

  private async fetchWithTimeout(fetchFn: FetchLike, url: string, init: RequestInit, timeout: number, signal: AbortSignal | undefined): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new TimeoutError(`Request timed out after ${timeout} ms`));
    }, timeout);
    const onAbort = (): void => {
      controller.abort(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await fetchFn(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.reason instanceof TimeoutError) throw new TimeoutError(`Request timed out after ${timeout} ms`, { cause: error });
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  private canRetryError(method: RequestMethod, error: unknown): boolean {
    if (IDEMPOTENT.has(method)) return true;
    if (error instanceof TimeoutError) return false;
    const code = errorCode(error);
    return code !== undefined && PRE_SEND_ERRORS.has(code);
  }

  private canRetryStatus(method: RequestMethod, status: number): boolean {
    if (IDEMPOTENT.has(method)) return status === 500 || status === 502 || status === 503 || status === 504;
    return status === 503;
  }

  private rateLimitData(
    request: InternalRequest,
    route: string,
    major: string,
    url: string,
    wait: number,
    limit: number,
    scope: RateLimitData['scope'],
  ): RateLimitData {
    return {
      timeToReset: wait,
      limit,
      method: request.method,
      hash: `${request.method} ${route}`,
      url,
      route,
      majorParameter: major,
      global: false,
      scope,
      retryAfter: wait,
      sublimitTimeout: 0,
    };
  }

  private async onRateLimit(data: RateLimitData): Promise<void> {
    if (data.timeToReset > this.options.maxRetryAfter || (await this.shouldReject(data))) throw new RateLimitError(data);
    this.emit('rateLimited', data);
  }

  private async shouldReject(data: RateLimitData): Promise<boolean> {
    const { rejectOnRateLimit } = this.options;
    if (rejectOnRateLimit === null || rejectOnRateLimit === false) return false;
    if (rejectOnRateLimit === true) return true;
    if (typeof rejectOnRateLimit === 'function') return rejectOnRateLimit(data);
    return rejectOnRateLimit.some((prefix) => data.route.toLowerCase().startsWith(prefix.toLowerCase()));
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Refuses a path with a `.`/`..` segment (plain or percent-encoded) or a backslash: `fetch` would resolve it to another endpoint. */
function assertRoute(route: string): void {
  const [pathname = ''] = route.split('?');
  if (pathname.includes('\\') || pathname.split('/').some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment))) {
    throw new StrafeTypeError(ErrorCodes.RouteInvalid, route);
  }
}

function throwIfAborted(request: InternalRequest, url: string): void {
  if (request.signal?.aborted) throw new StrafeError(ErrorCodes.RequestAborted, request.method, url);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pause(ms: number, request: InternalRequest, url: string): Promise<void> {
  try {
    await sleep(ms, request.signal);
  } catch (error) {
    throw new StrafeError(ErrorCodes.RequestAborted, request.method, url, errorDetails({ cause: error }));
  }
}

/** Exponential backoff with jitter: ~1 s, 2 s, 4 s... capped at 30 s. */
function backoff(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

function errorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== null && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function describe(error: unknown): string {
  return errorCode(error) ?? (error instanceof Error ? error.message : String(error));
}

function parseJSON(text: string): unknown {
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Milliseconds from `Retry-After` (seconds or an HTTP date) or the body's `retry_after` (seconds); 1 s if neither. */
function retryAfterOf(headers: Headers, body: APIErrorBody | undefined): number {
  const header = headers.get('retry-after');
  if (header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  if (typeof body?.retry_after === 'number' && body.retry_after >= 0) return Math.ceil(body.retry_after * 1000);
  return 1000;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (text.length === 0) return undefined;
  if (type.includes('json')) return JSON.parse(text) as unknown;
  return text;
}

/** The body as the library reports it: a copy with the `redact` fields replaced, never the original. */
function redactFields(body: unknown, fields: readonly string[] | undefined): unknown {
  if (fields === undefined || fields.length === 0) return body;
  if (typeof body === 'string' || body instanceof URLSearchParams) {
    const params = new URLSearchParams(body);
    for (const field of fields) if (params.has(field)) params.set(field, '[redacted]');
    return typeof body === 'string' ? params.toString() : params;
  }
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const field of fields) if (Object.hasOwn(copy, field)) copy[field] = '[redacted]';
    return copy;
  }
  return body;
}

async function toError(response: Response, method: string, url: string, requestBody: RequestBody): Promise<Error> {
  const text = await response.text().catch(() => '');
  const type = response.headers.get('content-type') ?? '';
  const parsed = type.includes('json') || text.startsWith('{') ? parseJSON(text) : undefined;
  if (parsed !== undefined && typeof parsed === 'object' && parsed !== null) {
    const body = parsed as APIErrorBody;
    if (typeof body.error !== 'string') body.error = '';
    return new StrafeAPIError(body, response.status, method, url, requestBody);
  }
  return new HTTPError(response.status, response.statusText, method, url, text, requestBody);
}

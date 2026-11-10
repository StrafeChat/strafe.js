import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPError, RateLimitError, StrafeAPIError } from '../../src/errors/APIErrors.js';
import { ErrorCodes } from '../../src/errors/ErrorCodes.js';
import { StrafeError } from '../../src/errors/StrafeError.js';
import { REST } from '../../src/rest/REST.js';
import { Routes } from '../../src/rest/Routes.js';
import type { RateLimitData } from '../../src/rest/types.js';

interface Call {
  url: string;
  init: RequestInit;
}

type Responder = (call: Call) => Response | Promise<Response>;

/** A fake fetch answering from a list (the last responder repeats). */
function fakeFetch(...responders: Responder[]) {
  const calls: Call[] = [];
  let index = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const responder = responders[Math.min(index++, responders.length - 1)]!;
    return responder(call);
  });
  return { fn, calls };
}

const json =
  (body: unknown, status = 200, headers: Record<string, string> = {}): Responder =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const empty =
  (status = 204, headers: Record<string, string> = {}): Responder =>
  () =>
    new Response(null, { status, headers });

function rest(fetch: ReturnType<typeof fakeFetch>, options: ConstructorParameters<typeof REST>[0] = {}): REST {
  return new REST({ api: 'https://x.test/api', makeRequest: fetch.fn, ...options }).setToken('Bot abc123');
}

describe('REST basics', () => {
  it('sends the Bot header and a User-Agent, parses JSON', async () => {
    const fetch = fakeFetch(json({ id: '1', username: 'bot' }));
    const client = rest(fetch);
    await expect(client.get(Routes.user())).resolves.toEqual({ id: '1', username: 'bot' });
    const headers = fetch.calls[0]!.init.headers as Record<string, string>;
    expect(fetch.calls[0]!.url).toBe('https://x.test/api/users/@me');
    expect(headers.Authorization).toBe('Bot abc123');
    expect(headers['User-Agent']).toMatch(/^StrafeBot \(https:\/\/github\.com\/StrafeChat\/strafe\.js, 2\.0\.0\)/);
    expect(fetch.calls[0]!.init.method).toBe('GET');
  });

  it('derives the API from an instance and supports Bearer tokens', async () => {
    const fetch = fakeFetch(json({}));
    const client = new REST({ instance: 'app.strafe.chat', authPrefix: 'Bearer', makeRequest: fetch.fn }).setToken('tok');
    expect(client.api).toBe('https://app.strafe.chat/api');
    await client.get(Routes.user());
    expect((fetch.calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('returns undefined for 204 and text for non-JSON', async () => {
    const fetch = fakeFetch(empty(204), () => new Response('ok', { headers: { 'content-type': 'text/plain' } }));
    const client = rest(fetch);
    await expect(client.put(Routes.roomMessagePin('1', '2'))).resolves.toBeUndefined();
    await expect(client.get(Routes.instance())).resolves.toBe('ok');
  });

  it('refuses to send without a token unless auth is false or explicit', async () => {
    const fetch = fakeFetch(json({ strafe: {} }));
    const client = new REST({ api: 'https://x.test/api', makeRequest: fetch.fn });
    await expect(client.get(Routes.user())).rejects.toMatchObject({ code: ErrorCodes.TokenMissing });
    await expect(client.get(Routes.instance(), { auth: false })).resolves.toEqual({ strafe: {} });
    expect((fetch.calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined();
    await client.get(Routes.oauth2CurrentAuthorization(), { auth: { prefix: 'Bearer', token: 'access' } });
    expect((fetch.calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer access');
  });

  it('builds query strings, skipping null and undefined', async () => {
    const fetch = fakeFetch(json([]));
    await rest(fetch).get(Routes.roomMessages('1'), { query: { limit: 50, before: '9', after: undefined, around: null } });
    expect(fetch.calls[0]!.url).toBe('https://x.test/api/rooms/1/messages?limit=50&before=9');
    await rest(fetch).get(Routes.roomMessages('1'), { query: new URLSearchParams({ q: 'a b' }) });
    expect(fetch.calls[1]!.url).toBe('https://x.test/api/rooms/1/messages?q=a+b');
  });

  it('sends JSON with bigints as numbers', async () => {
    const fetch = fakeFetch(json({}));
    await rest(fetch).patch(Routes.spaceRole('1', '2'), { body: { permissions: 2049n, name: 'Mod' } });
    expect(fetch.calls[0]!.init.body).toBe('{"permissions":2049,"name":"Mod"}');
    expect((fetch.calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends files as multipart with body fields', async () => {
    const fetch = fakeFetch(json({ id: '5' }, 201));
    await rest(fetch).post(Routes.roomAttachments('1'), { files: [{ name: 'a.png', data: new Uint8Array([1, 2]) }], body: { width: 2, height: 1 } });
    const body = fetch.calls[0]!.init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('a.png');
    expect(body.get('width')).toBe('2');
    expect((fetch.calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('passes a body through untouched when asked', async () => {
    const fetch = fakeFetch(json({}));
    const form = new URLSearchParams({ grant_type: 'refresh_token' });
    await rest(fetch).post(Routes.oauth2Token(), { body: form, passThroughBody: true, auth: false });
    expect(fetch.calls[0]!.init.body).toBe(form);
  });

  it('returns the raw response and emits response events', async () => {
    const fetch = fakeFetch(json({ a: 1 }));
    const client = rest(fetch);
    const seen: string[] = [];
    client.on('response', (request, response) => seen.push(`${request.method} ${request.route} ${response.status}`));
    const response = await client.get<Response>(Routes.rooms(), { raw: true });
    expect(response).toBeInstanceOf(Response);
    expect(await response.json()).toEqual({ a: 1 });
    expect(seen).toEqual(['GET /rooms 200']);
  });

  it('never shows the token when inspected or serialized', async () => {
    const { inspect } = await import('node:util');
    const client = rest(fakeFetch(json({})));
    expect(client.hasToken).toBe(true);
    expect(inspect(client, { depth: 10, showHidden: false })).not.toContain('abc123');
    expect(JSON.stringify(client)).not.toContain('abc123');
    expect(Object.values(client)).not.toContain('abc123');
    expect(Object.keys(client)).not.toContain('token');
  });
});

describe('REST errors', () => {
  it('maps JSON errors to StrafeAPIError', async () => {
    const fetch = fakeFetch(json({ error: 'embeds[0].title: too long', code: 'invalid_embed', path: 'embeds[0].title' }, 400));
    const error = (await rest(fetch)
      .post(Routes.roomMessages('1'), { body: { plaintext: 'x' } })
      .catch((e: unknown) => e)) as StrafeAPIError;
    expect(error).toBeInstanceOf(StrafeAPIError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('invalid_embed');
    expect(error.path).toBe('embeds[0].title');
    expect(error.method).toBe('POST');
    expect(error.url).toBe('https://x.test/api/rooms/1/messages');
    expect(error.requestBody.json).toEqual({ plaintext: 'x' });
  });

  it('maps non-JSON errors to HTTPError', async () => {
    const fetch = fakeFetch(() => new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway', headers: { 'content-type': 'text/html' } }));
    const error = await rest(fetch, { retries: 0 })
      .get(Routes.user())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HTTPError);
    expect((error as HTTPError).body).toContain('bad gateway');
  });
});

describe('REST rate limits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits out a 429 (Retry-After) and retries without counting it', async () => {
    const fetch = fakeFetch(json({ error: "you're doing that too fast - slow down a moment", retry_after: 2 }, 429, { 'retry-after': '2' }), json({ ok: true }));
    const client = rest(fetch, { retries: 0 });
    const limited: RateLimitData[] = [];
    client.on('rateLimited', (data) => limited.push(data));
    const promise = client.post(Routes.roomMessages('1'), { body: { plaintext: 'hi' } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch.fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetch.fn).toHaveBeenCalledTimes(2);
    expect(limited[0]).toMatchObject({ route: '/rooms/:id/messages', method: 'POST', retryAfter: 2000, scope: 'user', global: false, majorParameter: '1' });
  });

  it('handles plain-text 429s', async () => {
    const fetch = fakeFetch(() => new Response('Too Many Requests', { status: 429, headers: { 'retry-after': '1', 'content-type': 'text/plain' } }), json({ access_token: 't' }));
    const promise = rest(fetch).post(Routes.oauth2Token(), { body: {}, auth: false });
    await vi.advanceTimersByTimeAsync(1100);
    await expect(promise).resolves.toEqual({ access_token: 't' });
  });

  it('rejects a wait longer than maxRetryAfter and when rejectOnRateLimit matches', async () => {
    const slow = fakeFetch(json({ error: 'slowmode is on in this channel', retry_after: 600 }, 429, { 'retry-after': '600' })); // terms-ok: server text
    await expect(rest(slow).post(Routes.roomMessages('1'), { body: { plaintext: 'x' } })).rejects.toBeInstanceOf(RateLimitError);

    const fetch = fakeFetch(json({ error: 'too fast', retry_after: 1 }, 429, { 'retry-after': '1' }));
    const error = (await rest(fetch, { rejectOnRateLimit: ['/rooms'] })
      .get(Routes.roomMessages('1'))
      .catch((e: unknown) => e)) as RateLimitError;
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.route).toBe('/rooms/:id/messages');
    const fn = vi.fn(() => true);
    await expect(rest(fetch, { rejectOnRateLimit: fn }).get(Routes.roomPins('1'))).rejects.toBeInstanceOf(RateLimitError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('waits when X-RateLimit-Remaining hits 0, for every room of the route', async () => {
    const fetch = fakeFetch(json({ id: 'a' }, 200, { 'x-ratelimit-limit': '15', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '3' }), json({ id: 'b' }));
    const client = rest(fetch);
    const limited: RateLimitData[] = [];
    client.on('rateLimited', (data) => limited.push(data));
    await client.post(Routes.roomMessages('1'), { body: { plaintext: 'a' } });
    const second = client.post(Routes.roomMessages('2'), { body: { plaintext: 'b' } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch.fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1100);
    await expect(second).resolves.toEqual({ id: 'b' });
    expect(limited[0]).toMatchObject({ limit: 15, majorParameter: '2' });
    expect(limited[0]!.timeToReset).toBeGreaterThan(2900);
  });

  it('a slowmode 429 holds only its own room', async () => {
    let n = 0;
    const fetch = fakeFetch((call) => {
      n++;
      if (call.url.includes('/rooms/1/') && n === 1) {
        return new Response(JSON.stringify({ error: 'slowmode is on in this channel', retry_after: 5 }), { // terms-ok: server text
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '5', 'x-ratelimit-limit': '15', 'x-ratelimit-remaining': '13', 'x-ratelimit-reset': '9' },
        });
      }
      return new Response(JSON.stringify({ url: call.url }), { headers: { 'content-type': 'application/json' } });
    });
    const client = rest(fetch);
    const limited: RateLimitData[] = [];
    client.on('rateLimited', (data) => limited.push(data));
    const slowRoom = client.post(Routes.roomMessages('1'), { body: { plaintext: 'a' } });
    await vi.advanceTimersByTimeAsync(10);
    await expect(client.post(Routes.roomMessages('2'), { body: { plaintext: 'b' } })).resolves.toEqual({ url: 'https://x.test/api/rooms/2/messages' });
    expect(limited[0]?.scope).toBe('shared');
    await vi.advanceTimersByTimeAsync(5100);
    await expect(slowRoom).resolves.toEqual({ url: 'https://x.test/api/rooms/1/messages' });
  });
});

describe('REST buckets', () => {
  it('drops idle buckets once there are many, so distinct raw paths cannot grow memory without bound', async () => {
    const limited: Responder = () =>
      new Response('{}', { headers: { 'content-type': 'application/json', 'x-ratelimit-limit': '5', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '60' } });
    const fetch = fakeFetch(limited, json({}));
    const client = rest(fetch);
    const buckets = (client as unknown as { buckets: Map<string, unknown> }).buckets;
    await client.get(Routes.user());
    for (let i = 0; i < 400; i++) await client.get(`/users/x${i}`);
    expect(buckets.size).toBeLessThanOrEqual(257);
    // A bucket still inside its window keeps what it learned.
    expect(buckets.has('GET /users/@me')).toBe(true);
  });
});

describe('REST queues', () => {
  it('keeps messages to one room in order and does not block other rooms', async () => {
    const order: string[] = [];
    const gates = new Map<string, () => void>();
    const fetch = fakeFetch(async (call) => {
      const body = JSON.parse(call.init.body as string) as { plaintext: string };
      order.push(`start ${body.plaintext}`);
      await new Promise<void>((resolve) => gates.set(body.plaintext, resolve));
      order.push(`end ${body.plaintext}`);
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    });
    const client = rest(fetch);
    const a1 = client.post(Routes.roomMessages('1'), { body: { plaintext: 'a1' } });
    const a2 = client.post(Routes.roomMessages('1'), { body: { plaintext: 'a2' } });
    const b1 = client.post(Routes.roomMessages('2'), { body: { plaintext: 'b1' } });
    await vi.waitFor(() => expect(gates.size).toBe(2));
    expect(order).toEqual(['start a1', 'start b1']);
    gates.get('b1')!();
    await b1;
    gates.get('a1')!();
    await a1;
    await vi.waitFor(() => expect(gates.has('a2')).toBe(true));
    gates.get('a2')!();
    await a2;
    expect(order).toEqual(['start a1', 'start b1', 'end b1', 'end a1', 'start a2', 'end a2']);
  });
});

describe('REST retries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const connError = (code: string) => () => {
    throw new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) });
  };

  it('retries GET on 5xx and network errors', async () => {
    const fetch = fakeFetch(json({ error: 'internal error' }, 500), connError('ECONNRESET'), json({ ok: 1 }));
    const promise = rest(fetch).get(Routes.user());
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual({ ok: 1 });
    expect(fetch.fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after `retries` and surfaces the last error', async () => {
    const fetch = fakeFetch(json({ error: 'internal error' }, 500));
    const promise = rest(fetch, { retries: 2 })
      .get(Routes.user())
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await promise).toBeInstanceOf(StrafeAPIError);
    expect(fetch.fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry POST on 500 or on a reset connection (it may have been sent)', async () => {
    const five = fakeFetch(json({ error: 'internal error' }, 500));
    await expect(rest(five).post(Routes.roomMessages('1'), { body: { plaintext: 'x' } })).rejects.toBeInstanceOf(StrafeAPIError);
    expect(five.fn).toHaveBeenCalledTimes(1);
    const reset = fakeFetch(connError('ECONNRESET'));
    await expect(rest(reset).post(Routes.roomMessages('1'), { body: { plaintext: 'x' } })).rejects.toThrow('fetch failed');
    expect(reset.fn).toHaveBeenCalledTimes(1);
  });

  it('retries POST on 503 and on connection errors before sending', async () => {
    const fetch = fakeFetch(json({ error: 'unavailable' }, 503), connError('ECONNREFUSED'), json({ id: '1' }, 201));
    const promise = rest(fetch).post(Routes.roomMessages('1'), { body: { plaintext: 'x' } });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual({ id: '1' });
    expect(fetch.fn).toHaveBeenCalledTimes(3);
  });

  it('times out (retrying idempotent requests) and maps it to RequestAborted', async () => {
    const hang = fakeFetch(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init.signal?.addEventListener('abort', () => reject(call.init.signal?.reason as Error));
        }),
    );
    const promise = rest(hang, { timeout: 1000, retries: 1 })
      .get(Routes.user())
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const error = (await promise) as StrafeError;
    expect(error).toBeInstanceOf(StrafeError);
    expect(error.code).toBe(ErrorCodes.RequestAborted);
    expect(hang.fn).toHaveBeenCalledTimes(2);
    const post = rest(hang, { timeout: 1000 })
      .post(Routes.roomMessages('1'), { body: { plaintext: 'x' } })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1500);
    expect(((await post) as StrafeError).code).toBe(ErrorCodes.RequestAborted);
  });

  it('honours an abort signal', async () => {
    const hang = fakeFetch(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const controller = new AbortController();
    const promise = rest(hang)
      .get(Routes.user(), { signal: controller.signal })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    expect(((await promise) as StrafeError).code).toBe(ErrorCodes.RequestAborted);
    await expect(rest(hang).get(Routes.user(), { signal: controller.signal })).rejects.toMatchObject({ code: ErrorCodes.RequestAborted });
  });
});

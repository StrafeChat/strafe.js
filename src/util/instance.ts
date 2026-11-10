import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import type { FetchLike } from '../rest/types.js';
import type { APIInstanceIndex, APIInstanceWellKnown } from '../types/api/instance.js';
import { readEnv } from './env.js';

/** Where an instance's services live. */
export interface InstanceURLs {
  /** The instance's origin, e.g. `https://app.strafe.chat`. */
  origin: string;
  /** Host (with port when one was given), e.g. `app.strafe.chat`. */
  domain: string;
  /** REST API base without a trailing slash, e.g. `https://app.strafe.chat/api`. */
  api: string;
  /** Gateway URL, e.g. `wss://app.strafe.chat/gateway/events`. */
  gateway: string;
  /** Web client origin, where the OAuth2 consent page and invite links live. */
  web: string;
  /** CDN base for avatars, emoji and attachments; `null` when unknown (payloads carry full URLs anyway). */
  cdn: string | null;
}

/** Explicit URLs that win over what an instance derives or advertises. */
export interface InstanceOverrides {
  /** REST API base. */
  api?: string | undefined;
  /** Gateway URL. */
  gateway?: string | undefined;
  /** Web client origin. */
  web?: string | undefined;
  /** CDN base. */
  cdn?: string | null | undefined;
}

/** What {@link discoverInstance} learns about an instance. */
export interface InstanceInfo {
  /** The resolved URLs. */
  urls: InstanceURLs;
  /** The server's version (`strafe.version` in `GET <api>/`). */
  version: string | null;
  /** The federation domain, when the instance federates. */
  federationDomain: string | null;
  /** The raw `GET <api>/` document. */
  index: APIInstanceIndex;
}

/** Options for {@link discoverInstance}. */
export interface DiscoverInstanceOptions {
  /** The `fetch` to use (default: the global one). */
  fetch?: FetchLike | undefined;
  /** Milliseconds per probe. Default 10 000. */
  timeout?: number;
  /** Explicit URLs that win over discovery. */
  overrides?: InstanceOverrides | undefined;
}

const LOCAL_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.test|127(?:\.\d{1,3}){3}|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\])$/i;

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function toWs(origin: string): string {
  return origin.replace(/^http/i, 'ws');
}

/** Parses `app.strafe.chat`, `https://app.strafe.chat`, `http://localhost:4000` or `https://x/api` into a URL. */
function parse(input: string): URL {
  const raw = input.trim();
  if (raw.length === 0) throw new StrafeError(ErrorCodes.InvalidInstanceURL, input);
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const host = raw.split('/')[0] ?? raw;
    const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : (host.split(':')[0] ?? host);
    candidate = `${LOCAL_HOST.test(hostname) ? 'http' : 'https'}://${raw}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new StrafeError(ErrorCodes.InvalidInstanceURL, input);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new StrafeError(ErrorCodes.InvalidInstanceURL, input);
  return url;
}

/**
 * Derives an instance's URLs without any network request.
 *
 * - A domain or origin (`app.strafe.chat`, `https://app.strafe.chat`) is the standard layout:
 *   API `<origin>/api`, gateway `wss://<host>/gateway/events`, CDN `<origin>/cdn`, web `<origin>`.
 *   Local hosts (`localhost`, `*.test`, IP addresses) default to `http`/`ws`.
 * - A URL with a path (`https://example.org/strafe/api`) IS the API base. When it ends in `/api` the
 *   gateway and CDN sit beside it (`/gateway/events`, `/cdn`).
 * - An origin with an explicit port (`http://localhost:4000`) is the development layout: the API
 *   itself, with the gateway on the next port (`ws://localhost:4001/events`).
 *
 * `overrides` win over everything derived. Without `instance`, `STRAFE_INSTANCE` is read; without
 * either, `overrides.api` alone is enough.
 *
 * @param instance - Domain or URL; defaults to the `STRAFE_INSTANCE` environment variable.
 * @param overrides - Explicit URLs.
 * @throws {@link StrafeError} `InstanceMissing` when there is nothing to go on, `InvalidInstanceURL` for bad input.
 */
export function resolveInstanceURLs(instance?: string, overrides: InstanceOverrides = {}): InstanceURLs {
  const input = instance ?? readEnv('STRAFE_INSTANCE') ?? overrides.api;
  if (input === undefined) throw new StrafeError(ErrorCodes.InstanceMissing);
  const urls = derive(parse(input));
  return applyOverrides(urls, overrides);
}

function derive(url: URL): InstanceURLs {
  const origin = url.origin;
  const wsOrigin = toWs(origin);
  const path = trimSlash(url.pathname);
  const domain = url.host;
  if (path === '' && url.port === '') {
    return { origin, domain, api: `${origin}/api`, gateway: `${wsOrigin}/gateway/events`, web: origin, cdn: `${origin}/cdn` };
  }
  if (path.endsWith('/api')) {
    const prefix = path.slice(0, -'/api'.length);
    return {
      origin,
      domain,
      api: `${origin}${path}`,
      gateway: `${wsOrigin}${prefix}/gateway/events`,
      web: `${origin}${prefix}`,
      cdn: `${origin}${prefix}/cdn`,
    };
  }
  if (url.port !== '') {
    const port = Number(url.port);
    const host = url.hostname.includes(':') && !url.hostname.startsWith('[') ? `[${url.hostname}]` : url.hostname;
    const wsScheme = url.protocol === 'https:' ? 'wss' : 'ws';
    return {
      origin,
      domain,
      api: `${origin}${path}`,
      gateway: `${wsScheme}://${host}:${port + 1}/events`,
      web: origin,
      cdn: port === 4000 ? `${url.protocol}//${host}:4010` : null,
    };
  }
  return { origin, domain, api: `${origin}${path}`, gateway: `${wsOrigin}/gateway/events`, web: origin, cdn: null };
}

function applyOverrides(urls: InstanceURLs, overrides: InstanceOverrides): InstanceURLs {
  return {
    ...urls,
    api: overrides.api === undefined ? urls.api : trimSlash(overrides.api),
    gateway: overrides.gateway ?? urls.gateway,
    web: overrides.web === undefined ? urls.web : trimSlash(overrides.web),
    cdn: overrides.cdn === undefined ? urls.cdn : overrides.cdn === null ? null : trimSlash(overrides.cdn),
  };
}

async function getJSON(fetchFn: FetchLike, url: string, timeout: number): Promise<unknown> {
  try {
    const response = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return undefined;
    if (!(response.headers.get('content-type') ?? '').includes('json')) return undefined;
    return (await response.json());
  } catch {
    return undefined;
  }
}

function isIndex(value: unknown): value is APIInstanceIndex {
  return typeof value === 'object' && value !== null && typeof (value as { strafe?: unknown }).strafe === 'object';
}

/**
 * Finds an instance's API, gateway and CDN over the network, the way the desktop app does:
 *
 * 1. A URL with a path or an explicit port is probed as the API itself (`GET <api>/` must answer
 *    with a `strafe` key).
 * 2. Otherwise `https://<host>/.well-known/strafe` (served by federating instances) gives `api_url`
 *    and `gateway_url`.
 * 3. Otherwise the standard layout `https://<host>/api/` is probed.
 *
 * The API's index then supplies the advertised gateway (`services.stargate.url`), CDN and web URLs
 * when present. `overrides` win over all of it.
 *
 * @param instance - Domain or URL; defaults to `STRAFE_INSTANCE`.
 * @param options - fetch injection, timeout and overrides.
 * @throws {@link StrafeError} `InstanceUnreachable` when no Strafe API answers.
 */
export async function discoverInstance(instance?: string, options: DiscoverInstanceOptions = {}): Promise<InstanceInfo> {
  const fetchFn = options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (fetchFn === undefined) throw new StrafeError(ErrorCodes.UnsupportedRuntime, 'fetch');
  const timeout = options.timeout ?? 10_000;
  const overrides = options.overrides ?? {};
  const input = instance ?? readEnv('STRAFE_INSTANCE') ?? overrides.api;
  if (input === undefined) throw new StrafeError(ErrorCodes.InstanceMissing);
  const url = parse(input);
  let urls = derive(url);
  let index: APIInstanceIndex | undefined;

  if (overrides.api !== undefined) {
    urls = applyOverrides(urls, { api: overrides.api });
    const found = await getJSON(fetchFn, `${urls.api}/`, timeout);
    if (isIndex(found)) index = found;
  } else if (trimSlash(url.pathname) !== '' || url.port !== '') {
    const found = await getJSON(fetchFn, `${urls.api}/`, timeout);
    if (isIndex(found)) index = found;
    else if (trimSlash(url.pathname) === '') {
      // An origin with a port behind a reverse proxy: try the standard layout on it.
      const standard = `${url.origin}/api`;
      const again = await getJSON(fetchFn, `${standard}/`, timeout);
      if (isIndex(again)) {
        index = again;
        urls = derive(new URL(`${url.origin}/api`));
      }
    }
  } else {
    const wellKnown = (await getJSON(fetchFn, `${url.origin}/.well-known/strafe`, timeout)) as APIInstanceWellKnown | undefined;
    if (wellKnown && typeof wellKnown.api_url === 'string' && /^https?:\/\//i.test(wellKnown.api_url)) {
      urls = { ...derive(new URL(wellKnown.api_url)), origin: url.origin, domain: url.host, web: url.origin };
      if (typeof wellKnown.gateway_url === 'string' && /^wss?:\/\//i.test(wellKnown.gateway_url)) urls.gateway = wellKnown.gateway_url;
      const found = await getJSON(fetchFn, `${urls.api}/`, timeout);
      if (isIndex(found)) index = found;
    }
    if (!index) {
      const standard = derive(url);
      const found = await getJSON(fetchFn, `${standard.api}/`, timeout);
      if (isIndex(found)) {
        index = found;
        urls = standard;
      }
    }
  }

  if (!index) throw new StrafeError(ErrorCodes.InstanceUnreachable, input, 'no Strafe API answered');

  const stargate = index.services?.stargate?.url;
  if (typeof stargate === 'string' && /^wss?:\/\//i.test(stargate)) urls.gateway = stargate;
  const cdn = index.services?.cdn;
  if (cdn?.enabled && typeof cdn.url === 'string') urls.cdn = trimSlash(cdn.url);
  const web = index.services?.web?.url;
  if (typeof web === 'string' && /^https?:\/\//i.test(web)) urls.web = trimSlash(web);

  return {
    urls: applyOverrides(urls, overrides),
    version: index.strafe.version ?? null,
    federationDomain: index.federation?.enabled ? (index.federation.domain ?? null) : null,
    index,
  };
}

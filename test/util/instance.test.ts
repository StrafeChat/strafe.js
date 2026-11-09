import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes } from '../../src/errors/ErrorCodes.js';
import { StrafeError } from '../../src/errors/StrafeError.js';
import { discoverInstance, resolveInstanceURLs } from '../../src/util/instance.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveInstanceURLs', () => {
  it('derives the standard layout from a domain or origin', () => {
    const expected = {
      origin: 'https://app.strafe.chat',
      domain: 'app.strafe.chat',
      api: 'https://app.strafe.chat/api',
      gateway: 'wss://app.strafe.chat/gateway/events',
      web: 'https://app.strafe.chat',
      cdn: 'https://app.strafe.chat/cdn',
    };
    expect(resolveInstanceURLs('app.strafe.chat')).toEqual(expected);
    expect(resolveInstanceURLs('https://app.strafe.chat/')).toEqual(expected);
    expect(resolveInstanceURLs('  https://app.strafe.chat  ')).toEqual(expected);
  });

  it('uses http/ws for local hosts', () => {
    const urls = resolveInstanceURLs('strafe.test');
    expect(urls.api).toBe('http://strafe.test/api');
    expect(urls.gateway).toBe('ws://strafe.test/gateway/events');
    expect(resolveInstanceURLs('192.168.1.5').api).toBe('http://192.168.1.5/api');
  });

  it('treats a URL with a path as the API base', () => {
    const urls = resolveInstanceURLs('https://example.org/strafe/api/');
    expect(urls.api).toBe('https://example.org/strafe/api');
    expect(urls.gateway).toBe('wss://example.org/strafe/gateway/events');
    expect(urls.cdn).toBe('https://example.org/strafe/cdn');
    expect(urls.web).toBe('https://example.org/strafe');
    const custom = resolveInstanceURLs('https://example.org/v1');
    expect(custom.api).toBe('https://example.org/v1');
    expect(custom.gateway).toBe('wss://example.org/gateway/events');
    expect(custom.cdn).toBeNull();
  });

  it('treats an explicit port as the development layout', () => {
    const urls = resolveInstanceURLs('http://localhost:4000');
    expect(urls.api).toBe('http://localhost:4000');
    expect(urls.gateway).toBe('ws://localhost:4001/events');
    expect(urls.cdn).toBe('http://localhost:4010');
    expect(resolveInstanceURLs('localhost:4100').gateway).toBe('ws://localhost:4101/events');
  });

  it('applies overrides and reads STRAFE_INSTANCE', () => {
    const urls = resolveInstanceURLs('app.strafe.chat', { gateway: 'wss://gw.example/events', cdn: null, api: 'https://api.example/' });
    expect(urls.gateway).toBe('wss://gw.example/events');
    expect(urls.cdn).toBeNull();
    expect(urls.api).toBe('https://api.example');
    vi.stubEnv('STRAFE_INSTANCE', 'chat.example.org');
    expect(resolveInstanceURLs().api).toBe('https://chat.example.org/api');
  });

  it('errors clearly without an instance', () => {
    vi.stubEnv('STRAFE_INSTANCE', '');
    expect(() => resolveInstanceURLs()).toThrow(/STRAFE_INSTANCE/);
    try {
      resolveInstanceURLs();
    } catch (error) {
      expect(error).toBeInstanceOf(StrafeError);
      expect((error as StrafeError).code).toBe(ErrorCodes.InstanceMissing);
    }
    expect(() => resolveInstanceURLs('ftp://x')).toThrow(StrafeError);
    expect(() => resolveInstanceURLs('https://')).toThrow(StrafeError);
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('discoverInstance', () => {
  const index = {
    strafe: { version: '1.2.3' },
    services: {
      stargate: { url: 'wss://gw.example.org/events' },
      cdn: { enabled: true, url: 'https://cdn.example.org/' },
      web: { url: 'https://web.example.org' },
    },
    federation: { enabled: true, domain: 'example.org' },
  };

  it('follows /.well-known/strafe and reads the index', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async (url: string) => {
      calls.push(url);
      if (url === 'https://example.org/.well-known/strafe') {
        return json({ domain: 'example.org', version: 1, api_url: 'https://api.example.org/api', gateway_url: 'wss://example.org/gateway/events' });
      }
      if (url === 'https://api.example.org/api/') return json(index);
      return new Response('not found', { status: 404 });
    });
    const info = await discoverInstance('example.org', { fetch });
    expect(calls).toEqual(['https://example.org/.well-known/strafe', 'https://api.example.org/api/']);
    expect(info.urls.api).toBe('https://api.example.org/api');
    expect(info.urls.gateway).toBe('wss://gw.example.org/events');
    expect(info.urls.cdn).toBe('https://cdn.example.org');
    expect(info.urls.web).toBe('https://web.example.org');
    expect(info.version).toBe('1.2.3');
    expect(info.federationDomain).toBe('example.org');
  });

  it('falls back to the standard layout when there is no well-known document', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === 'https://example.org/api/') return json({ strafe: { version: '9' } });
      return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } });
    });
    const info = await discoverInstance('example.org', { fetch });
    expect(info.urls.api).toBe('https://example.org/api');
    expect(info.urls.gateway).toBe('wss://example.org/gateway/events');
    expect(info.federationDomain).toBeNull();
  });

  it('probes a URL with a port as the API itself, then the standard layout on it', async () => {
    const direct = vi.fn(async (url: string) => (url === 'http://localhost:4000/' ? json({ strafe: {} }) : new Response('', { status: 404 })));
    expect((await discoverInstance('http://localhost:4000', { fetch: direct })).urls.gateway).toBe('ws://localhost:4001/events');
    const proxied = vi.fn(async (url: string) => (url === 'https://host.example:8443/api/' ? json({ strafe: {} }) : new Response('', { status: 404 })));
    const info = await discoverInstance('https://host.example:8443', { fetch: proxied });
    expect(info.urls.api).toBe('https://host.example:8443/api');
    expect(info.urls.gateway).toBe('wss://host.example:8443/gateway/events');
  });

  it('honours overrides and fails clearly when nothing answers', async () => {
    const fetch = vi.fn(async () => json(index));
    const info = await discoverInstance('example.org', { fetch, overrides: { api: 'https://api.example.org/api', gateway: 'wss://mine/events' } });
    expect(fetch).toHaveBeenCalledWith('https://api.example.org/api/', expect.anything());
    expect(info.urls.gateway).toBe('wss://mine/events');
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(discoverInstance('example.org', { fetch: down })).rejects.toMatchObject({ code: ErrorCodes.InstanceUnreachable });
  });
});

import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { Client } from '../src/client/Client.js';
import { setup } from './helpers.js';
import { StrafeAPIError } from '../src/errors/APIErrors.js';
import { ErrorCodes } from '../src/errors/ErrorCodes.js';
import type { StrafeError } from '../src/errors/StrafeError.js';
import { generateAuthorizationURL, generateBotInvite, OAuth2Routes } from '../src/oauth2/authorize.js';
import { OAuth2Client } from '../src/oauth2/OAuth2Client.js';
import { createPKCE, createState, isValidPKCEString, pkceChallenge } from '../src/oauth2/pkce.js';
import { OAuth2Scopes } from '../src/oauth2/scopes.js';
import { OAuth2User } from '../src/oauth2/structures.js';
import type { APISelfUser } from '../src/types/api/user.js';
import { Collection } from '../src/util/Collection.js';
import { formatInviteCode, inviteURL, parseInviteCode } from '../src/util/invite.js';
import { PermissionFlagsBits, PermissionsBitField } from '../src/util/PermissionsBitField.js';

const CLIENT_ID = '2102226824774811648';
const bogusPermission: unknown = ['NotAPermission'];
const SECRET = 'sup3r s3cret+/=';
const REDIRECT = 'https://example.org/callback';

interface Recorded {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A fetch answering from a function, recording each request with its headers and raw body. */
function recorder(answer: (call: Recorded, index: number) => Response) {
  const calls: Recorded[] = [];
  const fetch = vi.fn(async (input: string, init: RequestInit) => {
    const call: Recorded = {
      url: new URL(input),
      method: init.method ?? 'GET',
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    return answer(call, calls.length - 1);
  });
  return { calls, fetch };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const TOKENS = { access_token: 'a'.repeat(64), token_type: 'Bearer', expires_in: 604800, refresh_token: 'r'.repeat(64), scope: 'identify email' };

function oauthClient(fetch: ReturnType<typeof recorder>['fetch'], extra: Partial<ConstructorParameters<typeof OAuth2Client>[0]> = {}): OAuth2Client {
  return new OAuth2Client({ instance: 'app.strafe.chat', clientId: CLIENT_ID, clientSecret: SECRET, redirectUri: REDIRECT, rest: { makeRequest: fetch, retries: 0 }, ...extra });
}

function basic(header: string | undefined): [string, string] {
  const decoded = atob((header ?? '').replace(/^Basic /, ''));
  const [id = '', secret = ''] = decoded.split(':');
  return [decodeURIComponent(id), decodeURIComponent(secret)];
}

describe('PKCE and state', () => {
  it('computes base64url(SHA-256(verifier)) without padding', async () => {
    const verifier = 'dBjftJeZ4CVP-mJ92K9mo5-k1fCYqLp6QYdUDLkCKDg';
    const challenge = await pkceChallenge(verifier);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('creates a verifier of the asked length with its S256 challenge', async () => {
    const pkce = await createPKCE();
    expect(pkce.method).toBe('S256');
    expect(pkce.verifier).toHaveLength(64);
    expect(isValidPKCEString(pkce.verifier)).toBe(true);
    expect(pkce.challenge).toBe(createHash('sha256').update(pkce.verifier).digest('base64url'));
    expect((await createPKCE({ length: 43 })).verifier).toHaveLength(43);
    expect((await createPKCE({ length: 128 })).verifier).toHaveLength(128);
    expect((await createPKCE()).verifier).not.toBe(pkce.verifier);
  });

  it('refuses lengths and verifiers outside the grammar', async () => {
    await expect(createPKCE({ length: 42 })).rejects.toMatchObject({ code: ErrorCodes.InvalidArgument });
    await expect(createPKCE({ length: 129 })).rejects.toMatchObject({ code: ErrorCodes.InvalidArgument });
    await expect(pkceChallenge('short')).rejects.toMatchObject({ code: ErrorCodes.InvalidArgument });
    expect(isValidPKCEString(`${'a'.repeat(42)}!`)).toBe(false);
  });

  it('creates random url-safe state', () => {
    const state = createState();
    expect(state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(createState()).not.toBe(state);
    expect(createState(32)).toHaveLength(43);
    expect(() => createState(4)).toThrow(expect.objectContaining({ code: ErrorCodes.InvalidArgument }));
  });
});

describe('authorization URLs', () => {
  it('builds per-instance routes', () => {
    expect(OAuth2Routes.authorizationURL('app.strafe.chat')).toBe('https://app.strafe.chat/oauth2/authorize');
    expect(OAuth2Routes.tokenURL('app.strafe.chat')).toBe('https://app.strafe.chat/api/oauth2/token');
    expect(OAuth2Routes.tokenRevocationURL('app.strafe.chat')).toBe('https://app.strafe.chat/api/oauth2/token/revoke');
    expect(OAuth2Routes.currentAuthorizationURL('chat.example.org')).toBe('https://chat.example.org/api/oauth2/@me');
  });

  it('encodes the consent parameters the web page reads', () => {
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const url = new URL(
      generateAuthorizationURL({
        instance: 'app.strafe.chat',
        clientId: CLIENT_ID,
        scopes: [OAuth2Scopes.Identify, OAuth2Scopes.Email, OAuth2Scopes.Identify],
        redirectUri: REDIRECT,
        state: 'xyz',
        codeChallenge: challenge,
      }),
    );
    expect(url.origin + url.pathname).toBe('https://app.strafe.chat/oauth2/authorize');
    expect(url.search).toContain('scope=identify%20email');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: 'identify email',
      redirect_uri: REDIRECT,
      state: 'xyz',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
  });

  it('builds bot install links without a redirect', () => {
    const url = new URL(
      generateBotInvite({
        web: 'https://web.example.org/',
        clientId: CLIENT_ID,
        permissions: [PermissionFlagsBits.SendMessages, 'EmbedLinks'],
        space: { id: '42' },
        disableSpaceSelect: true,
      }),
    );
    expect(url.origin).toBe('https://web.example.org');
    expect(url.searchParams.get('scope')).toBe('bot');
    expect(url.searchParams.has('redirect_uri')).toBe(false);
    expect(url.searchParams.get('permissions')).toBe(String(PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks));
    expect(url.searchParams.get('space_id')).toBe('42');
    expect(url.searchParams.get('disable_space_select')).toBe('true');
  });

  it('refuses locally what the server would refuse', () => {
    const base = { instance: 'app.strafe.chat', clientId: CLIENT_ID };
    const code = (fn: () => unknown): unknown => {
      try {
        fn();
      } catch (error) {
        return (error as StrafeError).code;
      }
      return 'no error';
    };
    expect(code(() => generateAuthorizationURL({ ...base, scopes: [OAuth2Scopes.Identify] }))).toBe(ErrorCodes.OAuth2RedirectURIMissing);
    expect(code(() => generateBotInvite({ ...base, scopes: [OAuth2Scopes.Identify] }))).toBe(ErrorCodes.OAuth2RedirectURIMissing);
    expect(code(() => generateAuthorizationURL({ ...base, scopes: [] }))).toBe(ErrorCodes.OAuth2ScopesInvalid);
    expect(code(() => generateAuthorizationURL({ ...base, scopes: Array.from({ length: 11 }, (_, i) => `s${String(i)}`), redirectUri: REDIRECT }))).toBe(
      ErrorCodes.OAuth2ScopesInvalid,
    );
    expect(code(() => generateAuthorizationURL({ ...base, scopes: ['identify email'], redirectUri: REDIRECT }))).toBe(ErrorCodes.OAuth2ScopesInvalid);
    expect(code(() => generateAuthorizationURL({ ...base, scopes: ['identify'], redirectUri: REDIRECT, codeChallenge: 'plain' }))).toBe(ErrorCodes.InvalidArgument);
    expect(code(() => generateAuthorizationURL({ ...base, scopes: ['identify'], redirectUri: REDIRECT, permissions: 8 }))).toBe(ErrorCodes.InvalidArgument);
    expect(code(() => generateAuthorizationURL({ ...base, scopes: ['identify'], redirectUri: 'example.org/cb' }))).toBe(ErrorCodes.InvalidType);
    expect(code(() => generateBotInvite({ ...base, clientId: 'abc' }))).toBe(ErrorCodes.InvalidType);
    expect(code(() => generateBotInvite({ ...base, permissions: bogusPermission as never }))).toBe(ErrorCodes.BitFieldInvalid);
  });
});

describe('OAuth2Client token endpoint', () => {
  it('exchanges a code with HTTP Basic client auth and a form body', async () => {
    const { calls, fetch } = recorder(() => json(TOKENS, 200, { 'cache-control': 'no-store' }));
    const oauth = oauthClient(fetch);
    const before = Date.now();
    const verifier = 'dBjftJeZ4CVP-mJ92K9mo5-k1fCYqLp6QYdUDLkCKDg';
    const tokens = await oauth.exchangeCode(' the-code ', { codeVerifier: verifier });

    const call = calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.url.href).toBe('https://app.strafe.chat/api/oauth2/token');
    expect(call.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(basic(call.headers.Authorization)).toEqual([CLIENT_ID, SECRET]);
    expect(Object.fromEntries(new URLSearchParams(call.body))).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    });
    expect(call.body).not.toContain('client_secret');
    expect(tokens).toMatchObject({ accessToken: TOKENS.access_token, refreshToken: TOKENS.refresh_token, tokenType: 'Bearer', expiresIn: 604800, scopes: ['identify', 'email'] });
    expect(tokens.expiresTimestamp).toBeGreaterThanOrEqual(before + 604800_000);
    expect(JSON.parse(JSON.stringify(tokens))).toEqual(tokens);
  });

  it('refreshes and revokes', async () => {
    const { calls, fetch } = recorder((call) => (call.url.pathname.endsWith('/revoke') ? json({}) : json({ ...TOKENS, scope: 'identify' })));
    const oauth = oauthClient(fetch);
    const tokens = await oauth.refreshToken('old-refresh');
    expect(Object.fromEntries(new URLSearchParams(calls[0]!.body))).toEqual({ grant_type: 'refresh_token', refresh_token: 'old-refresh' });
    expect(tokens.scopes).toEqual(['identify']);

    await expect(oauth.revokeToken(tokens)).resolves.toBeUndefined();
    expect(calls[1]!.url.pathname).toBe('/api/oauth2/token/revoke');
    expect(Object.fromEntries(new URLSearchParams(calls[1]!.body))).toEqual({ token: TOKENS.refresh_token });
    expect(basic(calls[1]!.headers.Authorization)).toEqual([CLIENT_ID, SECRET]);
  });

  it('turns OAuth2 errors into StrafeAPIErrors with the secrets redacted', async () => {
    const { fetch } = recorder(() => json({ error: 'invalid_grant' }, 400));
    const oauth = oauthClient(fetch);
    const verifier = 'v'.repeat(43);
    const reported: unknown[] = [];
    oauth.rest.on('response', (request) => reported.push(request));
    const error = (await oauth.exchangeCode('secret-code', { codeVerifier: verifier }).catch((e: unknown) => e)) as StrafeAPIError;
    expect(reported).toHaveLength(1);
    const listened = inspect(reported, { depth: 10 });
    expect(listened).not.toContain('secret-code');
    expect(listened).not.toContain(verifier);
    expect(error).toBeInstanceOf(StrafeAPIError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('invalid_grant');
    const sent = inspect(error, { depth: 5 }) + JSON.stringify(error.requestBody);
    expect(sent).not.toContain('secret-code');
    expect(sent).not.toContain(verifier);
    expect(sent).not.toContain(SECRET);
    expect(String(error.requestBody.json)).toContain('grant_type=authorization_code');
  });

  it('refuses token calls without a secret or a redirect, before any request', async () => {
    const { fetch } = recorder(() => json(TOKENS));
    const browser = oauthClient(fetch, { clientSecret: undefined });
    expect(browser.hasClientSecret).toBe(false);
    await expect(browser.exchangeCode('c')).rejects.toMatchObject({ code: ErrorCodes.OAuth2ClientSecretMissing });
    await expect(browser.refreshToken('r')).rejects.toMatchObject({ code: ErrorCodes.OAuth2ClientSecretMissing });
    await expect(browser.revokeToken('t')).rejects.toMatchObject({ code: ErrorCodes.OAuth2ClientSecretMissing });
    const noRedirect = oauthClient(fetch, { redirectUri: undefined });
    await expect(noRedirect.exchangeCode('c')).rejects.toMatchObject({ code: ErrorCodes.OAuth2RedirectURIMissing });
    await expect(noRedirect.exchangeCode('c', { redirectUri: REDIRECT, codeVerifier: 'short' })).rejects.toMatchObject({ code: ErrorCodes.InvalidArgument });
    expect(fetch).not.toHaveBeenCalled();
    // The browser can still build URLs.
    expect(browser.generateAuthURL({ scopes: [OAuth2Scopes.Identify] })).toContain(`redirect_uri=${encodeURIComponent(REDIRECT)}`);
  });

  it('never shows the client secret', () => {
    const { fetch } = recorder(() => json({}));
    const oauth = oauthClient(fetch);
    expect(JSON.stringify(oauth)).not.toContain(SECRET);
    expect(inspect(oauth, { depth: 5, showHidden: true })).not.toContain(SECRET);
    expect(oauth.toJSON()).toEqual({ clientId: CLIENT_ID, redirectUri: REDIRECT, api: 'https://app.strafe.chat/api', web: 'https://app.strafe.chat', hasClientSecret: true });
  });
});

describe('OAuth2Client with an access token', () => {
  const self: APISelfUser = {
    id: '2102226824774811649',
    username: 'ada',
    display_name: 'Ada',
    avatar: 'https://app.strafe.chat/cdn/v1/avatars/a.png',
    banner: '',
    bio: '',
    about_me: 'hi',
    pronouns: 'she/her',
    bot: false,
    public_flags: 1,
    email: '',
    verified_email: false,
    accent_color: '#ff0000',
    birthday_opt_in: false,
    birthday: '',
    created_at: '2026-09-21T00:00:00Z',
  };

  it('fetches the user with the Bearer token', async () => {
    const { calls, fetch } = recorder(() => json(self));
    const oauth = oauthClient(fetch);
    const user = await oauth.fetchUser({ accessToken: 'tok' });
    expect(calls[0]!.url.href).toBe('https://app.strafe.chat/api/users/@me');
    expect(calls[0]!.headers.Authorization).toBe('Bearer tok');
    expect(user).toBeInstanceOf(OAuth2User);
    expect(user.displayName).toBe('Ada');
    expect(user.globalName).toBe('Ada');
    expect(user.tag).toBe('ada');
    expect(user.email).toBeNull();
    expect(user.verified).toBeNull();
    expect(user.banner).toBeNull();
    expect(user.accentColor).toBe(0xff0000);
    expect(user.flags.has('Founder')).toBe(true);
    expect(user.avatarURL()).toBe(self.avatar);
    expect(user.createdAt.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(user.toString()).toBe(`<@${self.id}>`);

    const withEmail = new OAuth2User({ ...self, email: 'ada@example.org', verified_email: true });
    expect(withEmail.email).toBe('ada@example.org');
    expect(withEmail.verified).toBe(true);
  });

  it('fetches spaces and the authorization', async () => {
    const { calls, fetch } = recorder((call) =>
      call.url.pathname.endsWith('/spaces')
        ? json([{ id: '42', name: 'Lab', name_acronym: 'L', icon: '', banner: '', owner: true, permissions: Number(PermissionsBitField.All) }])
        : json({
            application: { id: CLIENT_ID, name: 'App', description: '', icon: '', has_bot: true, bot_public: false },
            scopes: ['identify', 'spaces'],
            expires: '2026-11-16T00:00:00Z',
            user: { id: self.id, username: 'ada', display_name: '', avatar: '', public_flags: 0 },
          }),
    );
    const oauth = oauthClient(fetch);
    const spaces = await oauth.fetchSpaces('Bearer tok');
    expect(calls[0]!.headers.Authorization).toBe('Bearer tok');
    expect(spaces).toBeInstanceOf(Collection);
    expect(spaces.get('42')?.permissions.has('Administrator')).toBe(true);
    expect(spaces.get('42')?.icon).toBeNull();

    const auth = await oauth.fetchCurrentAuthorization('tok');
    expect(calls[1]!.url.pathname).toBe('/api/oauth2/@me');
    expect(auth.application).toEqual({ id: CLIENT_ID, name: 'App', description: '', icon: null, hasBot: true, botPublic: false });
    expect(auth.hasScopes('identify', 'spaces')).toBe(true);
    expect(auth.hasScopes('email')).toBe(false);
    expect(auth.expiresAt.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(auth.user?.displayName).toBe('ada');
  });

  it('keeps one person’s rate limit from holding up another', async () => {
    const { fetch } = recorder(() => json(self, 200, { 'x-ratelimit-limit': '1', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '60' }));
    const oauth = oauthClient(fetch);
    await oauth.fetchUser('one');
    // The REST budget of `GET /users/@me` is exhausted for "one"; "two" is another account.
    const started = Date.now();
    await oauth.fetchUser('two');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects an empty token without a request', async () => {
    const { fetch } = recorder(() => json(self));
    await expect(oauthClient(fetch).fetchUser('')).rejects.toMatchObject({ code: ErrorCodes.InvalidType });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('OAuth2Client.parseCallback', () => {
  const { fetch } = recorder(() => json({}));
  const oauth = oauthClient(fetch);

  it('reads the code, state and bot install details', () => {
    const result = oauth.parseCallback(`/callback?code=abc&state=s1&space_id=42&permissions=${String(PermissionFlagsBits.SendMessages)}`, 's1');
    expect(result.code).toBe('abc');
    expect(result.state).toBe('s1');
    expect(result.spaceId).toBe('42');
    expect(result.permissions?.has('SendMessages')).toBe(true);
    expect(oauth.parseCallback(new URL('https://example.org/callback?code=x'), null).permissions).toBeNull();
    expect(oauth.parseCallback({ code: ['y'], state: 's' }, 's').code).toBe('y');
    expect(oauth.parseCallback(new URLSearchParams('code=z'), null).code).toBe('z');
  });

  it('refuses a forged state, a denial and a missing code', () => {
    expect(() => oauth.parseCallback('?code=abc&state=evil', 's1')).toThrow(expect.objectContaining({ code: ErrorCodes.OAuth2StateMismatch }));
    expect(() => oauth.parseCallback('?code=abc', 's1')).toThrow(expect.objectContaining({ code: ErrorCodes.OAuth2StateMismatch }));
    expect(() => oauth.parseCallback('?error=access_denied&state=s1', 's1')).toThrow(expect.objectContaining({ code: ErrorCodes.OAuth2AccessDenied }));
    expect(() => oauth.parseCallback('?error=server_error', null)).toThrow(expect.objectContaining({ code: ErrorCodes.InvalidArgument }));
    expect(() => oauth.parseCallback('?state=s1', 's1')).toThrow(expect.objectContaining({ code: ErrorCodes.OAuth2CodeMissing }));
  });

  it('fails closed when the expected state is lost or empty (login CSRF)', () => {
    const mismatch = expect.objectContaining({ code: ErrorCodes.OAuth2StateMismatch });
    // req.session.oauthState is undefined when the victim never started a login.
    const session: { oauthState?: string } = {};
    expect(() => oauth.parseCallback('/callback?code=attackers-code', session.oauthState as unknown as string)).toThrow(mismatch);
    expect(() => oauth.parseCallback('/callback?code=attackers-code&state=', '')).toThrow(mismatch);
    expect(() => oauth.parseCallback('/callback?code=attackers-code', '')).toThrow(mismatch);
    expect(() => oauth.parseCallback('/callback?code=c&state=', 's1')).toThrow(mismatch);
    // An explicit null is the only way to skip the check.
    expect(oauth.parseCallback('/callback?code=c', null).code).toBe('c');
  });
});

describe('invite helpers', () => {
  it('parses codes, federated codes and links', () => {
    expect(parseInviteCode('abc123')).toEqual({ code: 'abc123', domain: null, linkHost: null });
    expect(parseInviteCode(' abc123@Chat.Example.org ')).toEqual({ code: 'abc123', domain: 'chat.example.org', linkHost: null });
    expect(parseInviteCode('https://app.strafe.chat/invite/abc123')).toEqual({ code: 'abc123', domain: null, linkHost: 'app.strafe.chat' });
    expect(parseInviteCode('https://app.strafe.chat/invite/abc123%40b.local%3A4100/?x=1')).toEqual({ code: 'abc123', domain: 'b.local:4100', linkHost: 'app.strafe.chat' });
    expect(parseInviteCode('app.strafe.chat/invite/abc')).toEqual({ code: 'abc', domain: null, linkHost: 'app.strafe.chat' });
    expect(parseInviteCode('/invite/abc')).toEqual({ code: 'abc', domain: null, linkHost: null });
    for (const bad of ['', 'not a code', 'abc@', 'https://x.test/invite/', 'abc@bad_domain', 'https://x.test/invite/%E0%A4%A']) {
      expect(() => parseInviteCode(bad)).toThrow(expect.objectContaining({ code: ErrorCodes.InviteInvalid }));
    }
    expect(formatInviteCode({ code: 'abc', domain: 'b.local' })).toBe('abc@b.local');
    expect(formatInviteCode({ code: 'abc', domain: null })).toBe('abc');
    expect(inviteURL('abc@b.local', 'https://app.strafe.chat/')).toBe('https://app.strafe.chat/invite/abc%40b.local');
  });

  it('fetchInvite needs no login and resolves links from other instances', async () => {
    const { calls, fetch } = recorder(() => json({ space: { id: '42', name: 'Lab' }, inviter: null, member_count: 3 }));
    const client = new Client({ instance: 'app.strafe.chat', rest: { makeRequest: fetch } });
    const invite = await client.fetchInvite('https://app.strafe.chat/invite/abc');
    expect(calls[0]!.url.pathname).toBe('/api/spaces/invites/abc');
    expect(calls[0]!.headers.Authorization).toBeUndefined();
    expect(invite.code).toBe('abc');
    expect(invite.memberCount).toBe(3);

    await client.fetchInvite('https://chat.example.org/invite/xyz');
    expect(calls[1]!.url.pathname).toBe('/api/spaces/invites/xyz%40chat.example.org');
    expect(client.resolveInviteCode('xyz@app.strafe.chat')).toBe('xyz');
    expect(client.resolveInviteCode(invite)).toBe('abc');

    client.rest.setToken('bot-token');
    await client.fetchInvite('abc');
    expect(calls[2]!.headers.Authorization).toBe('Bot bot-token');
  });

  it('client.generateInvite builds the bot install link once the bot is known', () => {
    const client = new Client({ instance: 'app.strafe.chat', web: 'https://web.strafe.test', rest: { makeRequest: vi.fn() } });
    expect(() => client.generateInvite()).toThrow(expect.objectContaining({ code: ErrorCodes.ClientNotReady }));
    client._setClientUser({ ...({} as APISelfUser), id: CLIENT_ID, username: 'bot', bot: true });
    const url = new URL(client.generateInvite({ permissions: PermissionsBitField.Default, space: '42' }));
    expect(url.origin + url.pathname).toBe('https://web.strafe.test/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('scope')).toBe('bot');
    expect(url.searchParams.get('permissions')).toBe(String(PermissionsBitField.Default));
    expect(url.searchParams.get('space_id')).toBe('42');
    expect(client.generateBotInvite({ scopes: ['identify'], redirectUri: REDIRECT })).toContain('scope=bot%20identify');
    expect(() => client.generateInvite({ scopes: ['identify'] })).toThrow(expect.objectContaining({ code: ErrorCodes.OAuth2RedirectURIMissing }));
  });
});

describe('OAuth2 and bots together', () => {
  it('space.members.add takes an OAuth2User and the token pair (spaces.join)', async () => {
    const { api, space } = setup();
    const userId = '2102226824774811649';
    api.on('PUT /spaces/:id/members/:id', new Response(JSON.stringify({ space_id: space.id, user_id: userId }), { status: 201, headers: { 'content-type': 'application/json' } }));
    api.on('GET /spaces/:id/members/:id', { id: userId, username: 'ada', roles: [], joined_at: '2026-11-09T00:00:00Z', nick: null });
    const user = new OAuth2User({ id: userId, username: 'ada' });
    const member = await space.members.add(user, { accessToken: { accessToken: 'user-token' } });
    const put = api.last('PUT');
    expect(put.path).toBe(`/spaces/${space.id}/members/${userId}`);
    expect(put.body).toEqual({ access_token: 'user-token' });
    expect(member.id).toBe(userId);
  });

  it('space.members.add keeps the access token out of the error when the server refuses', async () => {
    const { api, client, space } = setup();
    api.on('PUT /spaces/:id/members/:id', new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400, headers: { 'content-type': 'application/json' } }));
    const reported: unknown[] = [];
    client.rest.on('response', (request) => reported.push(request));
    const error = (await space.members.add('2102226824774811649', { accessToken: 'secret-user-token' }).catch((e: unknown) => e)) as StrafeAPIError;
    expect(reported).toHaveLength(1);
    expect(inspect(reported, { depth: 10 })).not.toContain('secret-user-token');
    expect(error).toBeInstanceOf(StrafeAPIError);
    expect(error.status).toBe(400);
    expect(error.requestBody.json).toEqual({ access_token: '[redacted]' });
    expect(inspect(error, { depth: 10 })).not.toContain('secret-user-token');
    expect(JSON.stringify(error)).not.toContain('secret-user-token');
    expect(api.last('PUT').body).toEqual({ access_token: 'secret-user-token' });
  });

  it('OAuth2Client.generateBotInvite uses the default redirect only for extra scopes', () => {
    const { fetch } = recorder(() => json({}));
    const oauth = oauthClient(fetch);
    expect(new URL(oauth.generateBotInvite()).searchParams.has('redirect_uri')).toBe(false);
    const url = new URL(oauth.generateBotInvite({ scopes: [OAuth2Scopes.Identify] }));
    expect(url.searchParams.get('scope')).toBe('bot identify');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
  });
});

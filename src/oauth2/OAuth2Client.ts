import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeRangeError, StrafeTypeError } from '../errors/StrafeError.js';
import { REST } from '../rest/REST.js';
import { Routes } from '../rest/Routes.js';
import type { RESTOptions, RouteLike } from '../rest/types.js';
import type { APIOAuth2CurrentAuthorization, APIOAuth2TokenResponse } from '../types/api/oauth2.js';
import type { APIPartialSpace } from '../types/api/space.js';
import type { APISelfUser } from '../types/api/user.js';
import { Collection } from '../util/Collection.js';
import { resolveInstanceURLs } from '../util/instance.js';
import { PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { AuthorizationURLOptions, BotInviteOptions } from './authorize.js';
import { buildAuthorizationURL, buildBotInviteURL } from './authorize.js';
import { isValidPKCEString } from './pkce.js';
import type { OAuth2Tokens } from './structures.js';
import { OAuth2Authorization, OAuth2Space, OAuth2User, toOAuth2Tokens } from './structures.js';

/** Options of an {@link OAuth2Client}. */
export interface OAuth2ClientOptions {
  /** The application's client id (shown in the developer portal; also its bot's user id). */
  clientId: Snowflake;
  /**
   * The client secret. Needed to exchange, refresh and revoke tokens, so keep it on your server. A
   * browser can still build authorization URLs without it.
   */
  clientSecret?: string | undefined;
  /** The default redirect URI, registered on the application (exactly as written there). */
  redirectUri?: string | undefined;
  /** The instance hosting the application: a domain or URL. Defaults to `STRAFE_INSTANCE`. */
  instance?: string | undefined;
  /** The API base, when it is not derived from `instance` (`http://localhost:4000` in development). */
  api?: string | undefined;
  /** The web client's origin (where the consent page is), when it is not the instance origin. */
  web?: string | undefined;
  /** Options of the underlying {@link REST} (timeouts, retries, `makeRequest` to inject `fetch`). */
  rest?: Partial<RESTOptions> | undefined;
}

/** An access token, or the {@link OAuth2Tokens} holding one. */
export type OAuth2AccessTokenResolvable = string | Pick<OAuth2Tokens, 'accessToken'>;

/** Options of {@link OAuth2Client.generateAuthURL}. */
export interface GenerateAuthURLOptions extends Omit<AuthorizationURLOptions, 'redirectUri'> {
  /** Overrides the client's `redirectUri` for this URL. */
  redirectUri?: string | undefined;
}

/** Options of {@link OAuth2Client.exchangeCode}. */
export interface ExchangeCodeOptions {
  /** The PKCE verifier, when the authorization URL carried its challenge. */
  codeVerifier?: string | undefined;
  /** The redirect URI the code was issued for, when it is not the client's default. */
  redirectUri?: string | undefined;
}

/** What the consent page sent back, from {@link OAuth2Client.parseCallback}. */
export interface OAuth2Callback {
  /** The authorization code to exchange. */
  code: string;
  /** The `state` echoed back, or `null`. */
  state: string | null;
  /** With the `bot` scope: the space the bot was installed in. */
  spaceId: Snowflake | null;
  /** With the `bot` scope: the permissions its managed role got. */
  permissions: Readonly<PermissionsBitField> | null;
}

/** Input of {@link OAuth2Client.parseCallback}: the redirect URL, its query, or parsed query parameters. */
export type OAuth2CallbackInput = string | URL | URLSearchParams | Readonly<Record<string, unknown>>;

const REDACTED_FIELDS = ['code', 'code_verifier', 'refresh_token', 'token', 'client_secret'];

/**
 * "Log in with Strafe" for websites and apps: the authorization-code flow with PKCE, token refresh
 * and revocation, and the three routes an access token reaches (the user, their spaces, the token
 * itself). It needs no {@link Client} and no bot.
 *
 * - Every instance runs its own OAuth2: create the application on the instance your users are on,
 *   and point `instance` at it.
 * - The code exchange needs the client secret, even with PKCE (Strafe has no public clients), so it
 *   runs on your server. A browser may build the authorization URL ({@link generateAuthorizationURL}).
 * - Errors from the token endpoint are {@link StrafeAPIError}s whose `code` is the RFC 6749 error
 *   (`invalid_grant`, `invalid_client`...); the secrets in what was sent are redacted from them.
 *
 * @example
 * ```ts
 * const oauth = new OAuth2Client({
 *   instance: 'app.strafe.chat',
 *   clientId: process.env.STRAFE_CLIENT_ID!,
 *   clientSecret: process.env.STRAFE_CLIENT_SECRET!,
 *   redirectUri: 'https://example.org/callback',
 * });
 *
 * // 1. Send the person to the consent page.
 * const state = createState();
 * const pkce = await createPKCE();
 * const url = oauth.generateAuthURL({ scopes: [OAuth2Scopes.Identify], state, codeChallenge: pkce.challenge });
 *
 * // 2. On the redirect back:
 * const { code } = oauth.parseCallback(request.url, state);
 * const tokens = await oauth.exchangeCode(code, { codeVerifier: pkce.verifier });
 * const user = await oauth.fetchUser(tokens);
 * console.log(`Hello, ${user.displayName}`);
 * ```
 */
export class OAuth2Client {
  /** The application's client id. */
  public readonly clientId: Snowflake;
  /** The default redirect URI, or `null`. */
  public readonly redirectUri: string | null;
  /** The API base. */
  public readonly api: string;
  /** The web client's origin (the consent page is `<web>/oauth2/authorize`). */
  public readonly web: string;
  /** The REST client the calls go through (no token of its own: each call carries its credentials). */
  declare public readonly rest: REST;

  readonly #clientSecret: string | null;

  /**
   * @param options - Client id and secret, redirect URI, instance.
   * @throws {@link StrafeError} `InstanceMissing` without an instance, `InvalidType` for a malformed client id.
   */
  public constructor(options: OAuth2ClientOptions) {
    if (typeof options.clientId !== 'string' || !/^\d{1,20}$/.test(options.clientId)) {
      throw new StrafeTypeError(ErrorCodes.InvalidType, 'clientId', "the application's numeric id as a string");
    }
    this.clientId = options.clientId;
    this.#clientSecret = options.clientSecret === undefined || options.clientSecret === '' ? null : options.clientSecret;
    this.redirectUri = options.redirectUri === undefined || options.redirectUri === '' ? null : options.redirectUri;
    const urls = resolveInstanceURLs(options.instance, { api: options.api, web: options.web });
    this.api = urls.api;
    this.web = urls.web;
    Object.defineProperty(this, 'rest', {
      value: new REST({ ...options.rest, api: urls.api, authPrefix: 'Bearer' }),
      enumerable: false,
      writable: false,
    });
  }

  /** Whether a client secret was given (needed for {@link OAuth2Client.exchangeCode} and friends). */
  public get hasClientSecret(): boolean {
    return this.#clientSecret !== null;
  }

  /**
   * Builds the consent URL to send a person to. Checks locally what the server would refuse: no
   * scopes or more than 10, no redirect URI (unless the only scope is `bot`), a malformed PKCE
   * challenge, bot options without the `bot` scope.
   *
   * @param options - Scopes, state, PKCE challenge; with `bot`, permissions and a space.
   * @example
   * ```ts
   * const url = oauth.generateAuthURL({
   *   scopes: [OAuth2Scopes.Identify, OAuth2Scopes.Email],
   *   state,
   *   codeChallenge: pkce.challenge,
   * });
   * ```
   */
  public generateAuthURL(options: GenerateAuthURLOptions): string {
    return buildAuthorizationURL(this.web, this.clientId, { ...options, redirectUri: options.redirectUri ?? this.redirectUri ?? undefined });
  }

  /**
   * Builds the install link of this application's bot (the `bot` scope). Without extra scopes it
   * needs no redirect; with them (or an explicit `redirectUri`) the person comes back with a code,
   * and the client's `redirectUri` is used when the options give none.
   *
   * @param options - Permissions, a preselected space, extra scopes.
   */
  public generateBotInvite(options: BotInviteOptions = {}): string {
    const extraScopes = (options.scopes ?? []).some((scope) => scope !== 'bot');
    const redirectUri = options.redirectUri ?? (extraScopes ? (this.redirectUri ?? undefined) : undefined);
    return buildBotInviteURL(this.web, this.clientId, { ...options, redirectUri });
  }

  /**
   * Reads the redirect back from the consent page and checks its `state`.
   *
   * @param input - The redirect URL (absolute or `/callback?...`), its query string, a
   *   `URLSearchParams`, or an already parsed query object (`req.query`).
   * @param expectedState - The `state` the login started with (from {@link createState}, kept in the
   *   person's session or a cookie). Required: a missing (`undefined`) or empty one is a mismatch, so
   *   a lost session cannot switch the check off. Pass `null` only for an authorization that was
   *   started without a state.
   * @throws {@link StrafeError} `OAuth2StateMismatch` (checked first), `OAuth2AccessDenied` when the
   *   person declined, `OAuth2CodeMissing` when there is no code.
   */
  public parseCallback(input: OAuth2CallbackInput, expectedState: string | null): OAuth2Callback {
    const params = toParams(input);
    const state = params.get('state');
    if (expectedState !== null) {
      // `undefined` here is a lost session (or a JavaScript caller that left the argument out):
      // failing closed is what keeps a forged redirect from logging the person in.
      const expected: unknown = expectedState;
      if (typeof expected !== 'string' || expected === '' || state === null || !safeEqual(state, expected)) {
        throw new StrafeError(ErrorCodes.OAuth2StateMismatch);
      }
    }
    const error = params.get('error');
    if (error !== null) {
      if (error === 'access_denied') throw new StrafeError(ErrorCodes.OAuth2AccessDenied);
      throw new StrafeError(ErrorCodes.InvalidArgument, `The authorization failed: ${error}${describe(params.get('error_description'))}`);
    }
    const code = params.get('code');
    if (code === null || code === '') throw new StrafeError(ErrorCodes.OAuth2CodeMissing);
    const spaceId = params.get('space_id');
    const permissions = params.get('permissions');
    return {
      code,
      state,
      spaceId: spaceId !== null && /^\d+$/.test(spaceId) ? spaceId : null,
      permissions: permissions !== null && /^\d+$/.test(permissions) ? new PermissionsBitField(BigInt(permissions)).freeze() : null,
    };
  }

  /**
   * Exchanges an authorization code for tokens. Codes are single-use and live 10 minutes.
   *
   * @param code - The `code` from the redirect.
   * @param options - The PKCE verifier; the redirect URI when it was not the default.
   * @throws {@link StrafeError} `OAuth2ClientSecretMissing`, `OAuth2RedirectURIMissing`; a
   *   {@link StrafeAPIError} with `code` `invalid_grant` for a used, expired or mismatched code (or a
   *   wrong verifier), `invalid_client` for a wrong secret.
   */
  public async exchangeCode(code: string, options: ExchangeCodeOptions = {}): Promise<OAuth2Tokens> {
    if (typeof code !== 'string' || code.trim() === '') throw new StrafeTypeError(ErrorCodes.InvalidType, 'code', 'the code from the redirect');
    const redirectUri = options.redirectUri ?? this.redirectUri;
    if (redirectUri === null || redirectUri === '') throw new StrafeTypeError(ErrorCodes.OAuth2RedirectURIMissing);
    const fields: Record<string, string> = { grant_type: 'authorization_code', code: code.trim(), redirect_uri: redirectUri };
    if (options.codeVerifier !== undefined) {
      if (!isValidPKCEString(options.codeVerifier)) {
        throw new StrafeRangeError(ErrorCodes.InvalidArgument, 'codeVerifier must be the verifier from createPKCE() (43-128 characters).');
      }
      fields.code_verifier = options.codeVerifier;
    }
    const data = await this.tokenRequest<APIOAuth2TokenResponse>(Routes.oauth2Token(), fields, 'exchangeCode()');
    return toOAuth2Tokens(data);
  }

  /**
   * Trades a refresh token for a new pair. The old pair stops working, so store the new one.
   *
   * @param refreshToken - The refresh token, or the {@link OAuth2Tokens} holding it.
   * @throws {@link StrafeError} `OAuth2ClientSecretMissing`; a {@link StrafeAPIError} `invalid_grant`
   *   when the token was replaced or revoked.
   */
  public async refreshToken(refreshToken: string | Pick<OAuth2Tokens, 'refreshToken'>): Promise<OAuth2Tokens> {
    const token = typeof refreshToken === 'string' ? refreshToken : refreshToken.refreshToken;
    if (typeof token !== 'string' || token.trim() === '') throw new StrafeTypeError(ErrorCodes.InvalidType, 'refreshToken', 'a refresh token');
    const data = await this.tokenRequest<APIOAuth2TokenResponse>(
      Routes.oauth2Token(),
      { grant_type: 'refresh_token', refresh_token: token.trim() },
      'refreshToken()',
    );
    return toOAuth2Tokens(data);
  }

  /**
   * Revokes a token pair (RFC 7009), for "log out" or "disconnect". Either token of the pair revokes
   * both and withdraws the person's consent. Succeeds for unknown tokens too.
   *
   * @param token - An access or refresh token, or {@link OAuth2Tokens} (its refresh token is used).
   * @throws {@link StrafeError} `OAuth2ClientSecretMissing`.
   */
  public async revokeToken(token: string | Pick<OAuth2Tokens, 'refreshToken'>): Promise<void> {
    const value = typeof token === 'string' ? token : token.refreshToken;
    if (typeof value !== 'string' || value.trim() === '') throw new StrafeTypeError(ErrorCodes.InvalidType, 'token', 'an access or refresh token');
    await this.tokenRequest(Routes.oauth2TokenRevoke(), { token: value.trim() }, 'revokeToken()');
  }

  /**
   * Fetches the person behind an access token (`GET /users/@me`; the `identify` or `email` scope).
   * `email` is filled only with the `email` scope.
   *
   * @param accessToken - The access token, or the {@link OAuth2Tokens} holding it.
   * @throws {@link StrafeAPIError} 403 `insufficient_scope` without either scope, 401 for an
   *   expired or revoked token.
   */
  public async fetchUser(accessToken: OAuth2AccessTokenResolvable): Promise<OAuth2User> {
    const data = await this.bearer<APISelfUser>(Routes.user(), accessToken);
    return new OAuth2User(data);
  }

  /**
   * Fetches the spaces the person is in (`GET /users/@me/spaces`; the `spaces` scope), with their
   * space-wide permissions in each.
   *
   * @param accessToken - The access token, or the {@link OAuth2Tokens} holding it.
   * @throws {@link StrafeAPIError} 403 `insufficient_scope` without the scope.
   */
  public async fetchSpaces(accessToken: OAuth2AccessTokenResolvable): Promise<Collection<Snowflake, OAuth2Space>> {
    const data = await this.bearer<APIPartialSpace[]>(Routes.userSpaces(), accessToken);
    return new Collection(data.map((space): [Snowflake, OAuth2Space] => [space.id, new OAuth2Space(space)]));
  }

  /**
   * Describes an access token (`GET /oauth2/@me`, any scope): the application, the scopes, the
   * expiry and, with `identify` or `email`, the person.
   *
   * @param accessToken - The access token, or the {@link OAuth2Tokens} holding it.
   * @throws {@link StrafeAPIError} 401 `invalid_token` for an unknown or expired token.
   */
  public async fetchCurrentAuthorization(accessToken: OAuth2AccessTokenResolvable): Promise<OAuth2Authorization> {
    const data = await this.bearer<APIOAuth2CurrentAuthorization>(Routes.oauth2CurrentAuthorization(), accessToken);
    return new OAuth2Authorization(data);
  }

  /** Plain JSON, without the client secret. */
  public toJSON(): Record<string, unknown> {
    return { clientId: this.clientId, redirectUri: this.redirectUri, api: this.api, web: this.web, hasClientSecret: this.hasClientSecret };
  }

  private async bearer<T>(route: RouteLike, accessToken: OAuth2AccessTokenResolvable): Promise<T> {
    const token = typeof accessToken === 'string' ? accessToken : accessToken.accessToken;
    if (typeof token !== 'string' || token.trim() === '') throw new StrafeTypeError(ErrorCodes.InvalidType, 'accessToken', 'an OAuth2 access token');
    return this.rest.get<T>(route, { auth: { prefix: 'Bearer', token: token.replace(/^Bearer\s+/i, '').trim() } });
  }

  private async tokenRequest<T>(route: RouteLike, fields: Record<string, string>, action: string): Promise<T> {
    const secret = this.#clientSecret;
    if (secret === null) throw new StrafeError(ErrorCodes.OAuth2ClientSecretMissing, action);
    return this.rest.post<T>(route, {
      auth: false,
      passThroughBody: true,
      body: new URLSearchParams(fields).toString(),
      redact: REDACTED_FIELDS,
      headers: {
        // RFC 6749 §2.3.1: both parts form-urlencoded, then base64.
        Authorization: `Basic ${btoa(`${encodeURIComponent(this.clientId)}:${encodeURIComponent(secret)}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
}

function toParams(input: OAuth2CallbackInput): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (input instanceof URL) return input.searchParams;
  if (typeof input === 'string') {
    const query = input.includes('?') ? input.slice(input.indexOf('?') + 1) : input;
    return new URLSearchParams(query.replace(/#.*$/, ''));
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') params.set(key, first);
  }
  return params;
}

/** String comparison that does not stop at the first difference. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function describe(description: string | null): string {
  return description === null || description === '' ? '' : ` (${description})`;
}

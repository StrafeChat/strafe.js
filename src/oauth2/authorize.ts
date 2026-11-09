import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeRangeError, StrafeTypeError } from '../errors/StrafeError.js';
import type { InstanceOverrides } from '../util/instance.js';
import { resolveInstanceURLs } from '../util/instance.js';
import type { PermissionResolvable } from '../util/PermissionsBitField.js';
import { PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { isValidPKCEString } from './pkce.js';
import type { OAuth2ScopeResolvable } from './scopes.js';
import { MaxOAuth2Scopes, OAuth2Scopes } from './scopes.js';

/**
 * Where to send people for consent and where to exchange codes, per instance (every Strafe instance
 * has its own; there is no central one). The consent page is on the web client's origin; the token
 * endpoints are on the API.
 *
 * @example
 * ```ts
 * OAuth2Routes.authorizationURL('app.strafe.chat'); // 'https://app.strafe.chat/oauth2/authorize'
 * OAuth2Routes.tokenURL('app.strafe.chat'); // 'https://app.strafe.chat/api/oauth2/token'
 * ```
 */
export const OAuth2Routes = {
  /**
   * The consent page: `<web origin>/oauth2/authorize`.
   *
   * @param instance - Domain or URL (defaults to `STRAFE_INSTANCE`).
   * @param overrides - Explicit `web`/`api` URLs.
   */
  authorizationURL: (instance?: string, overrides?: InstanceOverrides): string => `${resolveInstanceURLs(instance, overrides).web}/oauth2/authorize`,
  /**
   * The token endpoint: `<api>/oauth2/token`.
   *
   * @param instance - Domain or URL (defaults to `STRAFE_INSTANCE`).
   * @param overrides - Explicit `web`/`api` URLs.
   */
  tokenURL: (instance?: string, overrides?: InstanceOverrides): string => `${resolveInstanceURLs(instance, overrides).api}/oauth2/token`,
  /**
   * The revocation endpoint: `<api>/oauth2/token/revoke`.
   *
   * @param instance - Domain or URL (defaults to `STRAFE_INSTANCE`).
   * @param overrides - Explicit `web`/`api` URLs.
   */
  tokenRevocationURL: (instance?: string, overrides?: InstanceOverrides): string =>
    `${resolveInstanceURLs(instance, overrides).api}/oauth2/token/revoke`,
  /**
   * Token introspection: `<api>/oauth2/@me`.
   *
   * @param instance - Domain or URL (defaults to `STRAFE_INSTANCE`).
   * @param overrides - Explicit `web`/`api` URLs.
   */
  currentAuthorizationURL: (instance?: string, overrides?: InstanceOverrides): string => `${resolveInstanceURLs(instance, overrides).api}/oauth2/@me`,
} as const;

/** Options of an authorization (consent) URL. */
export interface AuthorizationURLOptions {
  /** The scopes to ask for (1 to 10). */
  scopes: readonly OAuth2ScopeResolvable[];
  /**
   * Where the person is sent back with `?code=&state=`. Must be one of the application's registered
   * redirect URIs, exactly. Required unless the only scope is `bot`.
   */
  redirectUri?: string | undefined;
  /** An opaque value echoed back on the redirect; use {@link createState} and check it on return. */
  state?: string | undefined;
  /** A PKCE S256 challenge from {@link createPKCE}. */
  codeChallenge?: string | undefined;
  /**
   * With the `bot` scope: the permissions the bot's managed role asks for. The server limits them to
   * what the installing person may grant.
   */
  permissions?: PermissionResolvable | undefined;
  /** With the `bot` scope: the space to preselect. */
  space?: Snowflake | { id: Snowflake } | undefined;
  /** With the `bot` scope and `space`: stop the person from picking another space. */
  disableSpaceSelect?: boolean | undefined;
}

/** Options of a bot install link. */
export interface BotInviteOptions {
  /** The permissions the bot's managed role asks for (limited to what the installer may grant). */
  permissions?: PermissionResolvable | undefined;
  /** The space to preselect. */
  space?: Snowflake | { id: Snowflake } | undefined;
  /** With `space`: stop the person from picking another space. */
  disableSpaceSelect?: boolean | undefined;
  /**
   * Scopes to ask for besides `bot` (which is always included). Any other scope needs `redirectUri`,
   * because it issues a code.
   */
  scopes?: readonly OAuth2ScopeResolvable[] | undefined;
  /** Where to send the person afterwards (with `code`, `state`, `space_id` and `permissions`). */
  redirectUri?: string | undefined;
  /** Echoed back on the redirect. */
  state?: string | undefined;
}

/** discord.js's name for the options of `client.generateInvite()`. */
export type InviteGenerationOptions = BotInviteOptions;

/** Which instance a standalone URL helper targets. */
export interface OAuth2InstanceOptions {
  /** Domain or URL (defaults to `STRAFE_INSTANCE`). */
  instance?: string | undefined;
  /** The web client's origin, when it is not the instance origin. */
  web?: string | undefined;
}

/** Options of {@link generateAuthorizationURL}. */
export interface GenerateAuthorizationURLOptions extends AuthorizationURLOptions, OAuth2InstanceOptions {
  /** The application's client id (also its bot's user id). */
  clientId: Snowflake;
}

/** Options of {@link generateBotInvite}. */
export interface GenerateBotInviteOptions extends BotInviteOptions, OAuth2InstanceOptions {
  /** The application's client id, which is also its bot's user id. */
  clientId: Snowflake;
}

/**
 * Builds a consent URL without an {@link OAuth2Client} (in a browser, say). Checks locally what the
 * server would refuse anyway: no scopes or more than 10, a missing `redirectUri`, a malformed PKCE
 * challenge, bot-only options without the `bot` scope.
 *
 * @param options - Instance, client id, scopes and the rest.
 * @example
 * ```ts
 * const url = generateAuthorizationURL({
 *   instance: 'app.strafe.chat',
 *   clientId: '2102226824774811648',
 *   scopes: [OAuth2Scopes.Identify],
 *   redirectUri: 'https://example.org/callback',
 *   state,
 * });
 * ```
 */
export function generateAuthorizationURL(options: GenerateAuthorizationURLOptions): string {
  return buildAuthorizationURL(webOf(options), options.clientId, options);
}

/**
 * Builds a bot install link (the `bot` scope) without a {@link Client}, for an "Add to Strafe"
 * button on a website. The person picks a space they have Manage Space in; the bot joins with a
 * managed role holding the requested permissions (as far as the person may grant them).
 *
 * @param options - Instance, client id, permissions, space.
 * @example
 * ```ts
 * const link = generateBotInvite({
 *   instance: 'app.strafe.chat',
 *   clientId: '2102226824774811648',
 *   permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
 * });
 * ```
 */
export function generateBotInvite(options: GenerateBotInviteOptions): string {
  return buildBotInviteURL(webOf(options), options.clientId, options);
}

/**
 * Builds a bot install link on a known web origin.
 *
 * @internal
 */
export function buildBotInviteURL(web: string, clientId: Snowflake, options: BotInviteOptions): string {
  return buildAuthorizationURL(web, clientId, { ...options, scopes: [OAuth2Scopes.Bot, ...(options.scopes ?? [])] });
}

/**
 * Builds and checks a consent URL on a known web origin.
 *
 * @internal
 */
export function buildAuthorizationURL(web: string, clientId: Snowflake, options: AuthorizationURLOptions): string {
  if (typeof clientId !== 'string' || !/^\d{1,20}$/.test(clientId)) {
    throw new StrafeTypeError(ErrorCodes.InvalidType, 'clientId', "the application's numeric id as a string");
  }
  if (!Array.isArray(options.scopes)) throw new StrafeTypeError(ErrorCodes.InvalidType, 'scopes', 'an array of OAuth2Scopes');
  const scopes = [...new Set(options.scopes.map((scope) => String(scope).trim()))];
  if (scopes.length === 0 || scopes.length > MaxOAuth2Scopes || scopes.some((scope) => scope === '' || /\s/.test(scope))) {
    throw new StrafeRangeError(ErrorCodes.OAuth2ScopesInvalid, scopes.join(' '));
  }
  const botOnly = scopes.length === 1 && scopes[0] === OAuth2Scopes.Bot;
  const wantsBot = scopes.includes(OAuth2Scopes.Bot);
  const redirectUri = options.redirectUri?.trim() ?? '';
  if (redirectUri === '' && !botOnly) throw new StrafeTypeError(ErrorCodes.OAuth2RedirectURIMissing);
  if (redirectUri !== '' && !/^https?:\/\/[^\s]+$/i.test(redirectUri)) {
    throw new StrafeTypeError(ErrorCodes.InvalidType, 'redirectUri', 'an absolute http(s) URL registered on the application');
  }
  if (options.codeChallenge !== undefined && !isValidPKCEString(options.codeChallenge)) {
    throw new StrafeRangeError(ErrorCodes.InvalidArgument, 'codeChallenge must be an S256 challenge from createPKCE() (43-128 characters of A-Z, a-z, 0-9, "-", ".", "_", "~").');
  }
  const botOptionUsed = options.permissions !== undefined || options.space !== undefined || options.disableSpaceSelect === true;
  if (botOptionUsed && !wantsBot) {
    throw new StrafeTypeError(ErrorCodes.InvalidArgument, 'permissions, space and disableSpaceSelect only apply with the bot scope.');
  }

  const params: [string, string][] = [
    ['response_type', 'code'],
    ['client_id', clientId],
    ['scope', scopes.join(' ')],
  ];
  if (redirectUri !== '') params.push(['redirect_uri', redirectUri]);
  if (options.state !== undefined && options.state !== '') params.push(['state', options.state]);
  if (options.codeChallenge !== undefined) params.push(['code_challenge', options.codeChallenge], ['code_challenge_method', 'S256']);
  if (options.permissions !== undefined) params.push(['permissions', PermissionsBitField.resolve(options.permissions).toString()]);
  if (options.space !== undefined) params.push(['space_id', typeof options.space === 'string' ? options.space : options.space.id]);
  if (options.disableSpaceSelect === true) params.push(['disable_space_select', 'true']);
  // %20 rather than "+" for spaces: every query parser reads %20 the same way.
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `${web.replace(/\/+$/, '')}/oauth2/authorize?${query}`;
}

function webOf(options: OAuth2InstanceOptions): string {
  if (options.web !== undefined) return options.web.replace(/\/+$/, '');
  return resolveInstanceURLs(options.instance).web;
}

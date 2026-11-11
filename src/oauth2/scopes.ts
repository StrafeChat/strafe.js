/**
 * The OAuth2 scopes Strafe knows.
 *
 * | Scope | What it grants |
 * | --- | --- |
 * | `identify` | `GET /users/@me` without the email ({@link OAuth2Client.fetchUser}) |
 * | `email` | the same, with the account's email |
 * | `spaces` | `GET /users/@me/spaces` ({@link OAuth2Client.fetchSpaces}) |
 * | `spaces.join` | your bot may add the person to a space (`space.members.add(user, { accessToken })`) |
 * | `bot` | installs your application's bot in a space the person manages |
 *
 * An access token reaches only those routes; everything else answers `403 insufficient_scope`, and
 * it can never open a gateway connection.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `OAuth2Scopes`, with Strafe's names.
 */
export enum OAuth2Scopes {
  /** Read the account (`GET /users/@me`) without its email. */
  Identify = 'identify',
  /** Read the account including its email. */
  Email = 'email',
  /** List the spaces the account is in (`GET /users/@me/spaces`). */
  Spaces = 'spaces',
  /** Let the application's bot add the account to a space. */
  SpacesJoin = 'spaces.join',
  /** Install the application's bot in a space (the person needs Manage Space there). */
  Bot = 'bot',
}

/** A scope: an {@link OAuth2Scopes} value, or another scope string a newer instance knows. */
export type OAuth2ScopeResolvable = OAuth2Scopes | `${OAuth2Scopes}` | (string & {});

/** The most scopes one authorization may ask for (more is `invalid_scope`). */
export const MaxOAuth2Scopes = 10;

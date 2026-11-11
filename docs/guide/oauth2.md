# OAuth2 login

"Log in with Strafe" uses the OAuth2 authorization-code flow with PKCE. `OAuth2Client` handles it
without a bot or gateway.

## Setup

1. In Settings → Developers, create an application and note its client id and secret.
2. Register your redirect URI. It must match exactly.
3. Create the client on your server:

```ts
import { OAuth2Client } from '@strafechat/strafe.js';

const oauth = new OAuth2Client({
  instance: 'app.strafe.chat',
  clientId: process.env.STRAFE_CLIENT_ID!,
  clientSecret: process.env.STRAFE_CLIENT_SECRET!,
  redirectUri: 'https://example.org/callback',
});
```

Only accounts on the application's instance can sign in.

## Scopes

| `OAuth2Scopes` | Value | Gives |
| --- | --- | --- |
| `Identify` | `identify` | `oauth.fetchUser()` |
| `Email` | `email` | Adds `email` and `verified` |
| `Spaces` | `spaces` | `oauth.fetchSpaces()`, with permissions |
| `SpacesJoin` | `spaces.join` | Your bot can add them to a space |
| `Bot` | `bot` | Installs your bot |

Ask for 1 to 10 scopes. A token reaches only `GET /users/@me`, `GET /users/@me/spaces` and
`GET /oauth2/@me`.

## The flow

<<< @/../examples/oauth2-login.ts#flow{ts}

1. `createState()` makes a value tied to the browser.
2. `createPKCE()` makes a verifier for your server and a challenge for the URL.
3. `generateAuthURL()` builds the consent page URL. It throws on missing scopes, redirect URI or a bad
   challenge.
4. `parseCallback(url, state)` returns the `code`. It throws `OAuth2StateMismatch` when the state
   differs or is missing, and `OAuth2AccessDenied` when the person declines. Pass `null` only if you
   started without a state.
5. `exchangeCode(code, { codeVerifier })` returns tokens. Codes are single-use and last 10 minutes.

The exchange always needs the client secret, so keep it on a server. A browser can build the URL with
`generateAuthorizationURL({ instance, clientId, scopes, redirectUri, state, codeChallenge })`.

The full server is in [the examples](../examples.md#oauth2-login).

## Tokens

```ts
const tokens = await oauth.exchangeCode(code, { codeVerifier });
// { accessToken, refreshToken, tokenType: 'Bearer', expiresIn, expiresTimestamp, scopes }

const user = await oauth.fetchUser(tokens);
const spaces = await oauth.fetchSpaces(tokens);
const fresh = await oauth.refreshToken(tokens); // store the new pair
await oauth.revokeToken(fresh);                 // revokes both tokens and the consent
```

- Each person has one live token pair per application. Refreshing invalidates the old pair.
- Refresh tokens don't expire. Revoking either token revokes both.
- `OAuth2Tokens` is plain data and can be stored as is.
- `OAuth2User` has the read side of a `User`, plus `email` and `verified` (`null` without `email`).

### Errors

Token errors are a `StrafeAPIError` whose `code` is the RFC 6749 error:

| `code` | Cause |
| --- | --- |
| `invalid_grant` | Used, expired or mismatched code, or wrong verifier |
| `invalid_client` | Wrong client id or secret (status `400`) |
| `invalid_scope` | Unknown scope |
| `invalid_request` | Malformed request |

Secrets are stripped from the error. The endpoint allows 20 requests a minute per IP.

## Installing a bot with OAuth2

The `bot` scope alone needs no redirect. `client.generateInvite()` and `oauth.generateBotInvite()`
build the link. With more scopes or a `redirectUri`, the person returns with a code, space and
permissions:

```ts
const link = oauth.generateBotInvite({
  permissions: [PermissionFlagsBits.SendMessages],
  scopes: [OAuth2Scopes.Identify],
  state,
});

const { code, spaceId, permissions } = oauth.parseCallback(request.url, state);
```

## Adding people to a space

With `spaces.join`, your bot can add the person to a space where it has Create Invite:

```ts
const tokens = await oauth.exchangeCode(code, { codeVerifier });
const user = await oauth.fetchUser(tokens);

const space = client.spaces.cache.get(spaceId)!;
await space.members.add(user, { accessToken: tokens });
```

# OAuth2 login

"Log in with Strafe" lets a website or app identify a Strafe user without handling their password.
It is the standard OAuth2 authorization-code flow with PKCE. `OAuth2Client` does every step and
needs no bot and no gateway connection.

## Setup

1. In **Settings → Developers**, create an application (or use your bot's). Note its **client id**
   and **client secret**.
2. Register your **redirect URI** on the application, exactly as your server will send it
   (`https://example.org/callback`). It must match character for character.
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

The application lives on one instance, and so do its users: people with an account on another
instance cannot sign in to it with that account. Use the instance your users are on.

## Scopes

| `OAuth2Scopes` | Value | Gives |
| --- | --- | --- |
| `Identify` | `identify` | `oauth.fetchUser()`: id, name, avatar and profile |
| `Email` | `email` | The same, plus `email` and `verified` |
| `Spaces` | `spaces` | `oauth.fetchSpaces()`: the spaces they are in, with their permissions |
| `SpacesJoin` | `spaces.join` | Lets your bot add them to a space |
| `Bot` | `bot` | Installs your bot in a space they manage |

A request asks for 1 to 10 scopes. An access token only ever reaches `GET /users/@me`,
`GET /users/@me/spaces` and `GET /oauth2/@me`; it can never open the gateway or act as the person
elsewhere.

## The flow

<<< @/../examples/oauth2-login.ts#flow{ts}

Step by step:

1. **`createState()`** makes a random value tied to the person's browser (a cookie here). The
   redirect back must carry the same value, or `parseCallback()` throws `OAuth2StateMismatch`: this
   stops someone else's login from being slipped into your site.
2. **`createPKCE()`** makes a verifier, kept on your server, and its SHA-256 challenge, sent in the
   URL. Only the holder of the verifier can redeem the code.
3. **`generateAuthURL()`** builds the consent page URL on the instance's web client. Send the
   person there. It refuses locally what the server would refuse: no scopes or too many, no
   redirect URI, a malformed challenge.
4. The person approves (or declines) and comes back to your redirect URI.
   **`parseCallback(url, state)`** checks the state, turns a refusal into `OAuth2AccessDenied`, and
   returns the `code`. The expected state is required: when it is `undefined` or `''` (the
   session or cookie was lost, or the person never started a login), the check fails with
   `OAuth2StateMismatch` instead of being skipped. Pass `null` only for an authorization you started
   without a state.
5. **`exchangeCode(code, { codeVerifier })`** trades the code for tokens. Codes are single-use and
   expire after 10 minutes.

The code exchange always needs the client secret, even with PKCE: Strafe has no public clients.
Keep the exchange on a server. A browser can still build the authorization URL with the standalone
`generateAuthorizationURL({ instance, clientId, scopes, redirectUri, state, codeChallenge })`.

The whole server, using only `node:http`, is in [the examples](../examples.md#oauth2-login).

## Tokens

```ts
const tokens = await oauth.exchangeCode(code, { codeVerifier });
// { accessToken, refreshToken, tokenType: 'Bearer', expiresIn, expiresTimestamp, scopes }

const user = await oauth.fetchUser(tokens);     // or fetchUser(tokens.accessToken)
const spaces = await oauth.fetchSpaces(tokens); // Collection of OAuth2Space
const fresh = await oauth.refreshToken(tokens); // replaces the pair: store the new one
await oauth.revokeToken(fresh);                 // "log out": revokes both tokens and the consent
```

- There is one live token pair per person and application. Refreshing replaces it: the old access
  and refresh tokens stop working, so save the new pair before using it.
- Refresh tokens do not expire on their own; revoking either token of a pair revokes both and
  withdraws the consent.
- `OAuth2Tokens` is plain data (`expiresTimestamp` is an absolute time), so it can go straight
  into a database.
- `fetchUser()` returns an `OAuth2User`: the read side of a `User` (`username`, `displayName`,
  `handle`, `avatarURL()`, `flags`...) plus `email` and `verified`. `email` is `null` without the
  `email` scope.

### Errors

The token endpoint answers with the RFC 6749 error codes, which arrive as a `StrafeAPIError` whose
`code` is the error: `invalid_grant` for a used, expired or mismatched code (or a wrong verifier),
`invalid_client` for a wrong client id or secret (Strafe answers `400` for it, not `401`),
`invalid_scope`, `invalid_request`. The code, verifier, refresh token and secret are removed from
the request body kept on the error. The endpoint allows 20 requests a minute per IP address.

## Installing a bot with OAuth2

The `bot` scope installs your application's bot. On its own it needs no redirect: the person picks
a space and is done. `client.generateInvite()` and `oauth.generateBotInvite()` build that link.

With more scopes, or an explicit `redirectUri`, the person comes back to your site with a code, the
chosen space and the granted permissions:

```ts
const link = oauth.generateBotInvite({
  permissions: [PermissionFlagsBits.SendMessages],
  scopes: [OAuth2Scopes.Identify],
  state,
});

// On the redirect:
const { code, spaceId, permissions } = oauth.parseCallback(request.url, state);
```

## Adding people to a space

With the `spaces.join` scope, your bot can add the person to a space it is in. The bot needs Create
Invite there:

```ts
const tokens = await oauth.exchangeCode(code, { codeVerifier });
const user = await oauth.fetchUser(tokens);

const space = client.spaces.cache.get(spaceId)!; // the bot's Client
await space.members.add(user, { accessToken: tokens });
```

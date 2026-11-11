# Examples

Complete programs from the repository's `examples/` folder. Run one with:

```sh
STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=your-token node examples/ping-pong.ts
```

On Node.js older than 22.18, use `npx tsx`.

## Ping pong

The smallest bot. Walk-through in [Your first bot](./guide/first-bot.md).

<<< @/../examples/ping-pong.ts

## Embeds and files

An embed, a generated file, and an uploaded image inside an embed via `attachment://`.

<<< @/../examples/embeds.ts

## Moderation

Kick, ban, unban and purge, with permission checks.

<<< @/../examples/moderation.ts

## Reaction roles

React to get a role, unreact to lose it.

<<< @/../examples/reaction-roles.ts

## OAuth2 login

"Log in with Strafe" for a website, with PKCE, on `node:http`.

<<< @/../examples/oauth2-login.ts

## REST only

Post from a script without the gateway.

<<< @/../examples/rest-only.ts

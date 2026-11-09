# Examples

Each example is a complete program in the repository's `examples/` folder, typechecked with the
library on every change. Run one with your instance and token in the environment:

```sh
STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=your-token node examples/ping-pong.ts
```

Node.js 22.18 and newer run TypeScript files directly; on older versions use `npx tsx`.

## Ping pong

The smallest useful bot. See [Your first bot](./guide/first-bot.md) for a walk-through.

<<< @/../examples/ping-pong.ts

## Embeds and files

An embed about the space, a generated file, and an uploaded image shown inside an embed with
`attachment://`.

<<< @/../examples/embeds.ts

## Moderation

Kick, ban, unban and purge commands with permission and hierarchy checks.

<<< @/../examples/moderation.ts

## Reaction roles

A role menu: reacting gives a role, removing the reaction takes it away.

<<< @/../examples/reaction-roles.ts

## OAuth2 login

"Log in with Strafe" for a website, with PKCE and a `state` cookie, using only `node:http`.

<<< @/../examples/oauth2-login.ts

## REST only

Post a message from a script without connecting to the gateway.

<<< @/../examples/rest-only.ts

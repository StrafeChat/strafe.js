# Getting started

strafe.js is the official TypeScript library for [Strafe](https://github.com/StrafeChat), a
federated, self-hostable chat platform. Use it to write bots, call the REST API, or add "Log in with
Strafe" (OAuth2 with PKCE) to a website.

A **Space** is a community with members, roles and invites. A **Room** is a text or voice room in
it, a **Section** groups rooms, and a **PM** is a private message.

::: details Coming from discord.js
The class shapes and method names match discord.js, with Strafe's nouns:
`guild.members.fetch()` becomes `space.members.fetch()`. <!-- terms-ok -->
See [Coming from discord.js](./coming-from-discord-js.md) for the full mapping.
:::

Every instance is independent, so every client names the instance its bot belongs to. PMs are
end-to-end encrypted, and a bot cannot read or post in an encrypted room
([Limits and differences](./limits.md#encryption-and-what-a-bot-can-see)).

## Requirements

- Node.js 22.12+, Bun, or Deno 2.5+.
- An account on a Strafe instance and a space you manage.

The library has no runtime dependencies.

## Installation

```sh
npm install @strafechat/strafe.js
```

```ts
import { Client, Events } from '@strafechat/strafe.js';
// or: const { Client, Events } = require('@strafechat/strafe.js');
```

For TypeScript, set `"module": "nodenext"` (or `"moduleResolution": "bundler"`). Node.js 22.18+
runs `.ts` files directly; on older versions use `tsx`.

::: tip WebSocket on Node.js
The gateway needs the token in a WebSocket handshake header. Node.js, Bun and Deno 2.5+ support
this. Otherwise, pass a compatible class such as `ws`'s: `new Client({ ws: { WebSocket } })`. Bots
do not run in browsers.
:::

## Creating a bot

1. In the Strafe web client, open **Settings → Developers** and create an application.
2. Add a bot and copy its token. It is shown once. Resetting it disconnects every session using the
   old one.
3. Add the bot to a space where you have Manage Space, using the link from the developer settings
   or one the bot builds:

   ```ts
   import { PermissionFlagsBits } from '@strafechat/strafe.js';

   const link = client.generateInvite({
     permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions],
   });
   ```

   The bot gets a managed role with the requested permissions, capped at what the installer may
   grant. The role starts at the bottom of the list; move it up if the bot manages members or roles.

The bot's user id is its application's client id.

## Configuration

| Variable | Used by | Example |
| --- | --- | --- |
| `STRAFE_INSTANCE` | `new Client()`, `new REST()`, `new OAuth2Client()` when no `instance` is passed | `app.strafe.chat` |
| `STRAFE_TOKEN` | `client.login()` when no token is passed | the bot token |

Keep them in an uncommitted `.env` and run `node --env-file=.env bot.ts`.

```ts
const client = new Client({ instance: 'app.strafe.chat' });
```

`instance` takes a domain or a URL. A domain uses the API at `https://<domain>/api` and the gateway
at `wss://<domain>/gateway/events`; for other layouts see [Instances and federation](./instances.md).
There is no default: a missing instance throws `InstanceMissing`.

## Next steps

- [Your first bot](./first-bot.md)
- [Events](./events.md)
- [Examples](../examples.md)

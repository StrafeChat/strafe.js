# Getting started

strafe.js is the official TypeScript library for [Strafe](https://github.com/StrafeChat), a
federated, self-hostable chat platform. It covers three things:

- **Bots**: a `Client` that connects to an instance's gateway, keeps caches of spaces, rooms,
  members and messages, and emits typed events.
- **The REST API**: a `REST` client with rate-limit queues and retries, usable on its own.
- **OAuth2**: "Log in with Strafe" for websites, with PKCE.

Strafe uses the same interaction model as Discord (spaces with rooms and roles, reactions, invites,
moderation) under its own names: a **Space** is a server, a **Room** is a text or voice room, a
**Section** groups rooms, and a **PM** is a private message. The library keeps discord.js's class
shapes and method names and uses Strafe's nouns, so `guild.members.fetch()` <!-- terms-ok -->
becomes `space.members.fetch()`. [Coming from discord.js](./coming-from-discord-js.md) has the full
mapping.

Two things make Strafe different from Discord, and both show up in the API:

- **There is no central server.** Each instance runs its own API, gateway and applications. A bot
  belongs to the instance its application was created on, so every client starts by naming one.
- **Private messages are end-to-end encrypted.** A bot cannot read or post in an encrypted room;
  see [Limits and differences](./limits.md#encryption-and-what-a-bot-can-see).

## Requirements

- Node.js 22.12 or newer, Bun, or Deno 2.5 or newer.
- An account on a Strafe instance, and a space you manage to test in.

strafe.js has no runtime dependencies: it uses the platform's `fetch`, `WebSocket`, `FormData`
and `Blob`.

## Installation

```sh
npm install @strafechat/strafe.js
```

The package is ESM. `import` it; `require()` also works on Node.js 22.12 and newer:

```ts
import { Client, Events } from '@strafechat/strafe.js';
// const { Client, Events } = require('@strafechat/strafe.js');
```

For TypeScript, use `"module": "nodenext"` (or `"moduleResolution": "bundler"`) in your
`tsconfig.json`. Node.js 22.18 and newer run `.ts` files directly (`node bot.ts`); on older
versions use a runner such as `tsx`.

::: tip WebSocket on Node.js
The gateway sends the bot token in a header of the WebSocket handshake, so the client creates its
socket as `new WebSocket(url, { headers })`. The built-in `WebSocket` of Node.js and Bun accepts that
(Deno added the option in 2.5). If yours does not, pass a class that does, such as the one from the
`ws` package: `new Client({ ws: { WebSocket } })`. Browsers cannot send the header, so bots do not
run in a browser.
:::

## Creating a bot

1. In the Strafe web client, open **Settings → Developers** and create an application. It has a
   **client id** and a **client secret**.
2. **Add a bot** to the application and copy its **token**. It is shown once; treat it like a
   password. **Reset token** disconnects every session that used the old one.
3. Add the bot to a space you manage. The developer settings build an install link, or the bot can
   build its own once it runs:

   ```ts
   import { PermissionFlagsBits } from '@strafechat/strafe.js';

   const link = client.generateInvite({
     permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions],
   });
   ```

   Whoever opens the link picks a space where they have Manage Space. The bot joins with a
   **managed role** holding the requested permissions (as far as that person may grant them). The
   managed role starts at the bottom of the role list; move it up if the bot should manage members
   or hand out roles.

The bot's user id is the same as its application's client id.

## Configuration

Two environment variables cover most bots:

| Variable | Used by | Example |
| --- | --- | --- |
| `STRAFE_INSTANCE` | `new Client()`, `new REST()`, `new OAuth2Client()` when no `instance` is passed | `app.strafe.chat` |
| `STRAFE_TOKEN` | `client.login()` when no token is passed | the bot token |

Keep them in a `.env` file that is not committed, and load it with `node --env-file=.env bot.ts`
(or your runtime's equivalent).

`instance` accepts a domain (`app.strafe.chat`) or a URL. A domain gets the standard layout: the API
at `https://app.strafe.chat/api` and the gateway at `wss://app.strafe.chat/gateway/events`. For
development servers and unusual layouts, see [Instances and federation](./instances.md).

```ts
const client = new Client({ instance: 'app.strafe.chat' });
```

There is no default instance: every instance is independent, and a missing one throws
`InstanceMissing` with a message naming `STRAFE_INSTANCE`.

## Next steps

- [Your first bot](./first-bot.md): a complete bot, line by line.
- [Events](./events.md): what the client emits and when.
- [Examples](../examples.md): runnable bots and an OAuth2 login server.

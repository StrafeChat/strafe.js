# strafe.js

The official TypeScript library for [Strafe](https://github.com/StrafeChat): bots, the REST API and
"Log in with Strafe" (OAuth2). It is shaped like [discord.js](https://discord.js.org), so if you have
written a Discord bot you already know most of it. Strafe's own words replace Discord's: a server is
a **Space**, a channel is a **Room**, a category is a **Section**, a DM is a **PM**. <!-- terms-ok -->

- A `Client` with caches, managers and typed events (`Events.MessageCreate`, `Events.SpaceMemberAdd`...).
- Structures with the methods you expect: `message.reply()`, `member.roles.add()`, `room.send()`,
  `member.permissionsIn(room)`.
- `EmbedBuilder`, `AttachmentBuilder`, `PermissionsBitField`, `Collection`, `Formatters`.
- A standalone `REST` client with rate-limit queues, retries and typed errors.
- `OAuth2Client` with PKCE, for websites.
- Federation-aware: every instance is independent; handles are `name@domain`, invites can be `code@domain`.
- ESM, zero runtime dependencies. Node.js 22.12 or newer, Bun, and Deno 2.5 or newer.

## Installation

```sh
npm install @strafechat/strafe.js
```

## Example

```ts
import { Client, Events } from '@strafechat/strafe.js';

const client = new Client({ instance: 'app.strafe.chat' }); // or STRAFE_INSTANCE

client.once(Events.ClientReady, (ready) => {
  console.log(`Logged in as ${ready.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.content === null) return;
  if (message.content === '!ping') await message.reply('Pong!');
});

await client.login(); // reads STRAFE_TOKEN
```

Create the bot in **Settings → Developers** on your instance, then add it to a space with the install
link (`client.generateInvite({ permissions: [...] })` builds one). There are no intents to declare:
a bot receives every event about what it can see.

`message.content` is `null` in end-to-end encrypted rooms. Private messages are always encrypted
and space rooms can opt in, and a bot can neither read nor post there; the library refuses such a
send before making a request. See [Limits and differences](docs/guide/limits.md).

## Logging in with Strafe on a website

```ts
import { OAuth2Client, OAuth2Scopes, createPKCE, createState } from '@strafechat/strafe.js';

const oauth = new OAuth2Client({
  instance: 'app.strafe.chat',
  clientId: process.env.STRAFE_CLIENT_ID!,
  clientSecret: process.env.STRAFE_CLIENT_SECRET!,
  redirectUri: 'https://example.org/callback',
});

const state = createState();
const pkce = await createPKCE();
const url = oauth.generateAuthURL({ scopes: [OAuth2Scopes.Identify], state, codeChallenge: pkce.challenge });
// ...send the person to `url`; on the redirect back:
const { code } = oauth.parseCallback(callbackUrl, state);
const tokens = await oauth.exchangeCode(code, { codeVerifier: pkce.verifier });
const user = await oauth.fetchUser(tokens);
```

## Coming from discord.js

| discord.js | strafe.js |
| --- | --- |
| `client.guilds`, `Guild` <!-- terms-ok --> | `client.spaces`, `Space` |
| `client.channels`, `TextChannel`, `CategoryChannel`, `DMChannel` <!-- terms-ok --> | `client.rooms`, `TextRoom`, `SectionRoom`, `PMRoom` |
| `guild.members`, `GuildMember` <!-- terms-ok --> | `space.members`, `SpaceMember` |
| `message.guild`, `message.channel` <!-- terms-ok --> | `message.space`, `message.room` |
| `Events.GuildMemberAdd` <!-- terms-ok --> | `Events.SpaceMemberAdd` |
| `PermissionFlagsBits.ViewChannel`, `ManageGuild` <!-- terms-ok --> | `PermissionFlagsBits.ViewRoom`, `ManageSpace` |
| `GatewayIntentBits`, `Partials`, sharding, slash commands | Not needed, or not on Strafe |

The full table, and what works differently, is in [Coming from discord.js](docs/guide/coming-from-discord-js.md).

## Documentation

- Guide: [docs/guide](docs/guide/getting-started.md) (build the site with `npm run docs:build`, or
  preview it with `npm run docs:dev`).
- API reference: generated from the source by TypeDoc (`npm run docs:api`, served at `/api/` on the
  docs site).
- Examples: [examples/](examples/) (ping-pong, embeds, moderation, reaction roles, OAuth2 login,
  REST only).
- The protocol itself: every instance serves its developer documentation at `https://<instance>/docs/`.
- Changes: [CHANGELOG.md](CHANGELOG.md).

## strafe.js 1.x

Version 2.0.0 is a rewrite for the current Strafe server. Versions 1.x spoke to the retired
pre-2026 backend and nothing from them carries over; see the [changelog](CHANGELOG.md).

## Contributing

```sh
npm install
npm run lint && npm run typecheck && npm test && npm run build
```

The public API is what `src/index.ts` exports and the documentation describes; members starting
with `_` or marked `@internal` are not covered by semantic versioning. Code, comments and docs use
Strafe's nouns (`npm run lint` checks).

## License

See [LICENSE](LICENSE).

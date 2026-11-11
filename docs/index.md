---
layout: home
markdownStyles: false

# Rendered by docs/.vitepress/theme/StrafeHome.vue. `{word}` in the headline is drawn in green.
strafe:
  badge: The official TypeScript library
  headline: Build on {Strafe} with TypeScript
  lede: strafe.js talks to any Strafe instance's gateway, REST API and OAuth2. Spaces, rooms, members and messages arrive as typed events, requests wait out rate limits on their own, and "Log in with Strafe" takes a few lines.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - text: API reference
      link: /api/index.html
      target: _self
  aside:
    text: Coming from discord.js?
    linkText: The migration guide maps every class and name.
    link: /guide/coming-from-discord-js
  pointsTitle: Built for Strafe
  points:
    - icon: federated
      title: Federated
      details: Every instance is independent. Point the client at yours; handles are name@domain and invites can be code@domain.
    - icon: encrypted
      title: Honest about encryption
      details: Private messages are end-to-end encrypted and bots cannot read them. The library tells you before it makes a request, not after.
    - icon: familiar
      title: Familiar shapes
      details: Client, Events, Collection, EmbedBuilder and managers with cache and fetch(), in Strafe's own nouns, spaces, rooms, sections and PMs.
    - icon: small
      title: Small
      details: ESM, zero runtime dependencies, Node.js 22.12+, Bun and Deno. The REST client and OAuth2 helpers work without a bot.
  guideTitle: The guide
  guide:
    - title: Getting started
      details: Install the package, create a bot and point the client at an instance.
      link: /guide/getting-started
    - title: Your first bot
      details: A bot that answers !ping, line by line, then running and deploying it.
      link: /guide/first-bot
    - title: Events
      details: What the client emits and when, partial objects, reconnects and latency.
      link: /guide/events
    - title: Messages and embeds
      details: Send, edit, react, pin and fetch messages, and build embeds with files.
      link: /guide/messages
    - title: Spaces, members and roles
      details: Managers and caches for rooms, members, roles, invites, emojis, bans and voice.
      link: /guide/spaces
    - title: Permissions
      details: PermissionsBitField, room overrides and the role hierarchy.
      link: /guide/permissions
    - title: OAuth2 login
      details: '"Log in with Strafe" for a website, with PKCE, scopes and tokens.'
      link: /guide/oauth2
    - title: Instances and federation
      details: One instance per bot, and people, spaces and invites from other instances.
      link: /guide/instances
    - title: REST, errors and rate limits
      details: Typed errors, rate-limit queues, retries, and the REST client without a gateway.
      link: /guide/errors
    - title: Limits and differences
      details: What a bot can see in encrypted rooms, and what works differently on Strafe.
      link: /guide/limits
    - title: Examples
      details: Complete, typechecked programs, from ping pong to an OAuth2 login server.
      link: /examples
    - title: Changelog
      details: What changed in each release.
      link: /changelog
---

<StrafeHome>
<template #code>

```sh
npm install @strafechat/strafe.js
```

```ts
import { Client, Events } from '@strafechat/strafe.js';

// No default instance: name the one your bot lives on.
const client = new Client({ instance: 'app.strafe.chat' });

client.once(Events.ClientReady, (ready) => {
  console.log(`In ${ready.spaces.cache.size} spaces`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content === '!ping') {
    await message.reply('Pong!');
  }
});

await client.login(process.env.STRAFE_TOKEN);
```

</template>
</StrafeHome>

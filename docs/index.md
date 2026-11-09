---
layout: home

hero:
  name: strafe.js
  text: Strafe bots in TypeScript
  tagline: The official library for Strafe's gateway, REST API and OAuth2. Shaped like discord.js, with Strafe's own words.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Coming from discord.js
      link: /guide/coming-from-discord-js
    - theme: alt
      text: API reference
      link: /api/index.html
      target: _self

features:
  - title: Familiar
    details: Client, Events, Collection, EmbedBuilder, PermissionsBitField, message.reply(), member.roles.add(). If you know discord.js, you know most of it already.
  - title: Federated
    details: Every instance is independent. Point the client at yours; handles are name@domain and invites can be code@domain.
  - title: Honest about encryption
    details: Private messages are end-to-end encrypted and bots cannot read them. The library tells you before it makes a request, not after.
  - title: Small
    details: ESM, zero runtime dependencies, Node.js 22.12+, Bun and Deno. The REST client and OAuth2 helpers work without a bot.
---

```ts
import { Client, Events } from '@strafechat/strafe.js';

const client = new Client({ instance: 'app.strafe.chat' });

client.on(Events.MessageCreate, async (message) => {
  if (message.content === '!ping') await message.reply('Pong!');
});

await client.login(process.env.STRAFE_TOKEN);
```

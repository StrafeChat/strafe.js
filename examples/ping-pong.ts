// The smallest useful bot: answers `!ping` with "Pong!" and the gateway latency.
//
//   STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=... node examples/ping-pong.ts
//
// (Node 22.18+ runs TypeScript directly; on older versions use `npx tsx`.)
import { Client, Events } from '@strafechat/strafe.js';

// The instance comes from STRAFE_INSTANCE. Every instance is independent, so there is no default.
const client = new Client({ instance: process.env.STRAFE_INSTANCE });

client.once(Events.ClientReady, (ready) => {
  console.log(`Logged in as ${ready.user.tag ?? ready.user.id} in ${String(ready.spaces.cache.size)} spaces`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots (including this one), and messages the bot cannot read: in an end-to-end
  // encrypted room, `content` is null.
  if (message.author.bot === true || message.content === null) return;

  if (message.content === '!ping') {
    await message.reply(`Pong! (${String(client.ws.ping)} ms)`);
  }
});

// An error thrown by a listener is emitted here instead of stopping the bot.
client.on(Events.Error, (error) => {
  console.error(error);
});

// Reads STRAFE_TOKEN.
await client.login();

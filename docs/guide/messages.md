# Messages and embeds

## Sending

Every room that holds messages has `send()`: space text rooms, the text chat of voice rooms,
threads, and group PMs. It takes a string or an options object and returns the sent `Message`.

```ts
await room.send('Hello!');

await room.send({
  content: 'Here is the report.',
  embeds: [new EmbedBuilder().setTitle('Report').setColor('Blue')],
  files: [new AttachmentBuilder(new URL('./report.pdf', import.meta.url))],
  reply: { messageReference: someMessage }, // or its id
});

await message.reply('Got it.'); // the same as send() with reply set
```

| Option | Notes |
| --- | --- |
| `content` | At most 4000 characters, counted in Unicode code points. Mentions in it notify people. |
| `embeds` | At most 10. `EmbedBuilder`, a received `Embed`, or plain data. Bots only, with Embed Links. |
| `files` | At most 10. Uploaded to the room first, then attached. Needs Attach Files. |
| `reply` | `{ messageReference }`: a message of the same room, or its id. |

A message needs at least one of `content`, `embeds` or `files`. Everything the library can check
is checked before any request, and breaking a rule throws instead of sending:

| Error code | Why |
| --- | --- |
| `RoomEncrypted` | The room is end-to-end encrypted. A bot can neither read nor post there. |
| `PMsEncrypted` | The room is a 1:1 PM, which is always encrypted. `user.send()` always rejects with this. |
| `RoomNotTextBased` | The room is a section, which holds no messages. |
| `MessageEmpty` | No content, embeds or files. |
| `MessageTooLarge` | More than 4000 characters, 10 embeds or 10 files. |
| `EmbedInvalid` | An embed breaks a limit; `error.path` says where (`embeds[0].fields[3].value`). |

`room.isSendable()` tells you up front whether a room holds messages and is not encrypted. It
narrows the type, so `send()` is available after it:

```ts
const room = client.rooms.cache.get(roomId);
if (room?.isSendable()) await room.send('Still here.');
```

### No allowedMentions

Strafe finds mentions in the text itself (`<@id>`, `<@&roleId>`, `@everyone`, `@here`) and has no
way to send text without notifying the people it names. The library therefore has no
`allowedMentions` option: offering it would promise something it cannot do. Passing one anyway
emits a single warning.

When you repeat text you did not write, defuse it first:

```ts
import { escapeMentions } from '@strafechat/strafe.js';

await room.send(`You said: ${escapeMentions(message.content ?? '')}`);
```

`@everyone` and `@here` only notify when the author has Mention Everyone, and a role mention only
notifies when the role is mentionable or the author has Mention Everyone.

### Formatting

Strafe renders Markdown much like Discord. The formatters build it for you:

```ts
import { bold, codeBlock, hyperlink, roleMention, roomMention, time, TimestampStyles, userMention } from '@strafechat/strafe.js';

await room.send(`${userMention(user.id)} ${bold('read')} ${roomMention(rulesRoomId)} before ${time(deadline, TimestampStyles.ShortDateTime)}`);
await room.send(codeBlock('ts', 'const answer = 42;'));
```

`escapeMarkdown()` escapes Markdown in text you did not write. Structures stringify to their
mention: `` `${user}` `` is `<@id>`, `` `${room}` `` is `<#id>`, `` `${role}` `` is `<@&id>`.

## Editing and deleting

```ts
const sent = await room.send('Working...');
await sent.edit('Done.');
await sent.edit({ embeds: [embed] }); // the text stays as it was
await sent.delete();
```

Only the author can edit a message, and only its text and embeds: files cannot be added or
removed, and the text cannot be cleared (an empty `content` keeps the old text). `embeds: []`
removes the embeds. `message.editable` and `message.deletable` say whether the client may.

The bot can delete its own messages anywhere, and other people's messages in space text rooms and
threads with Manage Messages. Other people's messages in PMs and in voice-room chats can never be
deleted.

### Bulk delete

```ts
const deleted = await room.bulkDelete(50); // the 50 newest messages
await room.bulkDelete([idA, idB]);
```

Strafe has no bulk-delete endpoint, so `bulkDelete()` sends one `DELETE` per message (at most 100
per call) through the rate limiter. A large batch takes a while. When some deletions fail it throws
a `BulkDeleteError` holding `deleted` and `failed` collections.

## Reactions

```ts
await message.react('👍');
await message.react('<:party:2102226824774811648>'); // a custom emoji: its text form, id, or Emoji
const reaction = message.reactions.cache.get('👍');
await reaction?.remove(); // removes the bot's own reaction
const users = await reaction?.users.fetch();
```

- Starting a new reaction needs Add Reactions; adding to an existing one does not. A message holds
  at most 20 different emoji.
- The bot can only remove its own reactions. Strafe has no endpoint to remove someone else's
  reaction or all reactions, so `reaction.users.remove(otherUser)` and
  `message.reactions.removeAll()` reject.
- `message.reactions.cache` is keyed by the unicode emoji, or by the custom emoji's id.
  `reaction.emoji` is the space's `SpaceEmoji` when it is cached, otherwise a `ReactionEmoji`.

## Waiting for replies and reactions

Collectors work as in discord.js: every room that holds messages has `createMessageCollector()`
and `awaitMessages()`, and every message has `createReactionCollector()` and `awaitReactions()`.

```ts
// A confirmation: the next message from the same person, within 30 seconds.
await message.reply('Type `yes` to confirm.');
try {
  const replies = await message.room.awaitMessages({
    filter: (reply) => reply.author.id === message.author.id,
    max: 1,
    time: 30_000,
    errors: ['time'],
  });
  if (replies.first()?.content === 'yes') await message.reply('Done.');
} catch {
  await message.reply('No answer; cancelled.');
}

// A poll: count the votes for a minute.
const poll = await room.send('Lunch at noon? React with 👍 or 👎.');
const collector = poll.createReactionCollector({ time: 60_000 });
collector.on('collect', (reaction, user) => console.log(`${user.username} voted ${reaction.emoji.name}`));
collector.on('end', (collected) => console.log(`${collected.get('👍')?.count ?? 0} for, ${collected.get('👎')?.count ?? 0} against`));
```

- The options are discord.js's: `filter`, `max`, `time`, `idle` and `dispose`, plus `maxProcessed`
  for messages and `maxEmojis` and `maxUsers` for reactions. `collector.stop()` ends one early.
- `await*` resolves with the collection when the collector ends, or rejects **with that
  collection** when its end reason is listed in `errors` (`['time']`), as in discord.js.
- A collector also ends when its room, thread, space or (for reactions) message is deleted, with
  the reason `roomDelete`, `threadDelete`, `spaceDelete` or `messageDelete`.
- Messages in an end-to-end encrypted room are collected too, with `content === null`.
- Reaction collectors are keyed like `message.reactions.cache`: the unicode emoji, or the custom
  emoji's id.

## Pins and typing

```ts
await message.pin();   // Manage Messages in spaces; anyone in a PM
await message.unpin();
const pins = await room.messages.fetchPins(); // newest pin first, at most 50 per room

await room.sendTyping(); // shows "typing..." for about 5 seconds
```

## Fetching messages

`room.messages` caches the newest 200 messages per room by default (see
[Caching](./spaces.md#caching)). Fetch older ones, or one by id:

```ts
const latest = await room.messages.fetch();                 // the newest 50
const page = await room.messages.fetch({ limit: 100, before: latest.lastKey() });
const around = await room.messages.fetch({ around: messageId, limit: 25 });
const one = await room.messages.fetch(messageId);
```

`limit` is 1 to 100 (default 50) and at most one of `before`, `after` and `around` applies. Pages
come back as a `Collection` sorted newest first, whatever the cursor.

`room.messages.search({ query, author, mentions, has, before, limit })` searches a room's history.
Encrypted rooms answer `searchable: false`.

## What a message carries

| Property | Notes |
| --- | --- |
| `content` | The text, or `null` when the bot cannot read it (`encrypted === true`) or the message is partial. |
| `author`, `member` | The sender, and their member when cached (`null` in PMs or before the member list is fetched). |
| `room`, `space` | `space` is `null` in PMs; `message.inSpace()` narrows it to `Space`. |
| `embeds`, `attachments` | Received embeds (`Embed`) and files (`Attachment`, with `url`, `name`, `contentType`, `size`). |
| `mentions` | `users`, `roles`, `rooms`, `everyone`, `repliedUser`, and `has()`. |
| `reference` | The message this one replies to; `fetchReference()` fetches it. |
| `system`, `systemData` | System notices (member joined, message pinned, thread created...) with their parsed data. |
| `pinned`, `createdAt`, `editedAt` | |

`cleanContent` is the text with mentions replaced by names.

## Embeds

Embeds are rich cards under a message: a title, a description, fields, images, an author and a
footer. On Strafe only bots can send them, they need the Embed Links permission, and they cannot go
into end-to-end encrypted rooms.

```ts
import { EmbedBuilder } from '@strafechat/strafe.js';

const embed = new EmbedBuilder()
  .setTitle('Server status')
  .setURL('https://status.example.org')
  .setDescription('All systems normal.')
  .setColor('Green') // a Colors name, '#57f287', 0x57f287, or [87, 242, 135]
  .setAuthor({ name: 'Status bot', iconURL: 'https://example.org/bot.png' })
  .addFields(
    { name: 'API', value: '42 ms', inline: true },
    { name: 'Gateway', value: '38 ms', inline: true },
  )
  .setFooter({ text: 'Checked every minute' })
  .setTimestamp();

await room.send({ embeds: [embed] });
```

The limits are Discord's numbers, counted in Unicode code points after trimming:

| | Limit |
| --- | --- |
| Embeds per message | 10 |
| Title, author name, field name | 256 |
| Description | 4096 |
| Fields | 25 |
| Field value | 1024 |
| Footer text | 2048 |
| All of the above, over every embed of a message | 6000 |
| Any URL | 2048 bytes, `http` or `https` |

`EmbedLimits` exports them, and `validateEmbed()` checks an embed without sending it.

### Images

External images are fetched by the instance and served through its image proxy, so readers never
contact the site that hosts them; any public `http(s)` image works. A received embed has the
proxied address in `embed.image?.proxyURL` (and likewise for the thumbnail and icons).

To show a file you upload with the message, name it with `attachment://` in the image, thumbnail,
author icon or footer icon. It must be a png, jpeg, gif or webp image:

<<< @/../examples/embeds.ts#chart{ts}

## Files

`files` takes `AttachmentBuilder`s, `{ attachment, name }` objects, received `Attachment`s (downloaded
and uploaded again), or the data itself: a `Buffer` or other bytes, a `Blob`, a `ReadableStream`, a
local file as a `file:` `URL` object (Node.js, Bun and Deno), or an `http(s)` URL to download.

Unlike discord.js, **a string is never read as a local path**. Strings are often user input, and
`message.reply({ files: [args[0]] })` would otherwise post `/proc/self/environ` or your `.env`
(with the bot token) to the room. Name local files explicitly with `new URL('./file', import.meta.url)`
or `pathToFileURL(path)` from `node:url`; any other string rejects with `FileInvalid`. Downloading an
`http(s)` URL that someone else chose still fetches it from the bot's network, so check the host
before passing user input.

```ts
import { pathToFileURL } from 'node:url';
import { AttachmentBuilder } from '@strafechat/strafe.js';

await room.send({ files: [pathToFileURL('./logs/today.txt')] });
await room.send({ files: [new AttachmentBuilder(pngBuffer, { name: 'chart.png', width: 800, height: 400 })] });
```

The instance sets the largest file it accepts; a larger one fails with a `413` `StrafeAPIError`
whose `rawError.max_bytes` gives the limit.

## Threads

```ts
const thread = await message.startThread({ name: 'Discussion' });
await thread.send('Thoughts?');

const standalone = await textRoom.threads.create({ name: 'Planning', private: true });
```

Threads are rooms (`ThreadRoom`) under a space text room. They inherit the parent room's
permissions, and posting in them needs Send Messages in Threads.

# Messages and embeds

## Sending

Space text rooms, voice-room chats, threads and group PMs all have `send()`. It takes a string or
options and returns the sent `Message`.

```ts
await room.send('Hello!');

await room.send({
  content: 'Here is the report.',
  embeds: [new EmbedBuilder().setTitle('Report').setColor('Blue')],
  files: [new AttachmentBuilder(new URL('./report.pdf', import.meta.url))],
  reply: { messageReference: someMessage }, // or its id
});

await message.reply('Got it.');
```

| Option | Notes |
| --- | --- |
| `content` | Up to 4000 Unicode code points. Mentions notify. |
| `embeds` | Up to 10. Bots only, with Embed Links. |
| `files` | Up to 10. Needs Attach Files. |
| `reply` | `{ messageReference }`: a message in the same room, or its id. |

A message needs content, embeds or files. The library validates before sending and throws:

| Error code | Why |
| --- | --- |
| `RoomEncrypted` | The room is end-to-end encrypted. |
| `PMsEncrypted` | The room is a 1:1 PM, which is always encrypted. `user.send()` always throws this. |
| `RoomNotTextBased` | The room is a section. |
| `MessageEmpty` | No content, embeds or files. |
| `MessageTooLarge` | Over 4000 characters, 10 embeds or 10 files. |
| `EmbedInvalid` | An embed breaks a limit; `error.path` says where (`embeds[0].fields[3].value`). |

`room.isSendable()` checks that a room holds messages and is not encrypted, and narrows its type:

```ts
const room = client.rooms.cache.get(roomId);
if (room?.isSendable()) await room.send('Still here.');
```

### No allowedMentions

Strafe always notifies whoever the text mentions (`<@id>`, `<@&roleId>`, `@everyone`, `@here`), so
there is no `allowedMentions` option. Passing one logs a warning. Escape text you did not write:

```ts
import { escapeMentions } from '@strafechat/strafe.js';

await room.send(`You said: ${escapeMentions(message.content ?? '')}`);
```

`@everyone` and `@here` need Mention Everyone. A role mention needs a mentionable role or Mention
Everyone.

### Formatting

```ts
import { bold, codeBlock, hyperlink, roleMention, roomMention, time, TimestampStyles, userMention } from '@strafechat/strafe.js';

await room.send(`${userMention(user.id)} ${bold('read')} ${roomMention(rulesRoomId)} before ${time(deadline, TimestampStyles.ShortDateTime)}`);
await room.send(codeBlock('ts', 'const answer = 42;'));
```

`escapeMarkdown()` escapes Markdown. Users, rooms and roles stringify to their mentions
(`<@id>`, `<#id>`, `<@&id>`).

## Editing and deleting

```ts
const sent = await room.send('Working...');
await sent.edit('Done.');
await sent.edit({ embeds: [embed] }); // keeps the text
await sent.delete();
```

Only the author can edit, and only text and embeds. An empty `content` keeps the old text;
`embeds: []` removes embeds. Check `message.editable` and `message.deletable`.

The bot can delete its own messages anywhere. With Manage Messages it can delete others' messages in
space text rooms and threads, but never in PMs or voice-room chats.

### Bulk delete

```ts
const deleted = await room.bulkDelete(50); // the 50 newest
await room.bulkDelete([idA, idB]);
```

`bulkDelete()` sends one rate-limited `DELETE` per message, up to 100 per call, so large batches are
slow. Partial failure throws a `BulkDeleteError` with `deleted` and `failed` collections.

## Reactions

```ts
await message.react('👍');
await message.react('<:party:2102226824774811648>'); // text form, id, or Emoji
const reaction = message.reactions.cache.get('👍');
await reaction?.remove(); // the bot's own reaction
const users = await reaction?.users.fetch();
```

- A new reaction needs Add Reactions; joining an existing one does not. A message holds up to 20
  different emoji.
- The bot can only remove its own reactions. `reaction.users.remove(otherUser)` and
  `message.reactions.removeAll()` reject.
- `message.reactions.cache` is keyed by the Unicode emoji or the custom emoji's id.

## Waiting for replies and reactions

Rooms have `createMessageCollector()` and `awaitMessages()`; messages have
`createReactionCollector()` and `awaitReactions()`.

```ts
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

const poll = await room.send('Lunch at noon? React with 👍 or 👎.');
const collector = poll.createReactionCollector({ time: 60_000 });
collector.on('collect', (reaction, user) => console.log(`${user.username} voted ${reaction.emoji.name}`));
collector.on('end', (collected) => console.log(`${collected.get('👍')?.count ?? 0} for, ${collected.get('👎')?.count ?? 0} against`));
```

- Options: `filter`, `max`, `time`, `idle`, `dispose`, plus `maxProcessed` (messages) and
  `maxEmojis`, `maxUsers` (reactions). `collector.stop()` ends one early.
- `await*` rejects with the collection when the end reason is in `errors`.
- Deleting the room, thread, space or message ends a collector with `roomDelete`, `threadDelete`,
  `spaceDelete` or `messageDelete`.
- Encrypted messages are collected with `content === null`.

## Pins and typing

```ts
await message.pin();   // Manage Messages in spaces; anyone in a PM
await message.unpin();
const pins = await room.messages.fetchPins(); // newest first, up to 50 per room

await room.sendTyping(); // about 5 seconds
```

## Fetching messages

`room.messages` caches the newest 200 messages per room ([Caching](./spaces.md#caching)).

```ts
const latest = await room.messages.fetch();                 // the newest 50
const page = await room.messages.fetch({ limit: 100, before: latest.lastKey() });
const around = await room.messages.fetch({ around: messageId, limit: 25 });
const one = await room.messages.fetch(messageId);
```

`limit` is 1 to 100 (default 50). Use at most one of `before`, `after` and `around`. Results are
sorted newest first.

`room.messages.search({ query, author, mentions, has, before, limit })` searches history. Encrypted
rooms return `searchable: false`.

## What a message carries

| Property | Notes |
| --- | --- |
| `content` | The text, or `null` when encrypted or partial. |
| `author`, `member` | The sender, and their member when cached (`null` in PMs). |
| `room`, `space` | `space` is `null` in PMs; `message.inSpace()` narrows it. |
| `embeds`, `attachments` | `Embed`s and `Attachment`s (`url`, `name`, `contentType`, `size`). |
| `mentions` | `users`, `roles`, `rooms`, `everyone`, `repliedUser`, `has()`. |
| `reference` | The replied-to message; `fetchReference()` fetches it. |
| `system`, `systemData` | System notices and their parsed data. |
| `pinned`, `createdAt`, `editedAt` | |

`cleanContent` replaces mentions with names.

## Embeds

Only bots can send embeds. They need Embed Links and cannot go into encrypted rooms.

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

Limits are in Unicode code points after trimming:

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

`EmbedLimits` exports them. `validateEmbed()` checks an embed without sending.

### Images

The instance proxies external images, so readers never contact the host. Any public `http(s)` image
works. Received embeds expose the proxied address as `embed.image?.proxyURL` (and likewise for
thumbnails and icons).

To use an uploaded file, reference it as `attachment://name` in the image, thumbnail or an icon. It
must be png, jpeg, gif or webp:

<<< @/../examples/embeds.ts#chart{ts}

## Files

`files` accepts `AttachmentBuilder`s, `{ attachment, name }`, received `Attachment`s, bytes
(`Buffer`, `Blob`, `ReadableStream`), a `file:` `URL`, or an `http(s)` URL to download.

::: warning Strings are never local paths
Unlike discord.js, a string path rejects with `FileInvalid`, so user input cannot upload your `.env`.
Use `new URL('./file', import.meta.url)` or `pathToFileURL(path)`. An `http(s)` URL is fetched from
the bot's network, so check the host before passing user input.
:::

```ts
import { pathToFileURL } from 'node:url';
import { AttachmentBuilder } from '@strafechat/strafe.js';

await room.send({ files: [pathToFileURL('./logs/today.txt')] });
await room.send({ files: [new AttachmentBuilder(pngBuffer, { name: 'chart.png', width: 800, height: 400 })] });
```

Files over the instance's limit fail with a `413` `StrafeAPIError`; `rawError.max_bytes` gives the
limit.

## Threads

```ts
const thread = await message.startThread({ name: 'Discussion' });
await thread.send('Thoughts?');

const standalone = await textRoom.threads.create({ name: 'Planning', private: true });
```

Threads (`ThreadRoom`) live under space text rooms and inherit their permissions. Posting needs Send
Messages in Threads.

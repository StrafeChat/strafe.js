# Limits and differences

Some things are not possible on Strafe, or work differently: rooms can be end-to-end encrypted,
every instance is independent, and some features other platforms have do not exist here. The
library does not paper over them: where the server would refuse, it refuses first with a typed
error, and where an option cannot work, it does not exist. This page lists them in one place, with
the discord.js name beside each for anyone porting a bot.

## Encryption and what a bot can see

Strafe encrypts private messages end to end: the server stores and relays text it cannot read.

- **1:1 PMs** are always end-to-end encrypted.
- **Group PMs** are encrypted by default; the group's creator can turn it off.
- **Space rooms** are plain by default; a room can opt in, and then shows a lock in the client.

A bot has no encryption keys, so it can neither read nor write in an encrypted room. Messages
there still arrive as events, with `message.encrypted === true` and `content === null`, so a bot
knows that something was said but not what. Sending (`room.send()`, `message.reply()`,
`message.edit()`) rejects with `RoomEncrypted` before any request; `room.isEncrypted()` and
`room.isSendable()` tell you beforehand. This is by design, not a missing feature: a bot that
could read encrypted rooms would break the encryption for everyone in them.

### Bots and PMs

Because 1:1 PMs are always encrypted, **a bot cannot send a PM**. `user.send()` and
`member.send()` exist for discord.js compatibility and always reject with `PMsEncrypted`.
`user.createPM()` opens (or finds) the PM room, but the bot cannot post in it. Answer people in a
space room instead, or point them to a website. A group PM whose creator turned encryption off
works like any plain room.

## Things that do not exist

| discord.js | Strafe |
| --- | --- |
| Gateway intents, `partials` | Not needed: a bot receives every event about what it can see, and events about uncached objects always arrive as [partial objects](./events.md#partial-objects). Passing `intents` or `partials` emits a warning. |
| Sharding, `ShardingManager`, `shards` | Not needed: one connection carries everything. |
| Slash commands, context menus, buttons, select menus, modals | Not on Strafe. Use message commands (`!help`) and reactions. |
| Webhooks | Not on Strafe. A bot can post where it has permission. |
| `allowedMentions` | Strafe has no way to send a mention that does not notify. Use `escapeMentions()` on text you did not write. Passing the option emits a warning. |
| Joining voice (`@discordjs/voice`) | Calls are end-to-end encrypted with per-device keys a bot does not have. A bot can see voice states and move, mute or disconnect people. |
| Session resume | Every reconnect is a fresh `READY`; the client reconciles its caches and reports what changed ([Reconnects](./events.md#reconnects)). |
| Looking up any user (`client.users.fetch(id)`) | Only the bot's own user can be fetched. Others come from messages, members and events; `space.members.fetch(id)` brings a member's user along. |
| Removing someone else's reaction, or all reactions | Only the bot's own reaction can be removed. |
| Bulk delete endpoint | `room.bulkDelete()` sends one `DELETE` per message (at most 100), through the rate limiter. |
| Audit log reasons on most actions | Only bans record a reason. `reason` arguments elsewhere are accepted and ignored. |
| Message links | The web client has no link to a single message: `message.url` is the room's URL. |
| Default avatars | `user.displayAvatarURL()` is `null` for someone without an avatar. |
| A space's member count (`space.memberCount`) | Spaces carry no count. Fetch the members once (`space.members.fetch()`) and use `space.members.cache.size`; an invite preview has `invite.memberCount`. |
| Application details (`client.application.fetch()`, owner, commands) | `client.application` is only `{ id }`, the bot's user id, which is also its application's client id. |
| Crossposting, stickers, polls, scheduled events, stage rooms, forum rooms | Not on Strafe. |

## Things that work differently

- **Member lists are not in `READY`.** `space.members.cache` starts empty; fetch it once with
  `space.members.fetch()` when you need it. After a reconnect it may have missed changes.
- **Editing is limited to text and embeds**, and only for the author. Files cannot be added or
  removed and the text cannot be cleared.
- **Embeds are for bots only**, need Embed Links, and cannot go into encrypted rooms. Their limits
  count Unicode code points, not UTF-16 units, so emoji-heavy text hits them sooner than on Discord.
- **Message text** is at most 4000 code points; at most 10 files, 10 embeds, 20 different reaction
  emoji per message, and 50 pins per room.
- **Kicks record no reason**, bans do.
- **Bots are exempt from verification levels** but not from automod.
- **POST requests are not retried** after a timeout or a `5xx` other than `503`, because Strafe has
  no idempotency key and a retry could post twice ([Retries](./errors.md#retries-and-timeouts)).
- **There is no default instance.** Every client names one ([Instances](./instances.md)).

## Gateway limits

- The server buffers at most 512 unsent frames per connection and silently drops events when the
  buffer is full. strafe.js reads frames as they arrive and handles them from its own queue, so a
  slow listener (or a fetch for an uncached room) never blocks the socket. Events are still handled
  in order.
- A connection can hold at most 5000 subscriptions. A bot is subscribed by the server to its spaces,
  rooms and threads; past 5000, further subscriptions are silently ignored and their events do not
  arrive. `client.ws.subscribe()` and `unsubscribe()` exist for completeness; bots rarely need them.
- One connection per bot is enough. An account may hold at most 25 connections; logging in twice
  with the same token opens two connections that both receive everything.

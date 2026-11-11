# Limits and differences

What Strafe cannot do, or does differently, with the discord.js name beside each. Where the server
would refuse, the library refuses first with a typed error.

## Encryption and what a bot can see

- 1:1 PMs are always end-to-end encrypted.
- Group PMs are encrypted by default. The creator can turn it off.
- Space rooms are plain by default and can opt in.

A bot has no encryption keys, so it cannot read or write in an encrypted room. Messages there still
arrive, with `message.encrypted === true` and `content === null`. `room.send()`, `message.reply()` and
`message.edit()` reject with `RoomEncrypted` before any request. Check `room.isEncrypted()` or `room.isSendable()` first.

### Bots and PMs

A bot cannot send a PM. `user.send()` and `member.send()` always reject with `PMsEncrypted`.
`user.createPM()` returns the PM room, but the bot cannot post in it. Reply in a space room instead.
A group PM with encryption turned off works like any plain room.

## Things that do not exist

| discord.js | Strafe |
| --- | --- |
| Gateway intents, `partials` | Not needed. A bot gets every event about what it can see; uncached objects arrive as [partial objects](./events.md#partial-objects). Passing either emits a warning. |
| Sharding, `ShardingManager`, `shards` | Not needed. One connection carries everything. |
| Slash commands, context menus, buttons, select menus, modals | Use message commands (`!help`) and reactions. |
| Webhooks | A bot can post where it has permission. |
| `allowedMentions` | Every mention notifies. Use `escapeMentions()` on text you did not write. Passing the option emits a warning. |
| Joining voice (`@discordjs/voice`) | Calls are end-to-end encrypted. A bot can see voice states and move, mute or disconnect people. |
| Session resume | Every reconnect is a fresh `READY` ([Reconnects](./events.md#reconnects)). |
| `client.users.fetch(id)` | Only the bot's own user. `space.members.fetch(id)` brings a member's user along. |
| Removing others' reactions, or all reactions | Only the bot's own reaction. |
| Bulk delete endpoint | `room.bulkDelete()` sends one `DELETE` per message (at most 100). |
| Audit log reasons | Only bans record a reason. Other `reason` arguments are ignored. |
| Message links | `message.url` is the room's URL. |
| Default avatars | `user.displayAvatarURL()` is `null` without an avatar. |
| `space.memberCount` | Use `space.members.cache.size` after `space.members.fetch()`, or `invite.memberCount`. |
| `client.application.fetch()`, owner, commands | `client.application` is only `{ id }`, the bot's user id. |
| Crossposting, stickers, polls, scheduled events, stage rooms, forum rooms | Not on Strafe. |

## Things that work differently

- `space.members.cache` starts empty, and after a reconnect it may have missed changes. Call
  `space.members.fetch()` when you need it.
- Only the author can edit, and only text and embeds: files cannot be added or removed. Text cannot be
  cleared.
- Embeds are bot-only, need Embed Links, and cannot go into encrypted rooms. Their limits count
  code points, not UTF-16 units.
- Messages: at most 4000 code points, 10 files, 10 embeds and 20 different reaction emoji. Rooms:
  at most 50 pins.
- Bots are exempt from verification levels, not from automod.
- `POST` requests are not retried after a timeout or a non-`503` `5xx`
  ([Retries](./errors.md#retries-and-timeouts)).
- There is no default instance ([Instances](./instances.md)).

## Gateway limits

- The server buffers at most 512 unsent frames per connection and drops events past that.
  strafe.js reads frames as they arrive, so a slow listener never blocks the socket.
- A connection holds at most 5000 subscriptions. Past that, events for further spaces, rooms and
  threads do not arrive.
- An account may hold at most 25 connections. Logging in twice opens two connections that both
  receive everything.

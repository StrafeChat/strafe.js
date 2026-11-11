# Events

The client is an event emitter: `on`, `once`, `off`, `emit`, `removeAllListeners` and
`listenerCount` (the same method names as discord.js). Event names are the camelCase values of the
`Events` enum, and the `ClientEvents` interface types each listener's arguments.

```ts
import { Events } from '@strafechat/strafe.js';

client.on(Events.SpaceMemberAdd, async (member) => {
  const room = member.space.systemRoom;
  if (room?.isSendable()) await room.send(`Welcome, ${member.toString()}!`);
});
```

There are no intents. A bot is subscribed by the server to every space, room and thread it can
see, from `READY` on and as it gains access, and it receives every event about them.

## The events

| Event | Listener arguments | When |
| --- | --- | --- |
| `ClientReady` (`'clientReady'`, also `'ready'`) | `client: Client<true>` | The first `READY`; once per `login()` |
| `GatewayReady` | none | Every `READY`, reconnects included |
| `Reconnecting` | none | The connection dropped; a reconnect is scheduled |
| `Reconnected` | none | A reconnect reached `READY` and the caches were reconciled |
| `Invalidated` | `reason: string` | The session ended for good (token reset, account banned); the client stopped |
| `MessageCreate` | `message` | A message was sent (system notices and encrypted messages included) |
| `MessageUpdate` | `oldMessage`, `newMessage` | A message was edited |
| `MessageDelete` | `message` | A message was deleted |
| `MessageReactionAdd` | `reaction`, `user` | Someone reacted |
| `MessageReactionRemove` | `reaction`, `user` | Someone removed their reaction |
| `RoomPinsUpdate` | `room`, `date: Date \| null`, `details` | A message was pinned or unpinned (`details.messageId`, `pinned`, `userId`) |
| `TypingStart` | `typing` | Someone started typing |
| `SpaceCreate` | `space` | The bot joined a space (or was installed in one) |
| `SpaceUpdate` | `oldSpace`, `newSpace` | A space's settings changed |
| `SpaceDelete` | `space` | The bot left or was removed, or the space was deleted |
| `SpaceMemberAdd` | `member` | Someone joined a space |
| `SpaceMemberUpdate` | `oldMember`, `newMember` | Roles, nickname or space profile changed |
| `SpaceMemberRemove` | `member` | Someone left, or was kicked or banned |
| `RoomCreate`, `RoomDelete` | `room` | A room was created or deleted (or became visible or invisible to the bot) |
| `RoomUpdate` | `oldRoom`, `newRoom` | A room's settings, position or permission overrides changed |
| `RoleCreate`, `RoleDelete` | `role` | A role was created or deleted |
| `RoleUpdate` | `oldRole`, `newRole` | A role changed |
| `ThreadCreate` | `thread`, `newlyCreated: boolean` | A thread was created (`false` when an existing one became visible) |
| `ThreadUpdate` | `oldThread`, `newThread` | A thread changed (name, archived, locked...) |
| `ThreadDelete` | `thread` | A thread was deleted |
| `ThreadMembersUpdate` | `added`, `removed`, `thread` | People joined or left a thread |
| `EmojiCreate`, `EmojiDelete` | `emoji` | A custom emoji was added or deleted |
| `EmojiUpdate` | `oldEmoji`, `newEmoji` | A custom emoji was renamed |
| `PresenceUpdate` | `oldPresence \| null`, `newPresence` | Someone's status or activity changed |
| `UserUpdate` | `oldUser`, `newUser` | Someone's profile changed |
| `VoiceStateUpdate` | `oldState`, `newState` | Someone joined, left or moved in voice, or was muted |
| `Raw` | `packet` | Every gateway frame, as received |
| `Debug` | `message: string` | Diagnostics (`[gateway] ...` lines and more) |
| `Warn` | `message: string` | Something odd that did not stop the client: a gateway error frame, an option Strafe does not have |
| `Error` | `error: Error` | An error from a listener or from the library's event handling |

Gateway events the client does not turn into one of these (read receipts, call signalling,
encryption key traffic) are still available through `Events.Raw`.

## Old and new objects

Update events pass the cached object as it was before the change (a copy) and the cached object as
it is now. The new one is the live cache entry, patched in place: if you need a value as it is at
this moment, copy the value, not the object.

```ts
client.on(Events.SpaceMemberUpdate, (oldMember, newMember) => {
  const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
  if (added.size > 0) console.log(`${newMember.displayName} got ${added.map((r) => r.name).join(', ')}`);
});
```

## Partial objects

Strafe sends events about things the client may not have cached: a reaction on a message from
before the bot started, an edit of an uncached message, a member who left before the member list
was fetched. Those events still fire, with **partial** objects that hold only what the event said.
Check `partial` and fetch when you need more:

```ts
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  console.log(`${user.id} reacted ${reaction.emoji.toString()} to ${message.id}`);
});
```

- A partial message has its `id`, `room` and `space`; `author` and `content` are `null` until
  fetched. `MessageDelete` gives a partial message when the message was not cached (it cannot be
  fetched any more).
- A reaction from an event may not know its `count` (`reaction.partial`); `reaction.fetch()`
  re-reads the message.
- `oldMember` in `SpaceMemberUpdate`, and the member in `SpaceMemberRemove`, are partial when the
  member was not cached.

There is no `partials` option to turn this on: it is always on.

## Members are not in READY

`READY` carries the bot's spaces with their roles, rooms, emojis and voice states, but not their
member lists. `space.members.cache` starts empty and fills from events and fetches. Fetch the list
once if the bot needs it:

```ts
client.on(Events.ClientReady, async (ready) => {
  for (const space of ready.spaces.cache.values()) await space.members.fetch();
});
```

`message.member` is `null` until the author's member is cached; `space.members.fetch(id)` returns
the cached member when there is one.

## Reconnects

The connection drops sometimes: a server restart, a network change. The client reconnects on its
own with exponential backoff and jitter (1 second, doubling, at most a minute, configurable through
`ws.reconnectDelay` and `ws.maxReconnectDelay`) and emits `Reconnecting`.

Strafe has no session resume. Each reconnect gets a fresh `READY`, and the client reconciles its
caches with it:

- Spaces, rooms and threads that appeared or disappeared while offline are reported as
  `SpaceCreate`/`SpaceDelete`, `RoomCreate`/`RoomDelete` and `ThreadDelete`, then `GatewayReady`
  and `Reconnected` fire. `ClientReady` does not fire again.
- `READY` lists only active threads and the archived threads the bot joined. A cached thread it
  leaves out is kept and marked `archived` (and not joined) rather than reported deleted; it goes
  away on `ThreadDelete` or with its parent room.
- Cached objects keep their identity and are patched in place. Changes to room or space settings
  made while offline are applied without an event.
- Messages sent while the bot was offline are not replayed. Fetch them if they matter:
  `room.messages.fetch({ after: lastSeenId })`.
- Member lists are not in `READY`, so they keep what they had and may have missed joins, leaves and
  role changes. Fetch them again after `Reconnected` if the bot depends on them.

If the token is reset, or the account is banned from the instance, the server revokes the session.
The client emits `Invalidated` and stops without reconnecting.

## Latency and raw frames

`client.ws.ping` is the round-trip time of the last latency ping, in milliseconds (`-1` until the
first one). `client.ws.status` is the connection state. `Events.Raw` receives every frame; the
payload shapes are exported as `GatewayDispatchDataMap` and `GatewayReceivePayload`.

```ts
client.on(Events.Debug, (line) => console.debug(line));
client.on(Events.Warn, (line) => console.warn(line));
```

## Organising handlers

The `ClientEvents` interface makes a typed handler-per-file layout straightforward:

```ts
// events/messageCreate.ts
import { Events, type ClientEvents } from '@strafechat/strafe.js';

export const name = Events.MessageCreate;
export async function execute(...[message]: ClientEvents[typeof name]): Promise<void> {
  if (message.content === '!hello') await message.reply('Hello!');
}
```

```ts
// index.ts
import * as messageCreate from './events/messageCreate.js';

client.on(messageCreate.name, messageCreate.execute);
```

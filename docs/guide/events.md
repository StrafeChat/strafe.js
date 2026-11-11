# Events

The client is an event emitter with `on`, `once`, `off`, `emit`, `removeAllListeners` and
`listenerCount`. Event names come from the `Events` enum; `ClientEvents` types each listener.

```ts
import { Events } from '@strafechat/strafe.js';

client.on(Events.SpaceMemberAdd, async (member) => {
  const room = member.space.systemRoom;
  if (room?.isSendable()) await room.send(`Welcome, ${member.toString()}!`);
});
```

There are no intents. The bot receives every event about the spaces, rooms and threads it can see.

## The events

| Event | Listener arguments | When |
| --- | --- | --- |
| `ClientReady` (`'clientReady'`, also `'ready'`) | `client: Client<true>` | First `READY`; once per `login()` |
| `GatewayReady` | none | Every `READY`, reconnects included |
| `Reconnecting` | none | The connection dropped; a reconnect is scheduled |
| `Reconnected` | none | A reconnect reached `READY` and caches were reconciled |
| `Invalidated` | `reason: string` | The session ended for good; the client stopped |
| `MessageCreate` | `message` | A message was sent, including system and encrypted ones |
| `MessageUpdate` | `oldMessage`, `newMessage` | A message was edited |
| `MessageDelete` | `message` | A message was deleted |
| `MessageReactionAdd` | `reaction`, `user` | Someone reacted |
| `MessageReactionRemove` | `reaction`, `user` | Someone removed a reaction |
| `RoomPinsUpdate` | `room`, `date: Date \| null`, `details` | A message was pinned or unpinned (`details.messageId`, `pinned`, `userId`) |
| `TypingStart` | `typing` | Someone started typing |
| `SpaceCreate` | `space` | The bot joined or was installed in a space |
| `SpaceUpdate` | `oldSpace`, `newSpace` | A space's settings changed |
| `SpaceDelete` | `space` | The bot left or was removed, or the space was deleted |
| `SpaceMemberAdd` | `member` | Someone joined a space |
| `SpaceMemberUpdate` | `oldMember`, `newMember` | Roles, nickname or space profile changed |
| `SpaceMemberRemove` | `member` | Someone left, or was kicked or banned |
| `RoomCreate`, `RoomDelete` | `room` | A room was created or deleted, or became visible or invisible |
| `RoomUpdate` | `oldRoom`, `newRoom` | Settings, position or permission overrides changed |
| `RoleCreate`, `RoleDelete` | `role` | A role was created or deleted |
| `RoleUpdate` | `oldRole`, `newRole` | A role changed |
| `ThreadCreate` | `thread`, `newlyCreated: boolean` | A thread was created (`false` when an existing one became visible) |
| `ThreadUpdate` | `oldThread`, `newThread` | A thread changed |
| `ThreadDelete` | `thread` | A thread was deleted |
| `ThreadMembersUpdate` | `added`, `removed`, `thread` | People joined or left a thread |
| `EmojiCreate`, `EmojiDelete` | `emoji` | A custom emoji was added or deleted |
| `EmojiUpdate` | `oldEmoji`, `newEmoji` | A custom emoji was renamed |
| `PresenceUpdate` | `oldPresence \| null`, `newPresence` | Status or activity changed |
| `UserUpdate` | `oldUser`, `newUser` | A profile changed |
| `VoiceStateUpdate` | `oldState`, `newState` | Someone joined, left, moved or was muted in voice |
| `Raw` | `packet` | Every gateway frame |
| `Debug` | `message: string` | Diagnostics |
| `Warn` | `message: string` | A non-fatal problem, such as a gateway error frame or an unsupported option |
| `Error` | `error: Error` | An error from a listener or from event handling |

Other gateway events, such as read receipts and call signalling, arrive through `Events.Raw`.

## Old and new objects

Update events pass a copy of the object before the change and the live cache entry after it. The
live entry is patched in place, so copy values you want to keep.

```ts
client.on(Events.SpaceMemberUpdate, (oldMember, newMember) => {
  const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
  if (added.size > 0) console.log(`${newMember.displayName} got ${added.map((r) => r.name).join(', ')}`);
});
```

## Partial objects

Events about uncached things still fire, with **partial** objects. Check `partial` and fetch when
you need more:

```ts
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  console.log(`${user.id} reacted ${reaction.emoji.toString()} to ${message.id}`);
});
```

- A partial message has `id`, `room` and `space`. `author` and `content` are `null` until fetched.
  A deleted uncached message stays partial.
- A reaction may lack its `count`; `reaction.fetch()` re-reads the message.
- `oldMember` in `SpaceMemberUpdate` and the member in `SpaceMemberRemove` are partial when the
  member was not cached.

Partials are always on; there is no `partials` option.

## Members are not in READY

`READY` carries spaces, roles, rooms, emojis and voice states, but no member lists.
`space.members.cache` starts empty. Fetch it once if you need it:

```ts
client.on(Events.ClientReady, async (ready) => {
  for (const space of ready.spaces.cache.values()) await space.members.fetch();
});
```

`message.member` is `null` until the author's member is cached.

## Reconnects

The client reconnects on its own with exponential backoff (1 second, doubling, up to a minute; set
`ws.reconnectDelay` and `ws.maxReconnectDelay`) and emits `Reconnecting`.

Strafe has no session resume. Each reconnect gets a fresh `READY`, and the client reconciles its
caches:

- Spaces, rooms and threads that changed while offline emit `SpaceCreate`/`SpaceDelete`,
  `RoomCreate`/`RoomDelete` and `ThreadDelete`. Then `GatewayReady` and `Reconnected` fire.
  `ClientReady` does not fire again.
- A cached thread missing from `READY` is marked `archived` instead of deleted.
- Cached objects are patched in place. Settings changes made while offline emit no event.
- Missed messages are not replayed. Use `room.messages.fetch({ after: lastSeenId })`.
- Member lists may be stale. Fetch them again after `Reconnected` if you depend on them.

If the token is reset or the account is banned, the client emits `Invalidated` and stops.

## Latency and raw frames

`client.ws.ping` is the last round-trip time in milliseconds (`-1` before the first).
`client.ws.status` is the connection state. Raw payload types are exported as
`GatewayDispatchDataMap` and `GatewayReceivePayload`.

```ts
client.on(Events.Debug, (line) => console.debug(line));
client.on(Events.Warn, (line) => console.warn(line));
```

## Organising handlers

Use `ClientEvents` to type one handler per file:

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

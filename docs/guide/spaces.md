# Spaces, members and roles

A **space** holds rooms, roles, members, custom emojis, invites and bans. Each is reached through a
manager on the `Space`, with discord.js's shape: a `cache` (a [`Collection`](#collections)),
`fetch()`, `resolve()` and `resolveId()`, plus `create`/`edit`/`delete` where the API allows.

| Manager | Holds | Filled from |
| --- | --- | --- |
| `client.spaces` | Spaces the bot is in | `READY`, then events |
| `client.rooms` | Every room: space rooms, threads, PMs | `READY`, then events |
| `client.users` | Users the bot has seen | Messages, members, events |
| `client.emojis` | Custom emojis of every space | `READY`, then events |
| `space.rooms` | The space's rooms and sections | `READY` |
| `space.members` | Members | **Fetches** and events (not in `READY`) |
| `space.roles` | Roles | `READY` |
| `space.emojis`, `space.bans`, `space.invites` | Emojis; bans and invites when fetched | |
| `space.voiceStates` | Who is in which voice room | `READY` |
| `member.roles` | The member's roles | The member |
| `room.messages` | Messages of a room | Events and fetches |
| `textRoom.threads` | Threads of a text room | `READY`, events |

## Spaces

```ts
const cached = client.spaces.cache.get(spaceId); // undefined when the bot is not in it
const space = await client.spaces.fetch(spaceId); // asks the server

await space.edit({ name: 'Book club', description: 'Reading together' });
await space.setIcon(new URL('./icon.png', import.meta.url));
const owner = await space.fetchOwner();
await space.leave();
```

A few settings have Strafe names: the inactive voice room (Discord's AFK room) is
`space.inactiveRoomId` with `inactiveTimeout`, the system messages room is `space.systemRoomId`, and
the space widget is `space.widgetEnabled` / `space.fetchWidget()`. `space.fetchAuditLogs()` reads the
audit log (it needs Manage Space; Strafe has no separate View Audit Log permission). Transferring and deleting a space are for its
owner only.

A space can be hosted on another instance and mirrored on the bot's own: then `space.federated` is
`true` and `space.federation` names the origin. The API is the same; see
[Instances and federation](./instances.md).

## Rooms and sections

Rooms are typed by `type` (the `RoomType` enum) and the classes narrow with guards:

| Class | `RoomType` | Guard |
| --- | --- | --- |
| `PMRoom` | `PM` (1) | `isPM()`, `isPMBased()` |
| `GroupPMRoom` | `GroupPM` (2) | `isGroupPM()`, `isPMBased()` |
| `TextRoom` | `SpaceText` (3) | `isTextRoom()` |
| `VoiceRoom` | `SpaceVoice` (4) | `isVoiceBased()` |
| `SectionRoom` | `SpaceSection` (5) | `isSection()` |
| `ThreadRoom` | `Thread` (6) | `isThread()` |

`isTextBased()` (anything with messages, which includes a voice room's text chat), `isSendable()`
(text-based and not encrypted), `isSpaceBased()` and `isEncrypted()` work on every room.

A **section** groups rooms in the sidebar. Rooms in a section can keep
their permissions synced with it.

```ts
import { RoomType } from '@strafechat/strafe.js';

const section = await space.rooms.create({ name: 'Projects', type: RoomType.SpaceSection });
const room = await space.rooms.create({ name: 'roadmap', parent: section, topic: 'What is next' });
await room.setRateLimitPerUser(10); // slowmode, in seconds
await room.setParent(null);         // out of the section
await room.lockPermissions();       // sync with the section again
for (const child of section.children.values()) console.log(child.name);
```

Creating, editing, moving and deleting rooms needs Manage Rooms. `room.permissionOverwrites` edits
the room's overrides; see [Permissions](./permissions.md#overrides).

## Members

Member lists are **not** part of `READY`. `space.members.cache` holds only the members the bot has
fetched or seen in events, so fetch before relying on it:

```ts
await space.members.fetch();                     // everyone, cached
const member = await space.members.fetch(userId); // one (cached when possible)
const me = await space.members.fetchMe();         // the bot itself
```

`space.members.me` is the bot's member once cached.

```ts
await member.setNickname('Helper');
await member.edit({ nick: null, pronouns: null, bio: null }); // a moderator can clear profile fields
await space.members.me?.edit({ pronouns: 'it/its' });          // ...but only set them for the bot itself
await member.kick();
await member.ban({ reason: 'Spam' }); // the reason goes to the audit log
await space.members.unban(userId);
```

- Kick and ban need Kick Members and Ban Members, and the bot must outrank the member (the owner
  outranks everyone; otherwise its highest role must be higher). `member.kickable`,
  `member.bannable` and `member.manageable` check that from the cache.
- Strafe records no reason for kicks; `kick(reason)` accepts one and ignores it. Bans keep theirs.
- A member's space profile (nickname, avatar, banner, bio, pronouns) overrides their account's in
  that space. `member.displayName` and `member.displayAvatarURL()` take it into account.
- Only the nickname can be set on someone else (with Manage Nicknames). The bio, about me,
  pronouns, avatar and banner can only be set by the member themselves; a moderator can only clear
  them (`null`), and setting a value on another member fails with a `403` `StrafeAPIError` whose
  `code` is `APIErrorCodes.CannotEditMemberProfile`.

### Adding people with OAuth2

A website that logged someone in with the `spaces.join` scope can have the bot add them to a space:

```ts
await space.members.add(user, { accessToken: tokens });
```

The bot needs Create Invite. See [OAuth2 login](./oauth2.md#adding-people-to-a-space).

## Roles

```ts
const role = await space.roles.create({
  name: 'Helpers',
  color: 'Aqua',
  permissions: [PermissionFlagsBits.ManageMessages],
  mentionable: true,
});
await member.roles.add(role);
await member.roles.remove(role);
await member.roles.set([roleA, roleB]); // replace the list
await role.setPosition(3);
await role.delete();
```

- Strafe follows Discord's role hierarchy. With Manage Roles you may give or take away any role
  **strictly below your own highest role**, on anyone, the owner included. Roles at or above yours
  that the member holds are kept whatever you send.
- New roles start at position 1, just above `@everyone`. The bot's managed role (the one it got
  when it was installed, `space.roles.botRoleFor(client.user)`) also starts there and cannot be
  given to anyone else; ask an admin to move it up if the bot hands out roles.
- `member.roles.highest`, `member.roles.color` and `member.roles.hoist` work as in discord.js;
  `space.roles.everyone` is `@everyone`. `role.members` lists cached members holding it.

## Invites, emojis, bans

```ts
const invite = await space.invites.create({ maxAge: 3600, maxUses: 10 });
console.log(invite.url, invite.code);

const preview = await client.fetchInvite('https://app.strafe.chat/invite/abc123'); // no login needed
console.log(preview.spaceName, preview.memberCount);

const emoji = await space.emojis.create({ attachment: new URL('./party.png', import.meta.url), name: 'party' });
await message.react(emoji);

const bans = await space.bans.fetch();
```

Invite codes from another instance look like `code@domain`; see
[Instances and federation](./instances.md#invites-across-instances).

## Voice

`space.voiceStates` and `member.voice` show who is in which voice room, and moderators can act on
them: `member.voice?.setMute(true)`, `setDeaf()`, `setRoom(otherVoiceRoom)`, `disconnect()`. A bot
cannot join a voice call itself: calls are end-to-end encrypted with per-device keys that a bot does
not have.

## Caching

The client caches what it sees. By default it keeps everything except messages, where it keeps the
newest 200 per room. `makeCache` changes that per manager:

```ts
import { Client, Options } from '@strafechat/strafe.js';

const client = new Client({
  instance: 'app.strafe.chat',
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 50,  // newest 50 messages per room
    ReactionManager: 0,  // do not cache reactions
  }),
});
```

`Options.cacheEverything()` keeps everything. Anything missing from a cache can be fetched; events
about uncached objects arrive with [partial objects](./events.md#partial-objects).

There is no user lookup on Strafe: `client.users.fetch(id)` works only for the bot itself. Other
users reach the cache through messages, members, reactions and presence events; for a member,
`space.members.fetch(id)` brings the user along.

## Collections

`Collection<K, V>` extends `Map` with discord.js's helpers: `find`, `filter`, `map`, `mapValues`,
`first`, `last`, `random`, `some`, `every`, `reduce`, `partition`, `sort`, `sorted`, `ensure`,
`hasAll`, `hasAny`, `at`, `keyAt`, `concat`, `equals`, and more.

```ts
const admins = space.members.cache.filter((m) => m.permissions.has(PermissionFlagsBits.Administrator));
const newest = space.members.cache.sorted((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0)).first(5);
```

`map()` returns an array and `filter()` a new `Collection`, as in discord.js.

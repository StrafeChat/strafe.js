# Spaces, members and roles

A space holds rooms, roles, members, emojis, invites and bans. Each has a manager with a `cache`, `fetch()`,
`resolve()` and, where the API allows, `create`/`edit`/`delete`.

## Spaces

```ts
const cached = client.spaces.cache.get(spaceId);
const space = await client.spaces.fetch(spaceId);

await space.edit({ name: 'Book club', description: 'Reading together' });
await space.setIcon(new URL('./icon.png', import.meta.url));
const owner = await space.fetchOwner();
await space.leave();
```

The inactive voice room is `space.inactiveRoomId` with `inactiveTimeout`. The system messages room is
`space.systemRoomId`. The space widget is `space.widgetEnabled` and `space.fetchWidget()`.
`space.fetchAuditLogs()` needs Manage Space. Only the owner can transfer or delete a space.

A space hosted on another instance has `space.federated` set to `true`. See
[Instances and federation](./instances.md).

## Rooms and sections

| Class | `RoomType` | Guard |
| --- | --- | --- |
| `PMRoom` | `PM` (1) | `isPM()`, `isPMBased()` |
| `GroupPMRoom` | `GroupPM` (2) | `isGroupPM()`, `isPMBased()` |
| `TextRoom` | `SpaceText` (3) | `isTextRoom()` |
| `VoiceRoom` | `SpaceVoice` (4) | `isVoiceBased()` |
| `SectionRoom` | `SpaceSection` (5) | `isSection()` |
| `ThreadRoom` | `Thread` (6) | `isThread()` |

Every room also has `isTextBased()`, `isSendable()`, `isSpaceBased()` and `isEncrypted()`.

```ts
import { RoomType } from '@strafechat/strafe.js';

const section = await space.rooms.create({ name: 'Projects', type: RoomType.SpaceSection });
const room = await space.rooms.create({ name: 'roadmap', parent: section, topic: 'What is next' });
await room.setRateLimitPerUser(10); // slowmode, seconds
await room.setParent(null);
await room.lockPermissions(); // sync with the section
for (const child of section.children.values()) console.log(child.name);
```

Managing rooms needs Manage Rooms. For overrides, see [Permissions](./permissions.md#overrides).

## Members

Members are not in `READY`. Fetch them before reading `space.members.cache`.

```ts
await space.members.fetch();
const member = await space.members.fetch(userId);
const me = await space.members.fetchMe(); // then space.members.me

await member.setNickname('Helper');
await member.edit({ nick: null, pronouns: null, bio: null });
await space.members.me?.edit({ pronouns: 'it/its' });
await member.kick();
await member.ban({ reason: 'Spam' });
await space.members.unban(userId);
```

- Kick and ban need Kick Members and Ban Members, and the bot must outrank the member.
  `member.kickable`, `member.bannable` and `member.manageable` check this.
- Kicks record no reason. Bans do.
- A member's space profile overrides their account's. `member.displayName` and
  `member.displayAvatarURL()` use it.
- On other members, a moderator can set the nickname (Manage Nicknames) and clear the other profile
  fields with `null`. Setting them fails with `403` and `APIErrorCodes.CannotEditMemberProfile`.

### Adding people with OAuth2

With a `spaces.join` token, the bot can add someone to a space. It needs Create Invite.

```ts
await space.members.add(user, { accessToken: tokens });
```

See [OAuth2 login](./oauth2.md#adding-people-to-a-space).

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
await member.roles.set([roleA, roleB]);
await role.setPosition(3);
await role.delete();
```

- With Manage Roles you can give or remove any role below your highest, on anyone.
- New roles start at position 1, above `@everyone`. So does the bot's managed role
  (`space.roles.botRoleFor(client.user)`), which can't be given to anyone else.
- `space.roles.everyone` is `@everyone`. `role.members` lists cached members with the role.

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

For `code@domain` invites, see [Instances and federation](./instances.md#invites-across-instances).

## Voice

`space.voiceStates` and `member.voice` show who is in voice. Moderators can call `setMute()`,
`setDeaf()`, `setRoom()` and `disconnect()` on a voice state. Bots can't join calls, because calls are
end-to-end encrypted.

## Caching

By default the client caches everything except messages, where it keeps the newest 200 per room.

```ts
import { Client, Options } from '@strafechat/strafe.js';

const client = new Client({
  instance: 'app.strafe.chat',
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 50,
    ReactionManager: 0,
  }),
});
```

`Options.cacheEverything()` removes the limits. Events about uncached objects carry
[partial objects](./events.md#partial-objects).

`client.users.fetch(id)` works only for the bot itself. Other users enter the cache through messages,
members, reactions and presence.

## Collections

`Collection<K, V>` is a `Map` with discord.js's helpers (`find`, `filter`, `first`, `sorted` and the rest).

```ts
const admins = space.members.cache.filter((m) => m.permissions.has(PermissionFlagsBits.Administrator));
const newest = space.members.cache.sorted((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0)).first(5);
```

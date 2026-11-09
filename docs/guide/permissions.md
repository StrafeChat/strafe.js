# Permissions

Strafe's permission system is Discord's model with Strafe's own bits: roles carry permissions,
rooms can override them per role or per member, and the space owner and Administrators get
everything. The names and the bit values differ from Discord's, so use `PermissionFlagsBits`
rather than numbers copied from Discord documentation.

## PermissionsBitField

```ts
import { PermissionFlagsBits, PermissionsBitField } from '@strafechat/strafe.js';

const perms = new PermissionsBitField([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);
perms.has(PermissionFlagsBits.SendMessages);   // true
perms.has(['SendMessages', 'AddReactions']);   // flag names work too: false
perms.any(PermissionFlagsBits.ManageMessages); // false
perms.add('AddReactions').remove('EmbedLinks');
perms.toArray();                               // ['SendMessages', 'AddReactions']
perms.serialize();                             // { ViewRoom: false, SendMessages: true, ... }
```

The value is a `bigint` inside (`perms.bitfield`). The API sends permissions as JSON numbers, and
the library converts in both directions. `has()`, `any()` and `missing()` treat Administrator as
holding everything unless you pass `false` as the second argument.

`PermissionsBitField.Default` is what `@everyone` gets in a new space, `PermissionsBitField.All` is
every bit, and `AllRoom`, `AllVoice` and `AllThreads` are the bits that make sense in a room
override, for voice, and for threads.

## The flags

| Flag | Value | Notes |
| --- | --- | --- |
| `ViewRoom` | `1 << 0` | Without it, nothing else in the room applies |
| `SendMessages` | `1 << 1` | Without it, Attach Files, Embed Links and Mention Everyone do not apply either |
| `ReadMessageHistory` | `1 << 2` | |
| `AddReactions` | `1 << 3` | Needed to start a new reaction, not to join one |
| `UseExternalEmojis` | `1 << 4` | |
| `MentionEveryone` | `1 << 5` | `@everyone`, `@here`, and pinging roles that are not mentionable |
| `ManageMessages` | `1 << 6` | Delete others' messages, pin; exempt from slowmode |
| `ManageRoles` | `1 << 7` | Roles below your highest; room overrides |
| `ManageRooms` | `1 << 8` | Create, edit, move and delete rooms and sections |
| `KickMembers` | `1 << 9` | |
| `BanMembers` | `1 << 10` | |
| `Administrator` | `1 << 11` | Everything, still bound by the role hierarchy |
| `ManageSpace` | `1 << 12` | Space settings, audit log, installing bots |
| `CreateInvite` | `1 << 13` | Also needed to add people with an OAuth2 `spaces.join` token |
| `ManageEmojis` | `1 << 14` | |
| `Connect` | `1 << 15` | Join voice rooms |
| `Speak` | `1 << 16` | |
| `Video` | `1 << 17` | Camera and screen sharing |
| `MuteMembers` | `1 << 18` | |
| `DeafenMembers` | `1 << 19` | |
| `MoveMembers` | `1 << 20` | Move and disconnect people in voice |
| `UseVAD` | `1 << 21` | Voice activity instead of push-to-talk |
| `PrioritySpeaker` | `1 << 22` | |
| `AttachFiles` | `1 << 23` | |
| `CreatePublicThreads` | `1 << 24` | |
| `CreatePrivateThreads` | `1 << 25` | |
| `SendMessagesInThreads` | `1 << 26` | Posting in threads (instead of Send Messages) |
| `ManageThreads` | `1 << 27` | |
| `ChangeNickname` | `1 << 28` | Your own nickname |
| `ManageNicknames` | `1 << 29` | Others' nicknames and space profiles |
| `EmbedLinks` | `1 << 30` | Sending embeds (bots) |

Discord permissions with no Strafe counterpart (View Audit Log, Manage Webhooks, Moderate Members,
Use Application Commands and others) do not exist; View Audit Log is part of Manage Space.

## A member's permissions

```ts
member.permissions.has(PermissionFlagsBits.KickMembers);        // space-wide
member.permissionsIn(room).has(PermissionFlagsBits.SendMessages); // in one room
room.permissionsFor(member)?.has(PermissionFlagsBits.ViewRoom);  // the same, from the room
room.permissionsFor(role);                                       // what a role gets in the room
```

These compute locally, from the cache, with the server's algorithm:

1. The owner has every permission. So does anyone whose roles include Administrator.
2. Otherwise start from `@everyone`'s permissions plus those of each of the member's roles.
3. In a room, apply the overrides: `@everyone`'s, then the member's roles' (denies, then allows),
   then the member's own.
4. Without View Room, the member has nothing in the room. Without Send Messages, they also lose
   Attach Files, Embed Links and Mention Everyone there.

A room in a section with `permissionsSynced` uses the section's overrides. A thread uses its
parent room's, and a private thread is invisible to people who are neither in it nor have Manage
Threads.

`member.permissionsIn()` needs the member to be cached, with roles: fetch it first if needed (see
[members are not in READY](./events.md#members-are-not-in-ready)). For the bot itself,
`space.members.me` (after `space.members.fetchMe()`).

## Overrides

```ts
// Make a read-only announcements room.
await room.permissionOverwrites.edit(space.everyoneRoleId!, { SendMessages: false });
await room.permissionOverwrites.edit(moderatorRole, { SendMessages: true });

// Replace an override entirely, or remove it.
await room.permissionOverwrites.create(member, { ViewRoom: true });
await room.permissionOverwrites.delete(member);
```

`edit()` changes the named permissions and keeps the rest (`null` resets one), `create()` replaces
the whole override, `set()` replaces every override of the room. Editing overrides needs Manage
Roles (not Manage Rooms), and you can only allow or deny permissions you have in that room.

## The role hierarchy

Strafe follows Discord's rules:

- A member's rank is their highest role's position. The owner is above everyone. Administrators
  are still bound by the hierarchy.
- **Giving or taking a role** depends only on the role: with Manage Roles you can give or remove any
  role strictly below your own highest, on anyone, including members above you and the owner.
- **Kicking, banning and changing nicknames** depends on the member: their highest role must be
  below yours. The owner can never be kicked or banned.
- **Creating, editing and moving roles** only touches roles below yours, and you cannot grant
  permissions you do not have yourself.
- A bot's managed role (created when it is installed) cannot be given to anyone else or taken from
  the bot.

`member.manageable`, `member.kickable`, `member.bannable` and `role.editable` check these rules from
the cache. New roles and the bot's managed role start at position 1, just above `@everyone`, so a
bot that moderates or hands out roles needs its role moved up by an admin.

## Installing with permissions

`client.generateInvite({ permissions })` (or `generateBotInvite`) asks for permissions in the
install link. The person installing the bot can grant at most what they have; the bot gets them on
its managed role.

```ts
const link = client.generateInvite({
  permissions: new PermissionsBitField(['SendMessages', 'EmbedLinks', 'ManageRoles']),
  space: '2102226824774811648', // optional: preselect a space
});
```

# Permissions

Roles carry permissions and rooms override them. The owner and Administrators have everything.

::: warning Coming from discord.js
Strafe's bit values differ from Discord's. Use `PermissionFlagsBits`, never copied numbers.
:::

## PermissionsBitField

```ts
import { PermissionFlagsBits, PermissionsBitField } from '@strafechat/strafe.js';

const perms = new PermissionsBitField([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);
perms.has(PermissionFlagsBits.SendMessages);   // true
perms.has(['SendMessages', 'AddReactions']);   // false
perms.any(PermissionFlagsBits.ManageMessages); // false
perms.add('AddReactions').remove('EmbedLinks');
perms.toArray();                               // ['SendMessages', 'AddReactions']
perms.serialize();                             // { ViewRoom: false, SendMessages: true, ... }
```

The value is a `bigint` (`perms.bitfield`). `has()`, `any()` and `missing()` count Administrator as
everything unless the second argument is `false`.

`PermissionsBitField.Default` is `@everyone` in a new space. `All` is every bit. `AllRoom`, `AllVoice`
and `AllThreads` are the bits valid in room overrides, voice and threads.

## The flags

| Flag | Value | Notes |
| --- | --- | --- |
| `ViewRoom` | `1 << 0` | Required for anything else in the room |
| `SendMessages` | `1 << 1` | Required for Attach Files, Embed Links, Mention Everyone |
| `ReadMessageHistory` | `1 << 2` | |
| `AddReactions` | `1 << 3` | New reactions only |
| `UseExternalEmojis` | `1 << 4` | |
| `MentionEveryone` | `1 << 5` | `@everyone`, `@here`, unmentionable roles |
| `ManageMessages` | `1 << 6` | Delete, pin; skips slowmode |
| `ManageRoles` | `1 << 7` | Roles below yours; room overrides |
| `ManageRooms` | `1 << 8` | Rooms and sections |
| `KickMembers` | `1 << 9` | |
| `BanMembers` | `1 << 10` | |
| `Administrator` | `1 << 11` | Everything, within the role hierarchy |
| `ManageSpace` | `1 << 12` | Settings, audit log, bot installs |
| `CreateInvite` | `1 << 13` | Also for `spaces.join` adds |
| `ManageEmojis` | `1 << 14` | |
| `Connect` | `1 << 15` | |
| `Speak` | `1 << 16` | |
| `Video` | `1 << 17` | Camera and screen share |
| `MuteMembers` | `1 << 18` | |
| `DeafenMembers` | `1 << 19` | |
| `MoveMembers` | `1 << 20` | Move and disconnect |
| `UseVAD` | `1 << 21` | |
| `PrioritySpeaker` | `1 << 22` | |
| `AttachFiles` | `1 << 23` | |
| `CreatePublicThreads` | `1 << 24` | |
| `CreatePrivateThreads` | `1 << 25` | |
| `SendMessagesInThreads` | `1 << 26` | |
| `ManageThreads` | `1 << 27` | |
| `ChangeNickname` | `1 << 28` | |
| `ManageNicknames` | `1 << 29` | Includes space profiles |
| `EmbedLinks` | `1 << 30` | Bot embeds |

There is no View Audit Log, Manage Webhooks or Moderate Members.

## A member's permissions

```ts
member.permissions.has(PermissionFlagsBits.KickMembers);          // space-wide
member.permissionsIn(room).has(PermissionFlagsBits.SendMessages); // in one room
room.permissionsFor(member)?.has(PermissionFlagsBits.ViewRoom);
room.permissionsFor(role);
```

These compute from the cache, the same way the server does:

1. The owner and Administrators have everything.
2. Otherwise, combine `@everyone` and the member's roles.
3. In a room, apply overrides: `@everyone`, then roles (denies, then allows), then the member.
4. Without View Room, nothing applies. Without Send Messages, Attach Files, Embed Links and Mention
   Everyone don't either.

A synced room uses its section's overrides. A thread uses its parent's. A private thread is hidden
from anyone not in it and without Manage Threads.

The member must be cached first (see [members are not in READY](./events.md#members-are-not-in-ready)).

## Overrides

```ts
await room.permissionOverwrites.edit(space.everyoneRoleId!, { SendMessages: false });
await room.permissionOverwrites.edit(moderatorRole, { SendMessages: true });

await room.permissionOverwrites.create(member, { ViewRoom: true }); // replaces
await room.permissionOverwrites.delete(member);
```

`edit()` changes the named bits (`null` resets one). `create()` replaces one override, `set()` all of
them. Overrides need Manage Roles, and you can only grant bits you have in that room.

## The role hierarchy

- Rank is your highest role's position. The owner is above everyone.
- Giving or removing a role checks the role: it must be below your highest. The member can be anyone,
  owner included.
- Kick, ban and nickname changes check the member: their highest role must be below yours. The owner
  can't be kicked or banned.
- You can only edit roles below yours and grant permissions you have.
- A bot's managed role stays with its bot.

`member.manageable`, `member.kickable`, `member.bannable` and `role.editable` check these rules. The
bot's role starts just above `@everyone`, so an admin must move it up before it can moderate.

## Installing with permissions

The installer can grant at most what they have. The bot gets them on its managed role.

```ts
const link = client.generateInvite({
  permissions: new PermissionsBitField(['SendMessages', 'EmbedLinks', 'ManageRoles']),
  space: '2102226824774811648', // optional
});
```

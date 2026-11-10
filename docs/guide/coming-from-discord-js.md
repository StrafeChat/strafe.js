# Coming from discord.js

strafe.js is modelled on discord.js v14: the same `Client`, `Events`, `Collection`, managers with
`cache` and `fetch()`, `EmbedBuilder`, `PermissionsBitField`, and the same method names on
messages, members and roles. What changes is the vocabulary, a handful of options that Strafe does
not need, and a few things Strafe cannot do.

## The words

| Discord | Strafe | Notes |
| --- | --- | --- |
| Server, guild | **Space** | |
| Channel | **Room** | Space text and voice rooms, threads and PMs are all rooms |
| Category | **Section** | A room of type `SpaceSection` that groups others |
| DM, group DM | **PM**, group PM | End-to-end encrypted by default |
| AFK channel | Inactive voice room | `space.inactiveRoomId`, `space.inactiveTimeout` |
| Server widget | Space widget | `space.widgetEnabled`, `space.fetchWidget()` |
| Member, role, invite, emoji, reaction, thread, ban, audit log | the same | |

## Classes, managers and properties

| discord.js | strafe.js | Notes |
| --- | --- | --- |
| `client.guilds`, `GuildManager`, `Guild` | `client.spaces`, `SpaceManager`, `Space` | |
| `client.channels`, `ChannelManager` | `client.rooms`, `RoomManager` | Space rooms, threads and PMs |
| `guild.channels`, `GuildChannelManager` | `space.rooms`, `SpaceRoomManager` | |
| `TextChannel`, `VoiceChannel`, `CategoryChannel` | `TextRoom`, `VoiceRoom`, `SectionRoom` | `section.children` is a `Collection`, not a manager |
| `ThreadChannel`, `DMChannel`, `PartialGroupDMChannel` | `ThreadRoom`, `PMRoom`, `GroupPMRoom` | |
| `ChannelType.GuildText`, `GuildVoice`, `GuildCategory`, `DM`, `GroupDM`, `PublicThread` | `RoomType.SpaceText`, `SpaceVoice`, `SpaceSection`, `PM`, `GroupPM`, `Thread` | Values 3, 4, 5, 1, 2, 6 |
| `channel.isDMBased()` | `room.isPMBased()` | Plus `isPM()`, `isGroupPM()`, `isTextRoom()`, `isSection()`, `isEncrypted()` |
| `guild.members`, `GuildMember`, `GuildMemberRoleManager` | `space.members`, `SpaceMember`, `SpaceMemberRoleManager` | |
| `guild.roles`, `RoleManager` | `space.roles`, `RoleManager` | |
| `guild.bans`, `GuildBanManager`, `GuildBan` | `space.bans`, `SpaceBanManager`, `SpaceBan` | |
| `guild.emojis`, `GuildEmoji` | `space.emojis`, `SpaceEmoji` | |
| `guild.invites` | `space.invites` | Codes from other instances are `code@domain` |
| `guild.fetchAuditLogs()`, `GuildAuditLogs`, `GuildAuditLogsEntry` | `space.fetchAuditLogs()`, `SpaceAuditLogs`, `AuditLogEntry` | |
| `guild.afkChannelId`, `systemChannelId`, `rulesChannelId`, `widgetChannelId` | `space.inactiveRoomId`, `systemRoomId`, `rulesRoomId`, `widgetRoomId` | |
| `message.guild`, `message.guildId`, `message.inGuild()` | `message.space`, `message.spaceId`, `message.inSpace()` | |
| `message.channel`, `message.channelId` | `message.room`, `message.roomId` | |
| `user.createDM()`, `user.dmChannel` | `user.createPM()`, `user.pmRoom` | A bot cannot post in a PM |
| `user.tag` | `user.tag` | The handle: `name`, or `name@domain` for other instances. No discriminators |
| `channelMention()` | `roomMention()` | `<#id>` |
| `client.generateInvite({ guild, disableGuildSelect })` | `client.generateInvite({ space, disableSpaceSelect })` | |
| `client.application.id` | `client.application.id` | The bot's user id: Strafe uses one id for the bot and its application. `client.application` has no other fields (no `fetch()`, owner or commands) |
| `guild.memberCount` | none | Spaces carry no member count. `await space.members.fetch()`, then `space.members.cache.size`; an invite preview has `invite.memberCount` |
| `channel.awaitMessages()`, `createMessageCollector()`, `message.awaitReactions()`, `createReactionCollector()` | the same, on rooms and messages | Same options and end reasons, plus `roomDelete`, `threadDelete` and `spaceDelete`; see [Waiting for replies and reactions](./messages.md#waiting-for-replies-and-reactions) |
| `OAuth2Scopes.Guilds`, `GuildsJoin` | `OAuth2Scopes.Spaces`, `SpacesJoin` | |
| `DiscordAPIError`, `DiscordjsError`, `RESTJSONErrorCodes` | `StrafeAPIError`, `StrafeError`, `APIErrorCodes` | Strafe's codes are string slugs, and most errors have none |
| `SnowflakeUtil` | `SnowflakeUtil` | Strafe's epoch is 1288834974657 |

## Events

| discord.js | strafe.js (value) |
| --- | --- |
| `Events.ClientReady` | `Events.ClientReady` (`'clientReady'`; `'ready'` is emitted too) |
| `Events.GuildCreate`, `GuildUpdate`, `GuildDelete` | `Events.SpaceCreate`, `SpaceUpdate`, `SpaceDelete` |
| `Events.GuildMemberAdd`, `GuildMemberUpdate`, `GuildMemberRemove` | `Events.SpaceMemberAdd`, `SpaceMemberUpdate`, `SpaceMemberRemove` |
| `Events.GuildRoleCreate`, `GuildRoleUpdate`, `GuildRoleDelete` | `Events.RoleCreate`, `RoleUpdate`, `RoleDelete` (the same strings: `'roleCreate'`...) |
| `Events.GuildEmojiCreate`, `GuildEmojiUpdate`, `GuildEmojiDelete` | `Events.EmojiCreate`, `EmojiUpdate`, `EmojiDelete` |
| `Events.ChannelCreate`, `ChannelUpdate`, `ChannelDelete` | `Events.RoomCreate`, `RoomUpdate`, `RoomDelete` |
| `Events.ChannelPinsUpdate` | `Events.RoomPinsUpdate` (with the message id and who did it) |
| `Events.ShardReady`, `ShardReconnecting`, `ShardResume` | `Events.GatewayReady`, `Reconnecting`, `Reconnected` |
| `Events.Invalidated` | `Events.Invalidated` (the session was revoked) |
| `Events.GuildBanAdd`, `GuildBanRemove`, `InviteCreate`, `InteractionCreate`, `WebhooksUpdate`... | none |

These keep their names and arguments: `MessageCreate`, `MessageUpdate`, `MessageDelete`,
`MessageReactionAdd`, `MessageReactionRemove`, `TypingStart`, `ThreadCreate`, `ThreadUpdate`,
`ThreadDelete`, `ThreadMembersUpdate`, `PresenceUpdate`, `UserUpdate`, `VoiceStateUpdate`, `Raw`,
`Debug`, `Warn`, `Error`.

## Permissions

Strafe's bits have their own values: always use `PermissionFlagsBits`, never numbers from Discord.

| discord.js `PermissionFlagsBits` | strafe.js |
| --- | --- |
| `ViewChannel` | `ViewRoom` |
| `ManageChannels` | `ManageRooms` |
| `ManageGuild` | `ManageSpace` (also covers the audit log) |
| `CreateInstantInvite` | `CreateInvite` |
| `ManageGuildExpressions`, `ManageEmojisAndStickers` | `ManageEmojis` |
| `Stream` | `Video` (camera and screen) |
| `SendMessagesInThreads`, `ManageThreads`, `CreatePublicThreads`, `CreatePrivateThreads` | the same |
| `ViewAuditLog`, `ManageWebhooks`, `ModerateMembers`, `UseApplicationCommands`, `SendTTSMessages`, `ManageEvents` | none |

The rest (`SendMessages`, `ReadMessageHistory`, `AddReactions`, `UseExternalEmojis`,
`MentionEveryone`, `ManageMessages`, `ManageRoles`, `KickMembers`, `BanMembers`, `Administrator`,
`Connect`, `Speak`, `MuteMembers`, `DeafenMembers`, `MoveMembers`, `UseVAD`, `PrioritySpeaker`,
`AttachFiles`, `ChangeNickname`, `ManageNicknames`, `EmbedLinks`) keep their names. The role
hierarchy rules are Discord's. See [Permissions](./permissions.md).

## Options you can drop

```ts
// discord.js
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Reaction],
});

// strafe.js
const client = new Client({ instance: 'app.strafe.chat' });
```

- **Intents**: none. A bot receives every event about what it can see, message text included
  (unless the room is end-to-end encrypted).
- **Partials**: always on. Events about uncached messages, reactions and members arrive with
  partial objects.
- **Sharding**: none. One connection carries everything.
- **`allowedMentions`**: does not exist; Strafe cannot send a mention that does not notify. Use
  `escapeMentions()`.

Passing `intents`, `partials`, `shards` or `allowedMentions` anyway emits a warning explaining why.

## What does not exist

Slash commands and other interactions (buttons, select menus, modals, context menus), webhooks,
stickers, polls, scheduled events, stage and forum channels, crossposting, and joining voice calls
are not part of Strafe. Bots use message commands and reactions. [Limits and differences](./limits.md)
lists every gap, including PMs (a bot cannot send one: they are always end-to-end encrypted) and
user lookups (`client.users.fetch()` only works for the bot itself).

## A bot, ported

```ts
// discord.js
import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

client.on(Events.GuildMemberAdd, async (member) => {
  await member.guild.systemChannel?.send(`Welcome, ${member}!`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.inGuild()) return;
  if (message.content === '!helper' && message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    const role = message.guild.roles.cache.find((r) => r.name === 'Helper');
    if (role) await message.mentions.members?.first()?.roles.add(role);
  }
});

await client.login(process.env.DISCORD_TOKEN);
```

```ts
// strafe.js
import { Client, Events, PermissionFlagsBits } from '@strafechat/strafe.js';

const client = new Client({ instance: process.env.STRAFE_INSTANCE });

client.on(Events.SpaceMemberAdd, async (member) => {
  const room = member.space.systemRoom;
  if (room?.isSendable()) await room.send(`Welcome, ${member}!`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.content === null || !message.inSpace()) return;
  const caller = message.member ?? (await message.space.members.fetch(message.author.id));
  if (message.content.startsWith('!helper') && caller.permissions.has(PermissionFlagsBits.ManageRoles)) {
    const role = message.space.roles.cache.find((r) => r.name === 'Helper');
    const targetId = message.mentions.userIds[0];
    if (role && targetId) await (await message.space.members.fetch(targetId)).roles.add(role);
  }
});

await client.login(process.env.STRAFE_TOKEN);
```

The differences: an instance instead of intents, `content === null` for encrypted rooms, a room
that might be encrypted (`isSendable()`), and members fetched rather than assumed cached, because
member lists are not part of `READY`.

## Upgrading from strafe.js 1.x

strafe.js 1.x targeted Strafe's retired pre-2026 backend (msgpack over the old gateway). Nothing in
2.0 is compatible with it: the endpoints, events and payloads all changed. Start from
[Getting started](./getting-started.md). The few names that survive (`client.on('messageCreate')`,
`room.send()`) behave as described in this guide, and the old `config` object is replaced by the
`instance` option.

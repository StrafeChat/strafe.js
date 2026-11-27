# Bridging another platform

A **bridge** connects a Strafe room to a room somewhere else: Discord, Matrix, IRC, Telegram, Slack,
XMPP, Revolt or another platform. Your bot drives it. It posts what people say over there into the
room as **bridged users**, and it copies the room's messages back from a filtered feed.

This is Strafe's take on Revolt's *masquerade*: a message carries its own name, avatar and colour.
On Strafe it exists only for bridging. Every bridged message relays something that exists elsewhere
(an external user id and message id). It always shows its platform tag and the bot that really sent
it. It can never ping `@everyone` or roles, and it never appears in an end-to-end encrypted room.
There is no masquerade on an ordinary `room.send()`.

## What the server does for you

Bridges used to need their own database and a lot of care. The server now handles that work:

| You used to | Now |
| --- | --- |
| Keep a table of "external message id ↔ Strafe message id" | The server keeps the id map for 30 days. You edit, delete, reply and react using the other platform's ids. |
| Make retries safe yourself | A send is idempotent per external message id and `part`. A retry returns the message already posted (`duplicate: true`), so the library retries timed-out sends for you. |
| Filter out your own posts to avoid loops | The feed never contains the bridge's own messages. It leaves out other bridges' messages unless `relayOtherBridges` is on, and bots' and webhooks' messages unless `relayBots` is on. |
| Enforce the room's rules for people who have no account | Each bridged user is treated as a member with no roles. Slowmode and automod apply to each of them separately, and files, embeds and reactions need `@everyone` to hold the matching permission. |
| Keep mentions from pinging | Mentions in a bridged message show up in the text but notify nobody. The one exception is the reply ping, when the bridge has `replyPings` on. |
| Ask people whether they want to be copied | People choose, and the server filters the feed before your bot sees it ([Consent](#consent)). |
| Moderate an account you do not control | Moderators block a bridged user by `puppetId`. You get `bridgePuppetBlock`, and their later sends are refused. |
| Proxy avatars | Readers load pictures from other platforms through the instance's image proxy, never directly from that platform. |

What is left for you: talk to the other platform, call `bridge.send()` for what happens there, and
copy what the feed gives you back to the other side.

## Permissions

To create a bridge, the bot needs **Manage Webhooks** and **Masquerade** in the room. To post, it
needs View Room, Send Messages and Masquerade at that moment. If it loses one of these, the bridge
pauses (`driver_lost_permission`) and resumes on its own once the bot has them again. Ask for these
permissions in the install link:

```ts
const link = client.generateInvite({
  permissions: [
    PermissionFlagsBits.ViewRoom,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.Masquerade,
  ],
});
```

Bridges live in a space's text rooms. They cannot go in threads, voice rooms or end-to-end encrypted
rooms. If a room turns encryption on, its bridges are disabled (`encrypted`). A room can have at
most 3 bridges, and they count toward its 15 webhooks.

## Creating a bridge

```ts
const bridge = await room.createBridge({
  platform: 'discord',                  // or 'matrix', 'irc', ..., 'other' with platformName
  name: 'Discord #general',
  remote: { name: 'Example Server #general', url: 'https://discord.gg/example' },
  settings: { replyPings: true },
});
```

`remote` tells the people in the room what the room is bridged with. It appears on the room's
"Bridged" badge.

If not everyone in the space can see the room, bridging it would copy its messages beyond the room's
audience. The server refuses with `BridgeAPIError` `private_room_ack_required` (`error.audience` is
how many people can see the room) unless you pass `acknowledgePrivate: true`. A room that becomes
private later pauses its bridges (`became_private`). Someone resumes them with the same
acknowledgement: `bridge.resume({ acknowledgePrivate: true })`.

`client.bridges` holds the bridges your bot drives, in full. It is filled from `READY` and kept
current by `bridgeCreate`, `bridgeUpdate` and `bridgeDelete`. `room.bridges` lists everything the
room is bridged with, including other bots' bridges. Those are summaries (`bridge.partial`,
`bridge.driven === false`), because everyone who can see a room may know what it is bridged with.
Check for an existing bridge before you make one:

```ts
const bridge = client.bridges.cache.find((b) => b.roomId === room.id) ?? (await room.createBridge({ ... }));
```

| Method | What it does |
| --- | --- |
| `bridge.pause(reason?)`, `bridge.resume()` | Stop and start. A paused bridge refuses sends with `bridge_inactive`. |
| `bridge.edit({ name, avatar, remote })` | Rename or redescribe it. |
| `bridge.setSettings({ relayBots, relayOtherBridges, replyPings, allowColour, showProfileLinks })` | Change its switches. These need Manage Webhooks, and `allowColour` also needs Manage Roles. |
| `bridge.delete(reason?)` | Remove it. The room gets a notice. |
| `room.fetchBridges()` | Refresh `room.bridges`. |

## Posting as a bridged user

```ts
const { message, puppetId, duplicate, replyDropped } = await bridge.send({
  externalUser: {
    id: '81726354',                     // their id on the platform, never shown to readers
    name: 'Alice',                      // 1-32 characters
    avatarURL: 'https://cdn.discordapp.com/avatars/81726354/ab12.png',
    bot: false,
    profileURL: 'https://discord.com/users/81726354', // shown only with showProfileLinks
  },
  externalMessageId: '1300000000000000',
  content: 'hello from discord',
  files: [{ attachment: 'https://cdn.discordapp.com/attachments/.../cat.png', name: 'cat.png' }],
  replyTo: { externalMessageId: '1299999999999999' }, // or a Message / { messageId }
});
```

- The first message from a new `externalUser.id` creates that person's `puppetId`, their id on
  Strafe. Later messages update their last known name and avatar. Each message keeps the name and
  avatar it was sent with.
- `externalUser.name` follows the webhook name rules. Reserved names, the names of the space's owner
  and moderators, and role names are refused with `invalid_name`. A regular member's name is
  allowed, and clients add a line saying the bridged user is not that member.
- A reply target the bridge does not know is dropped. The message still goes through, with
  `replyDropped: true`.
- `part` (0-9) splits one external message into several Strafe messages. Use it when a message is
  longer than 4000 characters.
- `message.webhookId` is the bridge's id. `message.masquerade` holds the name, avatar, platform,
  `puppetId` and `via` (your bot). `message.author` is the bridged user, never an account, and is not
  put in `client.users`.

Everything after the send works with the other platform's ids:

```ts
await bridge.editMessage('1300000000000000', 'hello from discord (edited)');
await bridge.deleteMessage('1300000000000000');               // every part, or { part }
await bridge.react('1300000000000000', '👍', { externalUserId: '81726354', externalUser: { name: 'Alice' } });
await bridge.unreact('1300000000000000', '👍', { externalUserId: '81726354' });
```

A string is always the **other platform's** message id. Pass `{ messageId }` or a `Message` for a
Strafe message. When the bot copies a Strafe message out, record the copy with `bridge.link()`, so
replies to the copy resolve and its edits, deletes and reactions reach you with the copy's id:

```ts
const copy = await discordWebhook.send(...);
await bridge.link(strafeMessage, copy.id);          // part 0; add { part } for each piece
await bridge.lookup(copy.id);                       // [{ messageId, roomId, part, direction: 'outbound', ... }]
```

`bridge.lookup()` resolves an external id, `{ messageId }` or a `Message` to its entries. It returns
`[]` once an entry has expired.

## The feed

Copy **only** what the feed gives you. Your bot also receives the ordinary `messageCreate` events of
the rooms it is in, but the feed is the filtered copy: it leaves out the people who said no, the
bridge's own messages, other bridges' and bots' messages (unless the settings say otherwise), system
notices, threads, and anything from before the bridge existed. It arrives on your bot's own
connection.

| Event | Arguments | What to do |
| --- | --- | --- |
| `bridgeMessageCreate` | `message`, `{ bridge, replyExternal }` | Copy it. `replyExternal` is the copy of the message it answers, if there is one. |
| `bridgeMessageUpdate` | `message`, `{ bridge, external, replyExternal }` | Edit each copy in `external`. |
| `bridgeMessageDelete` | `message` (maybe partial), `{ bridge, external, byModerator }` | Delete each copy. For a message the bridge posted, `external` is the original. |
| `bridgeReactionAdd`, `bridgeReactionRemove` | `{ bridge, message, emoji, user, puppet, external }` | Mirror it on the copies. `puppet` is set when another bridge's user reacted. |
| `bridgeOptOut` | `{ bridge, userId, external }` | Someone said no. Delete every copy in `external`. |
| `bridgePuppetBlock`, `bridgePuppetUnblock` | `{ bridge, puppetId, externalUserId }` | Tell them on the other side, if you like. |

After downtime, catch up with the backlog: the same filtered messages, oldest first, one page at a
time.

```ts
for await (const { message, replyExternal } of bridge.backlog({ after: lastCopiedId })) {
  await copyToPlatform(message, replyExternal);
}
```

Strafe has no session resume, so run the backlog after `Events.Reconnected` as well as at startup.

## Consent

A bridge copies a room's messages to a third party, under that platform's terms, so the people in
the room decide:

- Each person has an account default ("Let bridges copy my messages to other platforms") and a
  per-space choice. A space is in **opt-out** mode, where everyone is copied unless they said no
  (the default), or **opt-in** mode, where only the people who said yes for that space are copied.
  With Manage Space, `space.setBridgeConsentMode('optin')` switches it, and the change is
  audit-logged.
- The server enforces it on the feed, before anything reaches your bot. You never get a list of who
  said no. When someone changes their answer to no, you get one `bridgeOptOut` with the copies of
  their messages that you made. Delete them on the other platform: that is the point of the event.
- In a federated space, members from other instances are left out of every feed for now.
- Bridging is never silent. The room shows a "Bridged" badge (what it is bridged with, by which
  bot, and whether *your* messages are copied), a notice when a bridge arrives or leaves, and a hint
  over the composer the first time someone posts there.
- The other direction has controls too. A moderator blocks a bridged user
  (`bridge.blocks.create(puppetId)`), and their sends are then refused with `puppet_blocked`. When
  someone asks the other platform to forget them, call `bridge.puppets.delete(externalUserId)`: it
  removes their record and their id-map entries, and their messages stay under the name they were
  sent with. Bridged users who post nothing for 90 days are forgotten automatically.

## A complete Discord bridge

<!-- terms-ok:start -->

The bridge below connects one Strafe room to one Discord channel, using strafe.js and discord.js.
On Discord, it posts Strafe messages through a Discord webhook, so each one shows the Strafe
person's name and avatar. On Strafe, it posts Discord messages through `bridge.send()`.

```sh
npm install @strafechat/strafe.js discord.js
STRAFE_INSTANCE=chat.example STRAFE_TOKEN=... STRAFE_ROOM=<room id> \
DISCORD_TOKEN=... DISCORD_CHANNEL=<channel id> DISCORD_WEBHOOK_URL=<a webhook of that channel> \
node bridge.ts
```

The Discord bot needs the Message Content intent, and permission to read the channel and add
reactions.

```ts
import {
  APIErrorCodes,
  BridgeAPIError,
  Client as StrafeClient,
  Events as StrafeEvents,
  type Bridge,
  type BridgeExternalMessage,
  type Message as StrafeMessage,
} from '@strafechat/strafe.js';
import {
  Client as DiscordClient,
  Events as DiscordEvents,
  GatewayIntentBits,
  Partials,
  WebhookClient as DiscordWebhook,
  type Message as DiscordMessage,
  type PartialMessage as DiscordPartialMessage,
} from 'discord.js';

const STRAFE_ROOM = process.env.STRAFE_ROOM!;
const DISCORD_CHANNEL = process.env.DISCORD_CHANNEL!;

const strafe = new StrafeClient({ instance: process.env.STRAFE_INSTANCE });
const discord = new DiscordClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});
const hook = new DiscordWebhook({ url: process.env.DISCORD_WEBHOOK_URL! });

let bridge: Bridge | null = null;
let guildId = '';
let lastCopied: string | undefined; // persist this to resume across restarts

// ---- Setup: find our bridge, or make it.

strafe.once(StrafeEvents.ClientReady, async () => {
  const room = await strafe.rooms.fetch(STRAFE_ROOM);
  if (!room.isTextRoom()) throw new Error('STRAFE_ROOM must be a space text room');
  const channel = await discord.channels.fetch(DISCORD_CHANNEL);
  if (!channel?.isTextBased() || channel.isDMBased()) throw new Error('DISCORD_CHANNEL must be a server text channel');
  guildId = channel.guildId;
  bridge =
    strafe.bridges.cache.find((b) => b.roomId === room.id) ??
    (await room.createBridge({
      platform: 'discord',
      name: `Discord #${channel.name}`,
      remote: { name: `${channel.guild.name} #${channel.name}`, url: channel.url },
    }));
  await catchUp();
});

strafe.on(StrafeEvents.Reconnected, () => void catchUp());

async function catchUp(): Promise<void> {
  if (!bridge) return;
  for await (const { message, replyExternal } of bridge.backlog({ after: lastCopied })) await copyToDiscord(message, replyExternal);
}

// ---- Discord -> Strafe

function author(message: DiscordMessage) {
  return {
    id: message.author.id,
    name: (message.member?.displayName ?? message.author.displayName).slice(0, 32),
    avatarURL: message.member?.displayAvatarURL() ?? message.author.displayAvatarURL(),
    bot: message.author.bot,
  };
}

discord.on(DiscordEvents.MessageCreate, async (message) => {
  // Our own webhook's posts are copies of Strafe messages: never send them back.
  if (!bridge || message.channelId !== DISCORD_CHANNEL || message.webhookId !== null) return;
  const options = {
    externalUser: author(message),
    externalMessageId: message.id,
    content: message.cleanContent,
    files: message.attachments.map((file) => ({ attachment: file.url, name: file.name })),
    replyTo: message.reference?.messageId ? { externalMessageId: message.reference.messageId } : undefined,
  };
  try {
    await bridge.send(options);
  } catch (error) {
    if (!(error instanceof BridgeAPIError)) throw error;
    if (error.code === APIErrorCodes.InvalidName) {
      // A reserved, moderator or role name on Strafe: post under a marked one instead.
      await bridge.send({ ...options, externalUser: { ...options.externalUser, name: `${options.externalUser.name.slice(0, 22)} (Discord)` } });
    } else if (error.code === APIErrorCodes.PuppetBlocked || error.code === APIErrorCodes.BridgeInactive) {
      // Blocked by a Strafe moderator, or the bridge is paused: drop it.
    } else throw error;
  }
});

discord.on(DiscordEvents.MessageUpdate, async (_old, message) => {
  if (!bridge || message.channelId !== DISCORD_CHANNEL || message.webhookId !== null) return;
  const full = message.partial ? await message.fetch() : message;
  await bridge.editMessage(full.id, { content: full.cleanContent }).catch(ignoreUnknown);
});

discord.on(DiscordEvents.MessageDelete, async (message: DiscordMessage | DiscordPartialMessage) => {
  if (!bridge || message.channelId !== DISCORD_CHANNEL) return;
  await bridge.deleteMessage(message.id).catch(ignoreUnknown);
});

discord.on(DiscordEvents.MessageReactionAdd, async (reaction, user) => {
  if (!bridge || reaction.message.channelId !== DISCORD_CHANNEL || user.bot || reaction.emoji.id !== null) return; // Discord's custom emoji do not exist on Strafe
  const who = user.partial ? await user.fetch() : user;
  await bridge
    .react(reaction.message.id, reaction.emoji.name!, { externalUserId: who.id, externalUser: { name: who.displayName.slice(0, 32), avatarURL: who.displayAvatarURL() } })
    .catch(ignoreUnknown);
});

discord.on(DiscordEvents.MessageReactionRemove, async (reaction, user) => {
  if (!bridge || reaction.message.channelId !== DISCORD_CHANNEL || reaction.emoji.id !== null) return;
  await bridge.unreact(reaction.message.id, reaction.emoji.name!, { externalUserId: user.id }).catch(ignoreUnknown);
});

/** An edit or delete of something the bridge has no record of (too old, or never bridged). */
function ignoreUnknown(error: unknown): void {
  if (error instanceof BridgeAPIError && (error.status === 404 || error.code === APIErrorCodes.PuppetBlocked)) return;
  throw error;
}

// ---- Strafe -> Discord (the feed)

/** Discord takes 2000 characters per message; a Strafe message holds up to 4000. */
function pieces(text: string | null): string[] {
  const out: string[] = [];
  for (let rest = text ?? ''; rest.length > 0; rest = rest.slice(2000)) out.push(rest.slice(0, 2000));
  return out.length > 0 ? out : [''];
}

async function copyToDiscord(message: StrafeMessage, replyExternal: BridgeExternalMessage | null): Promise<void> {
  if (!bridge) return;
  const name = message.member?.displayName ?? message.author.displayName ?? message.author.username ?? 'Strafe user';
  const avatarURL = message.member?.displayAvatarURL() ?? message.author.displayAvatarURL();
  const text = pieces(message.cleanContent);
  // A webhook cannot reply on Discord: quote a link to the copy instead.
  if (replyExternal) text[0] = `> ↪ https://discord.com/channels/${guildId}/${DISCORD_CHANNEL}/${replyExternal.externalMessageId}\n${text[0]}`;
  for (const [part, content] of text.entries()) {
    const sent = await hook.send({
      content,
      username: name.slice(0, 80),
      avatarURL,
      files: part === 0 ? message.attachments.map((file) => file.url) : [],
      allowedMentions: { parse: [] }, // Strafe pings must not become Discord pings
    });
    await bridge.link(message, sent.id, { part });
  }
  lastCopied = message.id;
}

strafe.on(StrafeEvents.BridgeMessageCreate, async (message, { bridge: from, replyExternal }) => {
  if (from.id === bridge?.id) await copyToDiscord(message, replyExternal);
});

strafe.on(StrafeEvents.BridgeMessageUpdate, async (message, { bridge: from, external }) => {
  if (from.id !== bridge?.id) return;
  const text = pieces(message.cleanContent);
  for (const copy of external) await hook.editMessage(copy.externalMessageId, { content: text[copy.part] ?? '…' });
});

strafe.on(StrafeEvents.BridgeMessageDelete, async (_message, { bridge: from, external }) => {
  if (from.id !== bridge?.id) return;
  for (const copy of external) await hook.deleteMessage(copy.externalMessageId).catch(() => {});
});

strafe.on(StrafeEvents.BridgeOptOut, async ({ bridge: from, external }) => {
  // Someone asked not to be copied: their copies go, as the event exists to make happen.
  if (from.id !== bridge?.id) return;
  for (const copy of external) await hook.deleteMessage(copy.externalMessageId).catch(() => {});
});

await discord.login(process.env.DISCORD_TOKEN);
await strafe.login();
```

<!-- terms-ok:end -->

What it leaves out, and you may want to add:

- **Reactions from Strafe to Discord.** A Discord webhook cannot react. Your Discord bot could
  react on the copy itself (`bridgeReactionAdd` gives the copy in `external`), but every reaction
  would then show as the bot's.
- **Persistence.** `lastCopied` lives in memory, so after a restart the bridge only catches up from
  the reconnect onward. Store it to resume properly.
- **Rate limits.** Strafe allows 50 sends per 10 seconds per bridge, and 5 per 5 seconds per bridged
  user. The library waits out a `429` in the bridge's own queue, so one busy bridge does not hold up
  the bot's other requests. Discord's limits are discord.js's business.

## Errors

Bridge failures are `BridgeAPIError`s, which are also `WebhookAPIError` and `StrafeAPIError`. They
carry a string `code` and read the extra fields out for you:

| `code` | Fields | When |
| --- | --- | --- |
| `bridge_inactive` | `state`, `stateReason` | The bridge is paused or disabled |
| `puppet_blocked` | | A moderator blocked this bridged user |
| `puppet_cannot_send` | | `@everyone` cannot send in the room: the bridge works one way only |
| `missing_permissions` | `permission` | Files, embeds or reactions that `@everyone` may not use, or the bot lacks a permission |
| `private_room_ack_required` | `audience` | Bridging or resuming in a room not everyone can see |
| `bridge_limit` | `max`, `scope` | 3 bridges per room, 20 per space |
| `invalid_name` | `nameReason` | Reserved, moderator or role name |
| `unknown_external_message` | | The id-map entry expired (30 days) or never existed |
| `external_message_conflict` | | `link()` with an external id that already maps elsewhere |
| `rate_limited`, `slowmode` | `scope` (`bridge`, `puppet`, `room`) | Waited out for you unless `rejectOnRateLimit` says otherwise |

The library checks a few things itself before it sends a request. A send without
`externalUser.id`, `externalUser.name` or `externalMessageId` throws `StrafeError`
`BridgeSendInvalid`, and an empty one throws `MessageEmpty`.

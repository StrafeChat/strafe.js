import type { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Client } from './Client.js';
import type { SpaceEmoji } from '../structures/Emoji.js';
import type { Message, PartialMessage } from '../structures/Message.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { Presence } from '../structures/Presence.js';
import type { Role } from '../structures/Role.js';
import type { AnyRoom, TextBasedRoom } from '../structures/rooms/index.js';
import type { TextRoom } from '../structures/rooms/TextRoom.js';
import type { VoiceRoom } from '../structures/rooms/VoiceRoom.js';
import type { Bridge, BridgeExternalMessage } from '../structures/Bridge.js';
import type { ThreadRoom } from '../structures/rooms/ThreadRoom.js';
import type { Space } from '../structures/Space.js';
import type { SpaceMember } from '../structures/SpaceMember.js';
import type { ThreadMember } from '../structures/ThreadMember.js';
import type { Typing } from '../structures/Typing.js';
import type { User } from '../structures/User.js';
import type { VoiceState } from '../structures/VoiceState.js';

/**
 * Event names (camelCase string values). Strafe has no intents: a bot receives every event about
 * what it can see.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `Events`.
 *
 * @example
 * ```ts
 * client.on(Events.MessageCreate, (message) => { ... });
 * ```
 */
export enum Events {
  /** The first READY: the client is usable (`ready` is emitted too, as an alias). */
  ClientReady = 'clientReady',
  /** Every READY, reconnects included (there is no resume: caches are reconciled). */
  GatewayReady = 'gatewayReady',
  /** The connection dropped and a reconnect is scheduled. */
  Reconnecting = 'reconnecting',
  /** A reconnect succeeded (after its READY). */
  Reconnected = 'reconnected',
  /** The token was revoked (`SESSION_REVOKED`); the client stops and does not reconnect. */
  Invalidated = 'invalidated',
  /** A message was sent. */
  MessageCreate = 'messageCreate',
  /** A message was edited. */
  MessageUpdate = 'messageUpdate',
  /** A message was deleted. */
  MessageDelete = 'messageDelete',
  /** Someone reacted. */
  MessageReactionAdd = 'messageReactionAdd',
  /** Someone removed a reaction. */
  MessageReactionRemove = 'messageReactionRemove',
  /** A message was pinned or unpinned. */
  RoomPinsUpdate = 'roomPinsUpdate',
  /** Someone started typing. */
  TypingStart = 'typingStart',
  /** The client joined (or was installed in) a space. */
  SpaceCreate = 'spaceCreate',
  /** A space changed. */
  SpaceUpdate = 'spaceUpdate',
  /** The client left a space, or it was deleted. */
  SpaceDelete = 'spaceDelete',
  /** Someone joined a space. */
  SpaceMemberAdd = 'spaceMemberAdd',
  /** A member changed (roles, nickname, space profile). */
  SpaceMemberUpdate = 'spaceMemberUpdate',
  /** Someone left, was kicked or was banned. */
  SpaceMemberRemove = 'spaceMemberRemove',
  /** A room was created (or became visible). */
  RoomCreate = 'roomCreate',
  /** A room changed (settings, position, overrides). */
  RoomUpdate = 'roomUpdate',
  /** A room was deleted (or stopped being visible). */
  RoomDelete = 'roomDelete',
  /** A role was created. */
  RoleCreate = 'roleCreate',
  /** A role changed. */
  RoleUpdate = 'roleUpdate',
  /** A role was deleted. */
  RoleDelete = 'roleDelete',
  /** A thread was created (or became visible). */
  ThreadCreate = 'threadCreate',
  /** A thread changed. */
  ThreadUpdate = 'threadUpdate',
  /** A thread was deleted. */
  ThreadDelete = 'threadDelete',
  /** People joined or left a thread. */
  ThreadMembersUpdate = 'threadMembersUpdate',
  /** A custom emoji was added. */
  EmojiCreate = 'emojiCreate',
  /** A custom emoji was renamed. */
  EmojiUpdate = 'emojiUpdate',
  /** A custom emoji was deleted. */
  EmojiDelete = 'emojiDelete',
  /** Someone's presence changed. */
  PresenceUpdate = 'presenceUpdate',
  /** Someone's profile changed. */
  UserUpdate = 'userUpdate',
  /** Someone's voice state changed. */
  VoiceStateUpdate = 'voiceStateUpdate',
  /** A room's webhooks changed (created, edited, moved, reset or deleted): refetch them if you show them. */
  WebhooksUpdate = 'webhooksUpdate',
  /** A room was bridged with another platform (any bridge in a room the client can see). */
  BridgeCreate = 'bridgeCreate',
  /** A bridge changed: paused, resumed, disabled, renamed, settings. */
  BridgeUpdate = 'bridgeUpdate',
  /** A bridge was removed. */
  BridgeDelete = 'bridgeDelete',
  /** Bridge feed: a message to copy to the platform (already filtered by consent, loops and settings). */
  BridgeMessageCreate = 'bridgeMessageCreate',
  /** Bridge feed: a message was edited, with where the bridge copied it. */
  BridgeMessageUpdate = 'bridgeMessageUpdate',
  /** Bridge feed: a message with a copy (or one the bridge posted) was deleted. */
  BridgeMessageDelete = 'bridgeMessageDelete',
  /** Bridge feed: someone reacted to a message. */
  BridgeReactionAdd = 'bridgeReactionAdd',
  /** Bridge feed: someone removed a reaction. */
  BridgeReactionRemove = 'bridgeReactionRemove',
  /** Bridge feed: someone said no to bridges; delete the copies of their messages. */
  BridgeOptOut = 'bridgeOptOut',
  /** Bridge feed: a moderator blocked a bridged user. */
  BridgePuppetBlock = 'bridgePuppetBlock',
  /** Bridge feed: a moderator unblocked a bridged user. */
  BridgePuppetUnblock = 'bridgePuppetUnblock',
  /** Every gateway frame, raw. */
  Raw = 'raw',
  /** Diagnostic messages. */
  Debug = 'debug',
  /** Something unexpected that did not stop the client (gateway error frames, ignored options). */
  Warn = 'warn',
  /** An error, such as one thrown by an event listener. */
  Error = 'error',
}

/** What `roomPinsUpdate` adds about the change. */
export interface RoomPinsUpdateDetails {
  /** The message. */
  messageId: Snowflake;
  /** Pinned (true) or unpinned (false). */
  pinned: boolean;
  /** Who did it. */
  userId: Snowflake;
}

/** What every bridge feed event says besides its message: the bridge. */
export interface BridgeEventDetails {
  /** The bridge (from `client.bridges`). */
  bridge: Bridge;
}

/** `bridgeMessageCreate`'s details. */
export interface BridgeMessageCreateDetails extends BridgeEventDetails {
  /** The copy of the message it answers, when the bridge has one: reply to that on the platform. */
  replyExternal: BridgeExternalMessage | null;
}

/** `bridgeMessageUpdate`'s details. */
export interface BridgeMessageUpdateDetails extends BridgeMessageCreateDetails {
  /** Where the bridge copied the message: edit these on the platform. */
  external: BridgeExternalMessage[];
}

/** `bridgeMessageDelete`'s details. */
export interface BridgeMessageDeleteDetails extends BridgeEventDetails {
  /** Where the bridge copied the message (or, for one it posted, its original): delete these on the platform. */
  external: BridgeExternalMessage[];
  /** A moderator deleted it (for a message the bridge posted: anyone but the bridge's bot). */
  byModerator: boolean;
}

/** `bridgeReactionAdd` / `bridgeReactionRemove`'s details. */
export interface BridgeReactionDetails extends BridgeEventDetails {
  /** The message (a partial one when not cached). */
  message: Message | PartialMessage;
  /** A unicode emoji, or `custom:<id>`. */
  emoji: string;
  /** Who reacted: a person or a bot, or another bridge's bridged user (then `puppet` is set). */
  user: User;
  /** Set when the reactor is another bridge's bridged user. */
  puppet: { bridgeId: Snowflake; puppetId: Snowflake; platform: string; platformName: string } | null;
  /** Where the bridge copied the message: react there. */
  external: BridgeExternalMessage[];
}

/** `bridgeOptOut`'s details. */
export interface BridgeOptOutDetails extends BridgeEventDetails {
  /** Who said no (the bridge never gets a list of who did, only this, to delete copies). */
  userId: Snowflake;
  /** The copies of their messages the bridge made: delete them on the platform. */
  external: (BridgeExternalMessage & { messageId: Snowflake })[];
}

/** `bridgePuppetBlock` / `bridgePuppetUnblock`'s details. */
export interface BridgePuppetBlockDetails extends BridgeEventDetails {
  /** The bridged user's id on Strafe. */
  puppetId: Snowflake;
  /** Their id on the other platform: tell them there. */
  externalUserId: string;
}

/**
 * Each event's listener arguments. Use it to type handler maps.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `ClientEvents`.
 *
 * @example
 * ```ts
 * const handler: (...args: ClientEvents['messageCreate']) => void = (message) => {};
 * ```
 */
export interface ClientEvents {
  /** The client is ready. */
  clientReady: [client: Client<true>];
  /** Alias of `clientReady`, emitted once at the same time. */
  ready: [client: Client<true>];
  /** Every READY. */
  gatewayReady: [];
  /** Reconnect scheduled. */
  reconnecting: [];
  /** Reconnected. */
  reconnected: [];
  /** Session revoked. */
  invalidated: [reason: string];
  /** New message. */
  messageCreate: [message: Message];
  /** Edited message: the cached copy before (or a partial message), and after. */
  messageUpdate: [oldMessage: Message | PartialMessage, newMessage: Message];
  /** Deleted message (partial when it was not cached). */
  messageDelete: [message: Message | PartialMessage];
  /** Reaction added. */
  messageReactionAdd: [reaction: MessageReaction, user: User];
  /** Reaction removed. */
  messageReactionRemove: [reaction: MessageReaction, user: User];
  /** Pin change: the room, the newest pin time (or null when none are left), and what changed. */
  roomPinsUpdate: [room: TextBasedRoom, date: Date | null, details: RoomPinsUpdateDetails];
  /** Typing. */
  typingStart: [typing: Typing];
  /** Joined a space. */
  spaceCreate: [space: Space];
  /** Space changed. */
  spaceUpdate: [oldSpace: Space, newSpace: Space];
  /** Left a space. */
  spaceDelete: [space: Space];
  /** Member joined. */
  spaceMemberAdd: [member: SpaceMember];
  /** Member changed: the cached copy before (a partial member, `partial === true`, when it was not cached), and after. */
  spaceMemberUpdate: [oldMember: SpaceMember, newMember: SpaceMember];
  /** Member left (a partial member when it was not cached). */
  spaceMemberRemove: [member: SpaceMember];
  /** Room created. */
  roomCreate: [room: AnyRoom];
  /** Room changed. */
  roomUpdate: [oldRoom: AnyRoom, newRoom: AnyRoom];
  /** Room deleted. */
  roomDelete: [room: AnyRoom];
  /** Role created. */
  roleCreate: [role: Role];
  /** Role changed. */
  roleUpdate: [oldRole: Role, newRole: Role];
  /** Role deleted. */
  roleDelete: [role: Role];
  /** Thread created (`newlyCreated` is false when an existing thread became visible). */
  threadCreate: [thread: ThreadRoom, newlyCreated: boolean];
  /** Thread changed. */
  threadUpdate: [oldThread: ThreadRoom, newThread: ThreadRoom];
  /** Thread deleted. */
  threadDelete: [thread: ThreadRoom];
  /** Thread members changed. */
  threadMembersUpdate: [added: Collection<Snowflake, ThreadMember>, removed: Collection<Snowflake, ThreadMember>, thread: ThreadRoom];
  /** Emoji added. */
  emojiCreate: [emoji: SpaceEmoji];
  /** Emoji changed. */
  emojiUpdate: [oldEmoji: SpaceEmoji, newEmoji: SpaceEmoji];
  /** Emoji deleted. */
  emojiDelete: [emoji: SpaceEmoji];
  /** Presence changed (the old one when known). */
  presenceUpdate: [oldPresence: Presence | null, newPresence: Presence];
  /** Profile changed. */
  userUpdate: [oldUser: User, newUser: User];
  /** Voice state changed. */
  voiceStateUpdate: [oldState: VoiceState, newState: VoiceState];
  /** A room's webhooks changed. */
  webhooksUpdate: [room: TextRoom | VoiceRoom];
  /** A room was bridged. */
  bridgeCreate: [bridge: Bridge];
  /** A bridge changed: the copy before, and after. */
  bridgeUpdate: [oldBridge: Bridge, newBridge: Bridge];
  /** A bridge was removed. */
  bridgeDelete: [bridge: Bridge];
  /** Bridge feed: copy this message. */
  bridgeMessageCreate: [message: Message, details: BridgeMessageCreateDetails];
  /** Bridge feed: a copied message was edited. */
  bridgeMessageUpdate: [message: Message, details: BridgeMessageUpdateDetails];
  /** Bridge feed: a message was deleted (partial when it was not cached). */
  bridgeMessageDelete: [message: Message | PartialMessage, details: BridgeMessageDeleteDetails];
  /** Bridge feed: a reaction was added. */
  bridgeReactionAdd: [details: BridgeReactionDetails];
  /** Bridge feed: a reaction was removed. */
  bridgeReactionRemove: [details: BridgeReactionDetails];
  /** Bridge feed: someone opted out. */
  bridgeOptOut: [details: BridgeOptOutDetails];
  /** Bridge feed: a bridged user was blocked. */
  bridgePuppetBlock: [details: BridgePuppetBlockDetails];
  /** Bridge feed: a bridged user was unblocked. */
  bridgePuppetUnblock: [details: BridgePuppetBlockDetails];
  /** A raw gateway frame. */
  raw: [packet: unknown];
  /** Diagnostics. */
  debug: [message: string];
  /** A warning. */
  warn: [message: string];
  /** An error. */
  error: [error: Error];
}

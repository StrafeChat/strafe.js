import type { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Client } from './Client.js';
import type { SpaceEmoji } from '../structures/Emoji.js';
import type { Message, PartialMessage } from '../structures/Message.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { Presence } from '../structures/Presence.js';
import type { Role } from '../structures/Role.js';
import type { AnyRoom, TextBasedRoom } from '../structures/rooms/index.js';
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
  /** A raw gateway frame. */
  raw: [packet: unknown];
  /** Diagnostics. */
  debug: [message: string];
  /** A warning. */
  warn: [message: string];
  /** An error. */
  error: [error: Error];
}

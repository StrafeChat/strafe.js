import type { Snowflake } from '../../util/Snowflake.js';
import type { APIActivity, APIPresence, ISO8601Timestamp } from './common.js';
import type { APIMessage } from './message.js';
import type { APIPMRoom, APISpaceRoom } from './room.js';
import type { APIEmoji, APIRole, APISpace } from './space.js';
import type { APICall, APIVoiceState } from './voice.js';

/** Gateway opcodes (`op` on every frame). */
export enum GatewayOpcodes {
  /** Client: heartbeat; answered with {@link GatewayOpcodes.Pong}. */
  Heartbeat = 0,
  /** Client: subscribe to a space or room. Bots are subscribed by the server already. */
  Subscribe = 1,
  /** Client: relay a client event (typing) to a room. Prefer `POST /rooms/:id/typing`. */
  Send = 2,
  /** Server: an event (`MESSAGE_CREATE`...). */
  Dispatch = 3,
  /** Server: READY, the first frame of every connection. */
  Ready = 4,
  /** Client: unsubscribe. */
  Unsubscribe = 5,
  /** Client: ping; answered with {@link GatewayOpcodes.Pong} (used to measure latency). */
  Ping = 6,
  /** Server: pong. */
  Pong = 7,
  /** Server: an error; the socket stays open. */
  Error = 8,
  /** Client: set game activities for this connection. */
  Activity = 9,
}

/** Error codes in op 8 frames (the socket stays open). */
export enum GatewayErrorCodes {
  /** The frame was not valid JSON. */
  InvalidJSON = 4000,
  /** Unknown opcode. */
  UnknownOpcode = 4001,
  /** Bad subscribe payload. */
  InvalidSubscribe = 4002,
  /** Bad send payload. */
  InvalidSend = 4003,
  /** `space_id` missing in a send. */
  SpaceIdRequired = 4004,
  /** Sending to a room you are not subscribed to. */
  NotSubscribed = 4005,
  /** Tried to send a server-reserved event type. */
  ReservedEventType = 4006,
  /** Bad activity payload. */
  InvalidActivity = 4007,
  /** Too many subscribes or sends. */
  RateLimited = 4029,
  /** Not allowed to subscribe to that space or room. */
  NotAuthorized = 4403,
}

/** Event names (`t`) the gateway dispatches. */
export enum GatewayDispatchEvents {
  /** A message was sent. */
  MessageCreate = 'MESSAGE_CREATE',
  /** A message was edited. */
  MessageUpdate = 'MESSAGE_UPDATE',
  /** A message was deleted. */
  MessageDelete = 'MESSAGE_DELETE',
  /** Someone reacted. */
  MessageReactionAdd = 'MESSAGE_REACTION_ADD',
  /** Someone removed a reaction. */
  MessageReactionRemove = 'MESSAGE_REACTION_REMOVE',
  /** A message was pinned or unpinned. */
  RoomPinsUpdate = 'ROOM_PINS_UPDATE',
  /** Someone started typing. */
  TypingStart = 'TYPING_START',
  /** A relayed client event (op 2); the sender is not identified. */
  Message = 'MESSAGE',
  /** Your read position moved (sent only to you). */
  MessageAck = 'MESSAGE_ACK',
  /** Your unread mention count changed (sent only to you). */
  MessageMentionUpdate = 'MESSAGE_MENTION_UPDATE',
  /** A space room was created (or became visible to you). An upsert. */
  SpaceRoomCreate = 'SPACE_ROOM_CREATE',
  /** A space room changed (partial payload). */
  SpaceRoomUpdate = 'SPACE_ROOM_UPDATE',
  /** A space room was deleted (or you lost View Room). */
  SpaceRoomDelete = 'SPACE_ROOM_DELETE',
  /** A role override changed. */
  SpaceRoomOverrideUpdate = 'SPACE_ROOM_OVERRIDE_UPDATE',
  /** A role override was removed. */
  SpaceRoomOverrideDelete = 'SPACE_ROOM_OVERRIDE_DELETE',
  /** A user override changed. */
  SpaceRoomUserOverrideUpdate = 'SPACE_ROOM_USER_OVERRIDE_UPDATE',
  /** A user override was removed. */
  SpaceRoomUserOverrideDelete = 'SPACE_ROOM_USER_OVERRIDE_DELETE',
  /** A PM or group PM was opened with you. */
  RoomCreate = 'ROOM_CREATE',
  /** A PM or group PM changed. */
  RoomUpdate = 'ROOM_UPDATE',
  /** You left (or were removed from) a PM or group PM. */
  RoomLeave = 'ROOM_LEAVE',
  /** Your notification settings for a room changed. */
  RoomNotifySettingsUpdate = 'ROOM_NOTIFY_SETTINGS_UPDATE',
  /** A thread was created (or became visible). */
  ThreadCreate = 'THREAD_CREATE',
  /** A thread changed. */
  ThreadUpdate = 'THREAD_UPDATE',
  /** A thread was deleted. */
  ThreadDelete = 'THREAD_DELETE',
  /** People joined or left a thread. */
  ThreadMembersUpdate = 'THREAD_MEMBERS_UPDATE',
  /** You joined or left a thread. */
  ThreadMemberUpdate = 'THREAD_MEMBER_UPDATE',
  /** You joined, created or were installed into a space. */
  SpaceCreate = 'SPACE_CREATE',
  /** A space changed. */
  SpaceUpdate = 'SPACE_UPDATE',
  /** A space was deleted. */
  SpaceDelete = 'SPACE_DELETE',
  /** You left, were kicked or banned, or the space was deleted. */
  SpaceLeave = 'SPACE_LEAVE',
  /** Someone joined a space. */
  SpaceMemberAdd = 'SPACE_MEMBER_ADD',
  /** Someone left a space. */
  SpaceMemberRemove = 'SPACE_MEMBER_REMOVE',
  /** A member's roles or space profile changed. */
  SpaceMemberUpdate = 'SPACE_MEMBER_UPDATE',
  /** A role was created. */
  SpaceRoleCreate = 'SPACE_ROLE_CREATE',
  /** A role changed. */
  SpaceRoleUpdate = 'SPACE_ROLE_UPDATE',
  /** A role was deleted. */
  SpaceRoleDelete = 'SPACE_ROLE_DELETE',
  /** A custom emoji was added. */
  SpaceEmojiCreate = 'SPACE_EMOJI_CREATE',
  /** A custom emoji was renamed. */
  SpaceEmojiUpdate = 'SPACE_EMOJI_UPDATE',
  /** A custom emoji was deleted. */
  SpaceEmojiDelete = 'SPACE_EMOJI_DELETE',
  /** An end-to-end encryption hint; ignore. */
  SessionRotate = 'SESSION_ROTATE',
  /** Someone's presence changed. */
  PresenceUpdate = 'PRESENCE_UPDATE',
  /** Someone's profile changed. */
  UserUpdate = 'USER_UPDATE',
  /** Your token was revoked; the connection closes. */
  SessionRevoked = 'SESSION_REVOKED',
  /** Someone's voice state changed. */
  VoiceStateUpdate = 'VOICE_STATE_UPDATE',
  /** A PM call started. */
  CallCreate = 'CALL_CREATE',
  /** A PM call changed. */
  CallUpdate = 'CALL_UPDATE',
  /** A PM call ended. */
  CallDelete = 'CALL_DELETE',
}

/** Ids the server injects into every map payload. */
export interface GatewayScopedIds {
  /** The room, for room events. */
  room_id?: Snowflake;
  /** The space, for space events. */
  space_id?: Snowflake;
}

/** `MESSAGE_CREATE` for a system notice: a reduced message with no author or embeds. */
export interface GatewaySystemMessage extends GatewayScopedIds {
  /** Message id. */
  id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** `"0"`. */
  sender_id: '0';
  /** Kind of notice. */
  system_type: string;
  /** JSON-encoded notice data. */
  system_payload: string;
  /** When. */
  created_at: ISO8601Timestamp;
  /** When. */
  updated_at: ISO8601Timestamp;
}

/** `MESSAGE_DELETE`. */
export interface GatewayMessageDeleteData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** The deleted message. */
  message_id: Snowflake;
  /** The room's new newest message, when it changed. */
  last_message_id?: Snowflake | null;
}

/** `MESSAGE_REACTION_ADD` / `MESSAGE_REACTION_REMOVE`. */
export interface GatewayMessageReactionData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** The message. */
  message_id: Snowflake;
  /** Who reacted. */
  user_id: Snowflake;
  /** A unicode emoji, or `custom:<emoji id>` (the name is not included). */
  emoji: string;
}

/** `ROOM_PINS_UPDATE`. */
export interface GatewayRoomPinsUpdateData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** The message pinned or unpinned. */
  message_id: Snowflake;
  /** Who did it. */
  user_id: Snowflake;
  /** Pinned (true) or unpinned (false). */
  pinned: boolean;
  /** When it was pinned. */
  pinned_at?: ISO8601Timestamp;
  /** Newest pin time in the room, or null when none are left. */
  last_pin_timestamp: ISO8601Timestamp | null;
}

/** `TYPING_START`. */
export interface GatewayTypingStartData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** Who is typing. */
  user_id: Snowflake;
  /** Unix SECONDS. */
  timestamp: number;
}

/** `MESSAGE` (an op-2 relay; the sender is not identified). */
export interface GatewayRelayData extends GatewayScopedIds {
  /** Event type chosen by the sender (`typing`). */
  type: string;
  /** Sender-defined content. */
  content: unknown;
  /** Optional reply id. */
  reply_to?: Snowflake;
}

/** `MESSAGE_ACK` (sent only to you). */
export interface GatewayMessageAckData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** Acked message. */
  message_id: Snowflake;
  /** New read position. */
  last_read_message_id: Snowflake;
}

/** `MESSAGE_MENTION_UPDATE` (sent only to you). */
export interface GatewayMessageMentionUpdateData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** Unread mentions. */
  mention_count: number;
  /** The message that changed it. */
  message_id?: Snowflake;
}

/**
 * `SPACE_ROOM_UPDATE`: a PARTIAL room keyed by `room_id` (no `id`, no `type`); merge it into the
 * cached room.
 */
export interface GatewaySpaceRoomUpdateData extends Partial<Omit<APISpaceRoom, 'id' | 'type'>> {
  /** The room. */
  room_id: Snowflake;
  /** The space. */
  space_id: Snowflake;
}

/** `SPACE_ROOM_DELETE`. */
export interface GatewaySpaceRoomDeleteData {
  /** The room. */
  room_id: Snowflake;
  /** The space. */
  space_id: Snowflake;
}

/** `SPACE_ROOM_OVERRIDE_UPDATE`. */
export interface GatewayRoleOverrideUpdateData {
  /** The space. */
  space_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The role. */
  role_id: Snowflake;
  /** Bits granted. */
  allow: number;
  /** Bits refused. */
  deny: number;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it changed. */
  updated_at: ISO8601Timestamp;
}

/** `SPACE_ROOM_OVERRIDE_DELETE`. */
export interface GatewayRoleOverrideDeleteData {
  /** The space. */
  space_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The role. */
  role_id: Snowflake;
}

/** `SPACE_ROOM_USER_OVERRIDE_UPDATE`. */
export interface GatewayUserOverrideUpdateData {
  /** The space. */
  space_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The user. */
  user_id: Snowflake;
  /** Bits granted. */
  allow: number;
  /** Bits refused. */
  deny: number;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it changed. */
  updated_at: ISO8601Timestamp;
}

/** `SPACE_ROOM_USER_OVERRIDE_DELETE`. */
export interface GatewayUserOverrideDeleteData {
  /** The space. */
  space_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The user. */
  user_id: Snowflake;
}

/** `ROOM_LEAVE` (sent only to you). */
export interface GatewayRoomLeaveData {
  /** The room left. */
  room_id: Snowflake;
}

/** `ROOM_NOTIFY_SETTINGS_UPDATE` (sent only to you). */
export interface GatewayRoomNotifySettingsData extends GatewayScopedIds {
  /** The room. */
  room_id: Snowflake;
  /** Muted. */
  muted: boolean;
  /** Mute expiry. */
  muted_until: ISO8601Timestamp | null;
  /** Notification mode. */
  notify_mode: number;
}

/** `THREAD_DELETE`. */
export interface GatewayThreadDeleteData {
  /** The space. */
  space_id: Snowflake;
  /** The thread. */
  room_id: Snowflake;
  /** Its text room. */
  parent_id: Snowflake;
}

/** `THREAD_MEMBERS_UPDATE`. */
export interface GatewayThreadMembersUpdateData {
  /** The space. */
  space_id: Snowflake;
  /** The thread. */
  room_id: Snowflake;
  /** Its text room. */
  parent_id: Snowflake;
  /** Who joined. */
  added_members: { user_id: Snowflake; joined_at: ISO8601Timestamp }[];
  /** Who left. */
  removed_member_ids: Snowflake[];
  /** Members now. */
  member_count: number;
}

/** `THREAD_MEMBER_UPDATE` (sent only to you). */
export interface GatewayThreadMemberUpdateData {
  /** The space. */
  space_id: Snowflake;
  /** The thread. */
  room_id: Snowflake;
  /** Whether you are now in it. */
  joined: boolean;
}

/** `SPACE_CREATE`: a space you just joined (or created, or were installed into), with roles and rooms. */
export interface GatewaySpaceCreateData extends APISpace {
  /** Same as `id`. */
  space_id: Snowflake;
  /** Roles, lowest first. */
  roles: APIRole[];
  /** Rooms you can view. */
  rooms: APISpaceRoom[];
}

/** `SPACE_UPDATE`. Carries `roles` (and `everyone_role_id`) after a reorder or bot install. */
export interface GatewaySpaceUpdateData extends APISpace {
  /** Same as `id`. */
  space_id: Snowflake;
}

/** `SPACE_DELETE` / `SPACE_LEAVE`. */
export interface GatewaySpaceDeleteData {
  /** The space. */
  space_id: Snowflake;
}

/** `SPACE_MEMBER_ADD`. Note `role_ids` (REST members say `roles`). */
export interface GatewaySpaceMemberAddData {
  /** The space. */
  space_id: Snowflake;
  /** User id. */
  id: Snowflake;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Bio. */
  bio: string;
  /** About me. */
  about_me: string;
  /** Pronouns. */
  pronouns: string;
  /** Bot account. */
  bot: boolean;
  /** Badge bits. */
  public_flags: number;
  /** Presence. */
  presence?: APIPresence;
  /** Home instance domain. */
  home_domain?: string;
  /** Id on the home instance. */
  origin_id?: Snowflake;
  /** Role ids, without `@everyone`. */
  role_ids: Snowflake[];
  /** When they joined. */
  joined_at: ISO8601Timestamp;
  /** Space nickname. */
  nick: string | null;
  /** Space avatar URL. */
  space_avatar: string | null;
  /** Space banner URL. */
  space_banner: string | null;
  /** Space about me. */
  space_about_me: string | null;
  /** Space bio. */
  space_bio: string | null;
  /** Space pronouns. */
  space_pronouns: string | null;
}

/** `SPACE_MEMBER_UPDATE`: the member's full space state. */
export interface GatewaySpaceMemberUpdateData {
  /** The space. */
  space_id: Snowflake;
  /** The user. */
  user_id: Snowflake;
  /** Role ids, without `@everyone`. */
  role_ids: Snowflake[];
  /** Space nickname. */
  nick: string | null;
  /** Space avatar URL. */
  space_avatar: string | null;
  /** Space banner URL. */
  space_banner: string | null;
  /** Space about me. */
  space_about_me: string | null;
  /** Space bio. */
  space_bio: string | null;
  /** Space pronouns. */
  space_pronouns: string | null;
}

/** `SPACE_MEMBER_REMOVE`. */
export interface GatewaySpaceMemberRemoveData {
  /** The space. */
  space_id: Snowflake;
  /** The user. */
  user_id: Snowflake;
}

/** `SPACE_ROLE_CREATE` / `SPACE_ROLE_UPDATE`. */
export interface GatewaySpaceRoleData extends APIRole {
  /** The space. */
  space_id: Snowflake;
}

/** `SPACE_ROLE_DELETE`. */
export interface GatewaySpaceRoleDeleteData {
  /** The space. */
  space_id: Snowflake;
  /** The role. */
  role_id: Snowflake;
}

/** `SPACE_EMOJI_DELETE`. */
export interface GatewaySpaceEmojiDeleteData {
  /** The space. */
  space_id: Snowflake;
  /** The emoji. */
  emoji_id: Snowflake;
}

/** `PRESENCE_UPDATE` (replace the presence, do not merge). */
export interface GatewayPresenceUpdateData {
  /** The user. */
  user_id: Snowflake;
  /** The new presence. */
  presence: APIPresence;
}

/** `USER_UPDATE`. */
export interface GatewayUserUpdateData extends GatewayScopedIds {
  /** The user. */
  user_id: Snowflake;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Bio. */
  bio: string;
  /** About me. */
  about_me: string;
  /** Accent color. */
  accent_color: string;
  /** Bot account. */
  bot: boolean;
  /** Pronouns. */
  pronouns: string;
  /** `MM-DD` (opted in). */
  birthday?: string;
  /** Birthday today. */
  is_birthday?: boolean;
}

/** `SESSION_REVOKED`: the token is dead (reset or instance ban); the socket closes ~0.5 s later. */
export interface GatewaySessionRevokedData {
  /** Why, e.g. `bot token reset`. */
  reason: string;
}

/** `SESSION_ROTATE`: an end-to-end encryption hint; bots can ignore it. */
export interface GatewaySessionRotateData {
  /** The room whose keys rotate. */
  room_id?: Snowflake;
  /** The space whose keys rotate. */
  space_id?: Snowflake;
}

/** Payload type of each dispatch event. */
export interface GatewayDispatchDataMap {
  MESSAGE_CREATE: (APIMessage & GatewayScopedIds) | GatewaySystemMessage;
  MESSAGE_UPDATE: APIMessage & GatewayScopedIds;
  MESSAGE_DELETE: GatewayMessageDeleteData;
  MESSAGE_REACTION_ADD: GatewayMessageReactionData;
  MESSAGE_REACTION_REMOVE: GatewayMessageReactionData;
  ROOM_PINS_UPDATE: GatewayRoomPinsUpdateData;
  TYPING_START: GatewayTypingStartData;
  MESSAGE: GatewayRelayData;
  MESSAGE_ACK: GatewayMessageAckData;
  MESSAGE_MENTION_UPDATE: GatewayMessageMentionUpdateData;
  SPACE_ROOM_CREATE: APISpaceRoom;
  SPACE_ROOM_UPDATE: GatewaySpaceRoomUpdateData;
  SPACE_ROOM_DELETE: GatewaySpaceRoomDeleteData;
  SPACE_ROOM_OVERRIDE_UPDATE: GatewayRoleOverrideUpdateData;
  SPACE_ROOM_OVERRIDE_DELETE: GatewayRoleOverrideDeleteData;
  SPACE_ROOM_USER_OVERRIDE_UPDATE: GatewayUserOverrideUpdateData;
  SPACE_ROOM_USER_OVERRIDE_DELETE: GatewayUserOverrideDeleteData;
  ROOM_CREATE: APIPMRoom;
  ROOM_UPDATE: APIPMRoom;
  ROOM_LEAVE: GatewayRoomLeaveData;
  ROOM_NOTIFY_SETTINGS_UPDATE: GatewayRoomNotifySettingsData;
  THREAD_CREATE: APISpaceRoom;
  THREAD_UPDATE: APISpaceRoom;
  THREAD_DELETE: GatewayThreadDeleteData;
  THREAD_MEMBERS_UPDATE: GatewayThreadMembersUpdateData;
  THREAD_MEMBER_UPDATE: GatewayThreadMemberUpdateData;
  SPACE_CREATE: GatewaySpaceCreateData;
  SPACE_UPDATE: GatewaySpaceUpdateData;
  SPACE_DELETE: GatewaySpaceDeleteData;
  SPACE_LEAVE: GatewaySpaceDeleteData;
  SPACE_MEMBER_ADD: GatewaySpaceMemberAddData;
  SPACE_MEMBER_REMOVE: GatewaySpaceMemberRemoveData;
  SPACE_MEMBER_UPDATE: GatewaySpaceMemberUpdateData;
  SPACE_ROLE_CREATE: GatewaySpaceRoleData;
  SPACE_ROLE_UPDATE: GatewaySpaceRoleData;
  SPACE_ROLE_DELETE: GatewaySpaceRoleDeleteData;
  SPACE_EMOJI_CREATE: APIEmoji;
  SPACE_EMOJI_UPDATE: APIEmoji;
  SPACE_EMOJI_DELETE: GatewaySpaceEmojiDeleteData;
  SESSION_ROTATE: GatewaySessionRotateData;
  PRESENCE_UPDATE: GatewayPresenceUpdateData;
  USER_UPDATE: GatewayUserUpdateData;
  SESSION_REVOKED: GatewaySessionRevokedData;
  VOICE_STATE_UPDATE: APIVoiceState;
  CALL_CREATE: APICall;
  CALL_UPDATE: APICall;
  CALL_DELETE: APICall;
}

/**
 * The envelope inside a dispatch frame. `space_id` names the real space the event is about
 * (absent for PM and account events), `room_id` the room; `user_id` is set only on deliveries to
 * your account feed (it is you). Prefer the ids inside `d`: older servers set both envelope ids to
 * the subscription the event was routed through.
 */
export interface GatewayEnvelope<T extends string = string, D = unknown> {
  /** Event name (duplicated at the frame's top level). */
  t: T;
  /** The real space. */
  space_id?: Snowflake;
  /** The room. */
  room_id?: Snowflake;
  /** Set on deliveries to your account feed. */
  user_id?: Snowflake;
  /** The payload. */
  d: D;
  /** Federation origin (usually empty). */
  origin?: string;
  /** Region (usually `default`). */
  region?: string;
}

/** A dispatch frame (op 3) for one event name. */
export interface GatewayDispatchFrame<T extends keyof GatewayDispatchDataMap = keyof GatewayDispatchDataMap> {
  /** {@link GatewayOpcodes.Dispatch}. */
  op: GatewayOpcodes.Dispatch;
  /** Event name. */
  t: T;
  /** Envelope with the payload in `d`. */
  d: GatewayEnvelope<T, GatewayDispatchDataMap[T]>;
}

/** Any dispatch frame, discriminated on `t`. */
export type GatewayDispatchPayload = { [T in keyof GatewayDispatchDataMap]: GatewayDispatchFrame<T> }[keyof GatewayDispatchDataMap];

/** READY (op 4) for a bot. */
export interface GatewayReadyData {
  /** The bot's own user. */
  user: {
    id: Snowflake;
    username: string;
    display_name: string;
    public_flags: number;
    bot: boolean;
    verified_email: boolean;
    created_at: ISO8601Timestamp;
    avatar?: string;
    banner?: string;
    about_me?: string;
    bio?: string;
    pronouns?: string;
    birthday_opt_in?: boolean;
    birthday?: string;
    presence?: APIPresence;
  };
  /** Always `"0"` for bots (there is no resume). */
  session_id: string;
  /** PMs and group PMs, plus a lighter copy of space rooms (merge those into `space_rooms`). */
  rooms?: APIPMRoom[];
  /** Always empty for bots. */
  relationships?: unknown[];
  /** Spaces with their roles (lowest first) and `everyone_role_id`. */
  spaces?: (APISpace & { roles?: APIRole[] })[];
  /** Rooms you can view, per space id; active threads included. */
  space_rooms?: Record<Snowflake, APISpaceRoom[]>;
  /** Voice states (when voice is configured). */
  voice_states?: APIVoiceState[];
  /** Ongoing PM calls (when voice is configured). */
  calls?: APICall[];
}

/** READY frame. */
export interface GatewayReadyFrame {
  /** {@link GatewayOpcodes.Ready}. */
  op: GatewayOpcodes.Ready;
  /** READY data. */
  d: GatewayReadyData;
}

/** Pong frame. */
export interface GatewayPongFrame {
  /** {@link GatewayOpcodes.Pong}. */
  op: GatewayOpcodes.Pong;
}

/** Error frame. The connection stays open. */
export interface GatewayErrorFrame {
  /** {@link GatewayOpcodes.Error}. */
  op: GatewayOpcodes.Error;
  /** Code and message. */
  d: { code: GatewayErrorCodes | number; message: string };
}

/** Any frame the server sends. */
export type GatewayReceivePayload = GatewayDispatchPayload | GatewayReadyFrame | GatewayPongFrame | GatewayErrorFrame;

/** Frames a client may send. */
export type GatewaySendPayload =
  | { op: GatewayOpcodes.Heartbeat }
  | { op: GatewayOpcodes.Ping }
  | { op: GatewayOpcodes.Subscribe; d: { space_id: Snowflake } }
  | { op: GatewayOpcodes.Unsubscribe; d: { space_id: Snowflake } }
  | { op: GatewayOpcodes.Send; d: { space_id: Snowflake; type: string; content: unknown; reply_to?: Snowflake } }
  | { op: GatewayOpcodes.Activity; d: { activities: APIActivity[] } | null };

/** The body of a rejected gateway handshake (an HTTP response, not a close frame). */
export interface GatewayHandshakeError {
  /** {@link GatewayOpcodes.Error}. */
  op: GatewayOpcodes.Error;
  /** HTTP status and message. */
  d: { code: number; message: string };
}

import type { Snowflake } from '../../util/Snowflake.js';
import type { APIPresence, ISO8601Timestamp, PresenceStatus } from './common.js';
import type { APIEmbed, APIMessage, APIPin, APIReactionSummary } from './message.js';
import type { APISpaceRoom } from './room.js';
import type { APICall, APIVoiceState } from './voice.js';

/**
 * `POST /rooms/:id/messages`. In rooms that are not end-to-end encrypted the server finds mentions
 * in `plaintext` itself and ignores `mentions`, `mention_roles` and `mention_everyone`.
 */
export interface RESTPostAPIRoomMessageJSONBody {
  /** Text, up to 4000 code points. */
  plaintext?: string;
  /** The message replied to (same room). */
  reply_to_id?: Snowflake;
  /** Upload ids from `POST /rooms/:id/attachments` (up to 10). */
  attachments?: Snowflake[];
  /** Embeds (bots only, up to 10, Embed Links permission). */
  embeds?: APIEmbed[];
  /** Ignored in plain rooms. */
  mentions?: Snowflake[];
  /** Ignored in plain rooms. */
  mention_roles?: Snowflake[];
  /** Ignored in plain rooms. */
  mention_everyone?: boolean;
}

/** `PATCH /rooms/:id/messages/:msg_id` (own messages only). */
export interface RESTPatchAPIRoomMessageJSONBody {
  /** New text; `""` keeps the old text. */
  plaintext?: string;
  /** New embeds; absent keeps them, `[]` or `null` removes them. */
  embeds?: APIEmbed[] | null;
}

/** Query of `GET /rooms/:id/messages`: at most one of `before`, `after`, `around`. */
export interface RESTGetAPIRoomMessagesQuery {
  /** 1-100, default 50. */
  limit?: number;
  /** Older than this id (newest first). */
  before?: Snowflake;
  /** Newer than this id (OLDEST first). */
  after?: Snowflake;
  /** Around this id (oldest first). */
  around?: Snowflake;
}

/** `GET /rooms/:id/pins`. */
export interface RESTGetAPIRoomPinsResult {
  /** Pins, newest first. */
  items: APIPin[];
  /** Always false today. */
  has_more: boolean;
}

/** `PUT`/`DELETE` reaction: the message's reactions afterwards. */
export interface RESTReactionsResult {
  /** All reactions on the message. */
  reactions: APIReactionSummary[];
}

/** `GET /rooms/:id/messages/search`. */
export interface RESTGetAPIRoomSearchResult {
  /** False in end-to-end encrypted rooms. */
  searchable: boolean;
  /** Matches. */
  messages: APIMessage[];
  /** Cursor for the next page. */
  next_before_id?: Snowflake;
}

/** `GET /spaces/:id/messages/search`. */
export interface RESTGetAPISpaceSearchResult {
  /** Matches. */
  messages: APIMessage[];
  /** Rooms searched. */
  rooms_searched: number;
  /** Encrypted rooms skipped. */
  encrypted_rooms: number;
  /** Cursor for the next page. */
  next_before_id?: Snowflake;
}

/** `POST /rooms` (open a PM or group PM). */
export interface RESTPostAPIRoomJSONBody {
  /** 1:1 PM by user id. */
  recipient_id?: Snowflake;
  /** 1:1 PM by handle (`name` or `name@domain`). */
  recipient_handle?: string;
  /** Group PM by user ids. */
  recipient_ids?: Snowflake[];
  /** Group PM by handles. */
  recipient_handles?: string[];
  /** Group PM name (up to 100). */
  name?: string;
}

/** `PATCH /users/@me`. */
export interface RESTPatchAPICurrentUserJSONBody {
  /** Up to 32. */
  display_name?: string;
  /** Up to 190. */
  bio?: string;
  /** Up to 190. */
  about_me?: string;
  /** Up to 40. */
  pronouns?: string;
  /** `#rrggbb` or `""`. */
  accent_color?: string;
  /** Share the birthday. */
  birthday_opt_in?: boolean;
  /** Only `""` (clear); upload with `POST /users/@me/avatar`. */
  avatar?: '';
  /** Only `""` (clear); upload with `POST /users/@me/banner`. */
  banner?: '';
  /** Status and custom status. */
  presence?: { status?: PresenceStatus; custom_status?: string };
}

/** `POST /spaces`. */
export interface RESTPostAPISpaceJSONBody {
  /** Name. */
  name: string;
  /** Description. */
  description?: string;
  /** Icon URL. */
  icon?: string;
}

/** `PATCH /spaces/:id` (room ids as strings; `""` clears). */
export interface RESTPatchAPISpaceJSONBody {
  /** Name. */
  name?: string;
  /** Description. */
  description?: string;
  /** Join/leave notice room (`""` clears). */
  system_room_id?: Snowflake;
  /** Notice flags. */
  system_room_flags?: number;
  /** 0 all messages, 1 mentions only. */
  default_message_notifications?: 0 | 1;
  /** Inactive voice room. */
  afk_room_id?: Snowflake;
  /** 60, 300, 900, 1800 or 3600 seconds. */
  afk_timeout?: 60 | 300 | 900 | 1800 | 3600;
  /** Space widget on/off. */
  widget_enabled?: boolean;
  /** Space widget room. */
  widget_room_id?: Snowflake;
  /** Birthday notice room (wire name predates our vocabulary). */
  birthday_channel_id?: Snowflake;
  /** Birthday message template. */
  birthday_message?: string;
  /** 0-3. */
  verification_level?: 0 | 1 | 2 | 3;
  /** Automod bits 1, 2, 4. */
  automod_flags?: number;
  /** 0-50. */
  automod_mention_limit?: number;
}

/** `POST /spaces/:id/roles`. */
export interface RESTPostAPISpaceRoleJSONBody {
  /** Name. */
  name: string;
  /** Permission bits as a JSON NUMBER. */
  permissions?: number;
  /** `0xRRGGBB`. */
  color?: number;
  /** List separately. */
  hoist?: boolean;
  /** Anyone may mention it. */
  mentionable?: boolean;
}

/** `PATCH /spaces/:id/roles/:roleId`. */
export interface RESTPatchAPISpaceRoleJSONBody extends Partial<RESTPostAPISpaceRoleJSONBody> {
  /** New position. */
  position?: number;
}

/** `PATCH /spaces/:id/roles` (reorder; 1-250 entries). */
export type RESTPatchAPISpaceRolePositionsJSONBody = { id: Snowflake; position: number }[];

/** `POST /spaces/:id/rooms`. */
export interface RESTPostAPISpaceRoomJSONBody {
  /** Name. */
  name: string;
  /** 3 text, 4 voice, 5 section. */
  type: 3 | 4 | 5;
  /** Section. */
  parent_id?: Snowflake;
  /** Text rooms: end-to-end encrypt (opt-in). */
  e2ee_enabled?: boolean;
  /** Voice: user limit. */
  user_limit?: number;
  /** Voice: bitrate. */
  bitrate?: number;
}

/** `PATCH /spaces/:id/rooms/:roomId` (answers 204; position is not accepted here). */
export interface RESTPatchAPISpaceRoomJSONBody {
  /** Name. */
  name?: string;
  /** Topic (up to 1024). */
  topic?: string;
  /** Slowmode seconds. */
  slowmode_seconds?: number;
  /** End-to-end encryption. */
  e2ee_enabled?: boolean;
  /** Voice: 0-99. */
  user_limit?: number;
  /** Voice: 8000-384000 or 0. */
  bitrate?: number;
  /** Sync with the section's overrides (needs Manage Roles). */
  permissions_synced?: boolean;
}

/** `POST /spaces/:id/rooms/reorder`: a permutation of one group. */
export interface RESTPostAPISpaceRoomsReorderJSONBody {
  /** Reorder sections, or the rooms of one section (wire value predates our vocabulary). */
  scope: 'sections' | 'channels'; // terms-ok: server wire value
  /** The section whose rooms are reordered (null = top level). */
  parent_section_id?: Snowflake | null;
  /** The new order. */
  room_ids: Snowflake[];
}

/** `POST /spaces/:id/rooms/move`. */
export interface RESTPostAPISpaceRoomsMoveJSONBody {
  /** The room to move (wire name predates our vocabulary). */
  channel_id: Snowflake;
  /** Target section (null = top level). */
  parent_section_id?: Snowflake | null;
  /** Place before this room. */
  before_room_id?: Snowflake | null;
}

/** `PUT .../overrides/:roleId` and `.../overrides/users/:userId`. */
export interface RESTPutAPIRoomOverwriteJSONBody {
  /** Bits granted, as a JSON NUMBER. */
  allow: number;
  /** Bits refused, as a JSON NUMBER. */
  deny: number;
}

/** `POST /spaces/:id/invites`. */
export interface RESTPostAPISpaceInviteJSONBody {
  /** 0 (never) to 2592000 seconds. */
  max_age_seconds?: number;
  /** 0 (unlimited) to 1000. */
  max_uses?: number;
}

/** `PATCH /spaces/:id/members/:userId`. */
export interface RESTPatchAPISpaceMemberJSONBody {
  /** Nickname; null or `""` clears. */
  nick?: string | null;
  /** Space about me. */
  about_me?: string | null;
  /** Space bio. */
  bio?: string | null;
  /** Space pronouns. */
  pronouns?: string | null;
  /** Only clearing (`null`/`""`). */
  avatar?: '' | null;
  /** Only clearing (`null`/`""`). */
  banner?: '' | null;
}

/** `PUT /spaces/:id/members/:userId/roles`. */
export interface RESTPutAPISpaceMemberRolesJSONBody {
  /** The full role list (roles at or above your own are kept regardless). */
  role_ids: Snowflake[];
}

/** `PUT /spaces/:id/members/:userId` (add a person with their `spaces.join` token). */
export interface RESTPutAPISpaceMemberJSONBody {
  /** The person's OAuth2 access token with `spaces.join`. */
  access_token: string;
}

/** `POST /spaces/:id/bans/:userId`. */
export interface RESTPostAPISpaceBanJSONBody {
  /** Shown in the ban list and audit log. */
  reason?: string;
}

/** `PATCH /spaces/:id/members/:userId/voice`. */
export interface RESTPatchAPISpaceMemberVoiceJSONBody {
  /** Server mute. */
  mute?: boolean;
  /** Server deafen. */
  deaf?: boolean;
  /** Move to this voice room. */
  room_id?: Snowflake;
}

/** `DELETE /spaces/:id` (owner only): the exact name confirms. */
export interface RESTDeleteAPISpaceJSONBody {
  /** The space's exact name. */
  name: string;
}

/** `POST /spaces/:id/emojis` form fields (with a `file`). */
export interface RESTPostAPISpaceEmojiFormBody {
  /** 2-32 of `A-Z a-z 0-9 _`. */
  name: string;
}

/** `POST /rooms/:id/messages/:msg_id/threads`. */
export interface RESTPostAPIMessageThreadJSONBody {
  /** 1-100 characters. */
  name: string;
  /** 60, 1440, 4320 or 10080 (default 1440). */
  auto_archive_minutes?: 60 | 1440 | 4320 | 10080;
}

/** `POST /rooms/:id/threads`. */
export interface RESTPostAPIThreadJSONBody extends RESTPostAPIMessageThreadJSONBody {
  /** Private thread. */
  private?: boolean;
  /** Members may add others (private threads). */
  invitable?: boolean;
}

/** `PATCH /rooms/:id/thread`. */
export interface RESTPatchAPIThreadJSONBody {
  /** Name. */
  name?: string;
  /** Archive or unarchive. */
  archived?: boolean;
  /** Lock or unlock. */
  locked?: boolean;
  /** Members may add others. */
  invitable?: boolean;
  /** Archive timer. */
  auto_archive_minutes?: 60 | 1440 | 4320 | 10080;
  /** 0-21600. */
  slowmode_seconds?: number;
}

/** `GET /spaces/:id/threads/active`. */
export interface RESTGetAPIActiveThreadsResult {
  /** Active threads you can see. */
  threads: APISpaceRoom[];
}

/** `GET /rooms/:id/threads/archived`. */
export interface RESTGetAPIArchivedThreadsResult {
  /** Archived threads, newest archive first. */
  threads: APISpaceRoom[];
  /** Whether there are more (page with `before` = the last `archived_at`). */
  has_more: boolean;
}

/** Query of `GET /rooms/:id/threads/archived`. */
export interface RESTGetAPIArchivedThreadsQuery {
  /** RFC 3339 archive time to page before. */
  before?: ISO8601Timestamp;
  /** Default 25. */
  limit?: number;
}

/** Query of `GET /spaces/:id/audit-log`. */
export interface RESTGetAPIAuditLogQuery {
  /** Entry id to page before. */
  before?: Snowflake;
  /** 1-100, default 50. */
  limit?: number;
  /** Only this action type. */
  action?: string;
}

/** `GET /rooms/:id/voice/states`. */
export interface RESTGetAPIVoiceStatesResult {
  /** Who is in the room. */
  states: APIVoiceState[];
  /** The PM call, if any. */
  call: APICall | null;
}

/** `PUT /spaces/:id/members/:user_id` result when the person was added. */
export interface RESTPutAPISpaceMemberResult {
  /** The space. */
  space_id: Snowflake;
  /** The person. */
  user_id: Snowflake;
}

/** Presence as accepted in `PATCH /users/@me`. */
export type RESTPresenceInput = Pick<APIPresence, 'status' | 'custom_status'>;

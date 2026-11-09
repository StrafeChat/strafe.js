import type { Snowflake } from '../../util/Snowflake.js';
import type { APIFederationRef, ISO8601Timestamp } from './common.js';
import type { APIParticipant } from './user.js';

/** Room types (`type` on every room). */
export enum RoomType {
  /** A private message between two people (always end-to-end encrypted). */
  PM = 1,
  /** A group private message (end-to-end encrypted unless its creator turned it off). */
  GroupPM = 2,
  /** A space text room. */
  SpaceText = 3,
  /** A space voice room (with its own text chat). */
  SpaceVoice = 4,
  /** A section grouping rooms in a space. */
  SpaceSection = 5,
  /** A thread inside a text room. */
  Thread = 6,
}

/** A role's permission override on a room. */
export interface APIRoleOverwrite {
  /** Role id. */
  role_id: Snowflake;
  /** Bits granted (a JSON number). */
  allow: number;
  /** Bits refused (a JSON number). */
  deny: number;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it last changed. */
  updated_at: ISO8601Timestamp;
}

/** A member's personal permission override on a room. */
export interface APIUserOverwrite {
  /** User id. */
  user_id: Snowflake;
  /** Bits granted. */
  allow: number;
  /** Bits refused. */
  deny: number;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it last changed. */
  updated_at: ISO8601Timestamp;
}

/** Thread state (`thread` on a type-6 room). */
export interface APIThreadMetadata {
  /** Whether the thread is archived. */
  archived: boolean;
  /** Whether only moderators can post or unarchive. */
  locked: boolean;
  /** Whether only members (and Manage Threads holders) can see it. */
  private: boolean;
  /** Whether non-moderators may add people (private threads). */
  invitable: boolean;
  /** Minutes of inactivity before archiving: 60, 1440, 4320 or 10080. */
  auto_archive_minutes: number;
  /** Who started the thread. */
  owner_id: Snowflake;
  /** When it was archived. */
  archived_at: ISO8601Timestamp | null;
  /** Last activity. */
  last_active_at?: ISO8601Timestamp;
  /** The message the thread was started from (thread id equals it). */
  starter_message_id?: Snowflake;
  /** Messages in the thread. */
  message_count?: number;
  /** Members of the thread. */
  member_count?: number;
  /** Whether you joined it. */
  joined?: boolean;
}

/**
 * A space room (text, voice, section or thread) in its full form: READY `space_rooms`,
 * `GET /spaces/:id/rooms`, `SPACE_ROOM_CREATE`.
 */
export interface APISpaceRoom {
  /** Room id. */
  id: Snowflake;
  /** Room type. */
  type: RoomType.SpaceText | RoomType.SpaceVoice | RoomType.SpaceSection | RoomType.Thread;
  /** Name (up to 100 characters). */
  name: string;
  /** Topic (up to 1024 characters). */
  topic: string;
  /** Seconds between messages per person; 0 = off. */
  slowmode_seconds: number;
  /** Position within its group (sections at the top level, rooms within their section). */
  position: number;
  /** Whether the room is end-to-end encrypted (bots cannot read or post there). */
  e2ee_enabled: boolean;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it last changed. */
  updated_at: ISO8601Timestamp;
  /** The space. */
  space_id: Snowflake;
  /** The section (for rooms) or text room (for threads), or null. */
  parent_id: Snowflake | null;
  /** Whether the room uses its section's overrides. */
  permissions_synced: boolean;
  /** Voice: user limit (0 = none). */
  user_limit?: number;
  /** Voice: bitrate in bits per second. */
  bitrate?: number;
  /** Newest message id. */
  last_message_id?: Snowflake;
  /** Your read position. */
  last_read_message_id?: Snowflake;
  /** Your unread mentions. */
  mention_count?: number;
  /** The room's own role overrides (empty when synced). */
  permission_overrides?: APIRoleOverwrite[];
  /** The room's own user overrides. */
  user_overrides?: APIUserOverwrite[];
  /** Set on a mirror of a space hosted elsewhere. */
  federation?: APIFederationRef;
  /** Thread state (type 6 only). */
  thread?: APIThreadMetadata;
  /** Events and thread endpoints repeat the id here. */
  room_id?: Snowflake;
  /** `THREAD_CREATE` broadcasts set this on a brand-new thread. */
  newly_created?: boolean;
}

/**
 * A room in its lighter form: PMs and group PMs (`GET /rooms`, `ROOM_CREATE`), `GET /rooms/:id`
 * for any room, and READY `rooms` (which also lists space rooms; merge those into the space's).
 */
export interface APIPMRoom {
  /** Room id. */
  id: Snowflake;
  /** Room type. */
  type: RoomType;
  /** User ids of the other participants. */
  recipients: Snowflake[];
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** Set for space rooms. */
  space_id?: Snowflake;
  /** Section or parent room. */
  parent_id?: Snowflake;
  /** Group PM or room name. */
  name?: string;
  /** Topic. */
  topic?: string;
  /** Position (omitted when 0). */
  position?: number;
  /** Newest message id. */
  last_message_id?: Snowflake;
  /** Your read position. */
  last_read_message_id?: Snowflake;
  /** Your unread mentions. */
  mention_count?: number;
  /** When it last changed. */
  updated_at?: ISO8601Timestamp;
  /** Who created the group PM. */
  creator_id?: Snowflake;
  /**
   * Whether the room is end-to-end encrypted. Absent means the default: on for PMs and group PMs,
   * off for space rooms.
   */
  e2ee_enabled?: boolean;
  /** The participants. */
  participants?: APIParticipant[];
  /** Set on a mirror of a room hosted elsewhere. */
  federation?: APIFederationRef;
  /** Your mute flag. */
  muted?: boolean;
  /** Your mute expiry. */
  muted_until?: ISO8601Timestamp | null;
  /** Your notification mode (0-3). */
  notify_mode?: number;
}

/** Any room payload. */
export type APIRoom = APISpaceRoom | APIPMRoom;

/** A thread member (`GET /rooms/:id/thread-members`). */
export interface APIThreadMember {
  /** User id. */
  user_id: Snowflake;
  /** When they joined. */
  joined_at: ISO8601Timestamp;
  /** The user, when known. */
  user?: { id: Snowflake; username: string; display_name: string; avatar: string; bot: boolean; public_flags: number };
}

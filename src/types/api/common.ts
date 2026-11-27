import type { Snowflake } from '../../util/Snowflake.js';

/** An RFC 3339 timestamp string as Go writes it (`2026-09-30T03:44:45.361123Z`). The zero time is `0001-01-01T00:00:00Z`. */
export type ISO8601Timestamp = string;

/**
 * A permission value in a write (a role's permissions, a room override's allow or deny): a
 * decimal string is the full value, every bit (`"6442450944"`); a JSON number is the legacy form a
 * client with 32-bit maths sends, of which the server takes bits 0-30 and keeps the stored bits 31
 * and up. strafe.js always writes strings. Reads stay JSON numbers, exact below 2^53.
 */
export type APIPermissionsWrite = string | number;

/** Presence statuses. `invisible` is only ever seen for yourself. */
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

/** A game activity ("Playing X"). */
export interface APIActivity {
  /** Only `playing` exists. */
  type: 'playing';
  /** What is being played (1-128 characters, cleaned by the server). */
  name: string;
  /** Unix milliseconds when it started. */
  started_at?: number;
}

/** A user's presence. */
export interface APIPresence {
  /** Online status. */
  status: PresenceStatus;
  /** Free-text status (up to 128 characters). */
  custom_status?: string;
  /** Current activities. */
  activities?: APIActivity[];
}

/** Marks an object mirrored from the instance that hosts it. */
export interface APIFederationRef {
  /** Domain of the hosting instance. */
  origin_domain: string;
  /** The object's id on that instance. */
  origin_id: Snowflake;
}

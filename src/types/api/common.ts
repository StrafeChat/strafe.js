import type { Snowflake } from '../../util/Snowflake.js';

/** An RFC 3339 timestamp string as Go writes it (`2026-09-30T03:44:45.361123Z`). The zero time is `0001-01-01T00:00:00Z`. */
export type ISO8601Timestamp = string;

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

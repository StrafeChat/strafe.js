import type { Snowflake } from '../../util/Snowflake.js';
import type { ISO8601Timestamp } from './common.js';

/**
 * Someone's state in a voice room. Bots can read these and moderate (mute, deafen, move,
 * disconnect), but cannot join calls: calls are end-to-end encrypted with keys a bot does not have.
 */
export interface APIVoiceState {
  /** User id. */
  user_id: Snowflake;
  /** The voice room (or PM call room). */
  room_id: Snowflake;
  /** The space, for space voice rooms. */
  space_id?: Snowflake;
  /** Connection session. */
  session_id: string;
  /** Media identity. */
  identity?: string;
  /** Muted themselves. */
  self_mute: boolean;
  /** Deafened themselves. */
  self_deaf: boolean;
  /** Server-muted. */
  mute: boolean;
  /** Server-deafened. */
  deaf: boolean;
  /** Camera on. */
  self_video: boolean;
  /** Sharing their screen. */
  self_stream: boolean;
  /** Suppressed. */
  suppress: boolean;
  /** Priority speaker. */
  priority_speaker: boolean;
  /** Whether media is connected. */
  connected: boolean;
  /** When they joined. */
  joined_at: ISO8601Timestamp;
  /** When their media token was issued. */
  token_issued_at: ISO8601Timestamp;
  /** The user. */
  user?: { id: Snowflake; username: string; display_name: string; avatar?: string; home_domain?: string; origin_id?: Snowflake };
  /** `VOICE_STATE_UPDATE` only: they left. */
  left?: true;
  /** `VOICE_STATE_UPDATE` only: they were moved to this room. */
  moved_to?: Snowflake;
}

/** A PM call. */
export interface APICall {
  /** The PM room. */
  room_id: Snowflake;
  /** Who started it. */
  started_by: Snowflake;
  /** When. */
  started_at: ISO8601Timestamp;
  /** User ids still being rung. */
  ringing: Snowflake[];
  /** Set when the call was rung again. */
  rerung?: boolean;
}

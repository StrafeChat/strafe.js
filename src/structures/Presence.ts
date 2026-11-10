import type { Client } from '../client/Client.js';
import type { APIActivity, APIPresence, PresenceStatus } from '../types/api/common.js';
import type { Snowflake } from '../util/Snowflake.js';
import { Base } from './Base.js';
import type { User } from './User.js';

/** The only activity type Strafe has. */
export const ActivityType = {
  /** "Playing X". */
  Playing: 'playing',
} as const;

/** An activity type. */
export type ActivityTypeString = (typeof ActivityType)[keyof typeof ActivityType];

/** A game activity ("Playing X"). */
export class Activity {
  /** Always `playing` on Strafe. */
  public readonly type: ActivityTypeString;
  /** What is being played. */
  public readonly name: string;
  /** When it started (Unix ms), if known. */
  public readonly startedTimestamp: number | null;

  /**
   * @param data - Wire data.
   */
  public constructor(data: APIActivity) {
    this.type = data.type;
    this.name = data.name;
    this.startedTimestamp = data.started_at ?? null;
  }

  /** When it started, if known. */
  public get startedAt(): Date | null {
    return this.startedTimestamp === null ? null : new Date(this.startedTimestamp);
  }

  /** `Playing <name>`. */
  public toString(): string {
    return this.name;
  }

  /** The wire form. */
  public toJSON(): APIActivity {
    const out: APIActivity = { type: this.type, name: this.name };
    if (this.startedTimestamp !== null) out.started_at = this.startedTimestamp;
    return out;
  }
}

/**
 * Someone's presence: status, custom status and activities. Presence on Strafe belongs to the
 * account, not to a space, so `member.presence` and `user.presence` are the same object.
 */
export class Presence extends Base {
  /** The user's id. */
  declare public readonly userId: Snowflake;
  /** `online`, `idle`, `dnd` or `offline` (`invisible` only for yourself). */
  declare public status: PresenceStatus;
  /** Free-text status. */
  declare public customStatus: string | null;
  /** Current activities. */
  declare public activities: Activity[];

  /**
   * @param client - The client.
   * @param userId - Whose presence.
   * @param data - Wire data.
   */
  public constructor(client: Client, userId: Snowflake, data: APIPresence) {
    super(client);
    Object.defineProperty(this, 'userId', { value: userId, enumerable: true });
    this._patch(data);
  }

  /** @internal */
  public _patch(data: APIPresence): void {
    // Presence updates replace the whole presence; they are never partial.
    this.status = data.status;
    this.customStatus = data.custom_status ?? null;
    this.activities = (data.activities ?? []).map((activity) => new Activity(activity));
  }

  /** The user, when cached. */
  public get user(): User | null {
    return this.client.users.cache.get(this.userId) ?? null;
  }

  /**
   * Whether two presences show the same thing.
   *
   * @param other - The other presence.
   */
  public equals(other: Presence | null): boolean {
    return (
      other !== null &&
      this.status === other.status &&
      this.customStatus === other.customStatus &&
      this.activities.length === other.activities.length &&
      this.activities.every((a, i) => a.name === other.activities[i]?.name)
    );
  }
}

import type { Client } from '../client/Client.js';
import type { APIBan } from '../types/api/space.js';
import type { Snowflake } from '../util/Snowflake.js';
import { parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { Space } from './Space.js';
import type { User } from './User.js';

/** A ban in a space. */
export class SpaceBan extends Base {
  /** The space. */
  declare public readonly space: Space;
  /** The banned user. */
  declare public readonly user: User;
  /** The reason given, if any. */
  declare public reason: string | null;
  /** Who banned them. */
  declare public executorId: Snowflake | null;
  /** When (Unix ms). */
  declare public createdTimestamp: number | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIBan, space: Space) {
    super(client);
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    Object.defineProperty(this, 'user', { value: client.users._add({ ...data.user, id: data.user_id }), enumerable: false });
    this.reason = null;
    this.executorId = null;
    this.createdTimestamp = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIBan>): void {
    if (data.reason !== undefined) this.reason = data.reason === '' ? null : data.reason;
    if (data.banned_by !== undefined) this.executorId = data.banned_by;
    if (data.banned_by_user) this.client.users._add(data.banned_by_user);
    if (data.created_at !== undefined) this.createdTimestamp = parseTimestamp(data.created_at);
  }

  /** The banned user's id. */
  public get id(): Snowflake {
    return this.user.id;
  }

  /** Who banned them, when cached. */
  public get executor(): User | null {
    return this.executorId === null ? null : (this.client.users.cache.get(this.executorId) ?? null);
  }

  /** When. */
  public get createdAt(): Date | null {
    return this.createdTimestamp === null ? null : new Date(this.createdTimestamp);
  }

  /** Whether only the user is known. */
  public get partial(): boolean {
    return this.createdTimestamp === null;
  }

  /** Re-fetches the ban. */
  public fetch(): Promise<SpaceBan> {
    return this.space.bans.fetch({ user: this.user, force: true });
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), userId: this.user.id, spaceId: this.space.id };
  }
}

import type { Client } from '../client/Client.js';
import type { APIThreadMember } from '../types/api/room.js';
import type { Snowflake } from '../util/Snowflake.js';
import { parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { ThreadRoom } from './rooms/ThreadRoom.js';
import type { SpaceMember } from './SpaceMember.js';
import type { User } from './User.js';

/** A member of a thread. */
export class ThreadMember extends Base {
  /** The thread. */
  declare public readonly thread: ThreadRoom;
  /** The user id. */
  declare public readonly id: Snowflake;
  /** When they joined (Unix ms). */
  declare public joinedTimestamp: number | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param thread - The thread.
   */
  public constructor(client: Client, data: Partial<APIThreadMember> & { user_id: Snowflake }, thread: ThreadRoom) {
    super(client);
    Object.defineProperty(this, 'thread', { value: thread, enumerable: false });
    Object.defineProperty(this, 'id', { value: data.user_id, enumerable: true });
    this.joinedTimestamp = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIThreadMember>): void {
    if (data.joined_at !== undefined) this.joinedTimestamp = parseTimestamp(data.joined_at);
    if (data.user) this.client.users._add(data.user);
  }

  /** Whether only the id is known. */
  public get partial(): boolean {
    return this.joinedTimestamp === null;
  }

  /** When they joined. */
  public get joinedAt(): Date | null {
    return this.joinedTimestamp === null ? null : new Date(this.joinedTimestamp);
  }

  /** The user, when cached. */
  public get user(): User | null {
    return this.client.users.cache.get(this.id) ?? null;
  }

  /** The space member, when cached. */
  public get spaceMember(): SpaceMember | null {
    return this.thread.space.members.cache.get(this.id) ?? null;
  }

  /** Removes them from the thread. */
  public remove(): Promise<Snowflake> {
    return this.thread.members.remove(this.id);
  }
}

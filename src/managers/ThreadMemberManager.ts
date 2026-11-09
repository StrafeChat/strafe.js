import { Routes } from '../rest/Routes.js';
import type { ThreadRoom } from '../structures/rooms/ThreadRoom.js';
import { ThreadMember } from '../structures/ThreadMember.js';
import type { APIThreadMember } from '../types/api/room.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';
import type { UserResolvable } from './SpaceMemberManager.js';

/** A thread's members. */
export class ThreadMemberManager extends CachedManager<Snowflake, ThreadMember, UserResolvable> {
  /** The thread. */
  declare public readonly thread: ThreadRoom;

  /**
   * @param thread - The thread.
   */
  public constructor(thread: ThreadRoom) {
    super(thread.client, 'ThreadMemberManager');
    Object.defineProperty(this, 'thread', { value: thread, enumerable: false });
  }

  /** @internal */
  public _add(data: Partial<APIThreadMember> & { user_id: Snowflake }, cache = true): ThreadMember {
    return this._upsert(data.user_id, data, cache, () => new ThreadMember(this.client, data, this.thread));
  }

  /** The client's own thread member, when cached. */
  public get me(): ThreadMember | null {
    const id = this.client._userId;
    return id === null ? null : (this.cache.get(id) ?? null);
  }

  /**
   * The id of what names a user.
   *
   * @param resolvable - What to resolve (`'@me'` is the client).
   */
  public override resolveId(resolvable: UserResolvable | ThreadMember): Snowflake | null {
    if (resolvable === '@me') return this.client._userId;
    if (resolvable instanceof ThreadMember) return resolvable.id;
    return this.thread.space.members.resolveId(resolvable);
  }

  /**
   * Fetches the member list, or one member from it.
   *
   * @param member - A user, or nothing for all.
   */
  public fetch(member: UserResolvable): Promise<ThreadMember | null>;
  public fetch(member?: null): Promise<Collection<Snowflake, ThreadMember>>;
  public async fetch(member?: UserResolvable | null): Promise<ThreadMember | null | Collection<Snowflake, ThreadMember>> {
    const data = await this.client.rest.get<APIThreadMember[]>(Routes.threadMembers(this.thread.id));
    this._cache.clear();
    for (const entry of data) this._add(entry);
    if (member !== undefined && member !== null) return this.cache.get(this.resolveId(member) ?? '') ?? null;
    return new Collection(this.cache);
  }

  /**
   * Adds someone to the thread (`'@me'` joins).
   *
   * @param member - A user, or `'@me'` for the client.
   */
  public async add(member: UserResolvable): Promise<Snowflake> {
    const id = member === '@me' ? '@me' : (this.resolveId(member) ?? '');
    await this.client.rest.put(Routes.threadMember(this.thread.id, id));
    if (id === '@me' || id === this.client._userId) this.thread.joined = true;
    return id;
  }

  /**
   * Removes someone from the thread (`'@me'` leaves).
   *
   * @param member - A user, or `'@me'` for the client.
   */
  public async remove(member: UserResolvable): Promise<Snowflake> {
    const id = member === '@me' ? '@me' : (this.resolveId(member) ?? '');
    await this.client.rest.delete(Routes.threadMember(this.thread.id, id));
    const resolved = id === '@me' ? this.client._userId : id;
    if (resolved !== null) this._cache.delete(resolved);
    if (id === '@me' || id === this.client._userId) this.thread.joined = false;
    return id;
  }
}

import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { PMRoom } from '../structures/rooms/PMRoom.js';
import type { ClientUser } from '../structures/ClientUser.js';
import type { APIUserLike } from '../structures/User.js';
import { User } from '../structures/User.js';
import type { APIPMRoom } from '../types/api/room.js';
import type { APISelfUser } from '../types/api/user.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Client } from '../client/Client.js';
import { CachedManager } from './BaseManager.js';
import type { UserResolvable } from './SpaceMemberManager.js';

/** Options of {@link UserManager.fetch}. */
export interface FetchUserOptions {
  /** Skip the cache. */
  force?: boolean;
  /** Cache the result (default true). */
  cache?: boolean;
}

/**
 * Every user the client has seen (discord.js's `UserManager`). Strafe has no endpoint to look a
 * user up by id, so `fetch()` can only refresh the client's own account; other users come with
 * messages, members, reactions and bans.
 */
export class UserManager extends CachedManager<Snowflake, User, UserResolvable> {
  /**
   * @param client - The client.
   */
  public constructor(client: Client) {
    super(client, 'UserManager');
  }

  /** @internal */
  public _add(data: APIUserLike, cache = true): User {
    if (data.id === this.client._userId) {
      this.client.user._patch(data);
      return this.client.user;
    }
    return this._upsert(data.id, data, cache, () => new User(this.client, data));
  }

  /**
   * The id of what names a user.
   *
   * @param resolvable - A user, member, message (its author), thread member or id.
   */
  public override resolveId(resolvable: UserResolvable): Snowflake | null {
    if (typeof resolvable === 'string') return resolvable;
    if ('authorId' in resolvable) return (resolvable).authorId;
    return (resolvable).id;
  }

  /**
   * The cached user for what names one.
   *
   * @param resolvable - A user, member, message, thread member or id.
   */
  public override resolve(resolvable: UserResolvable): User | null {
    const id = this.resolveId(resolvable);
    return id === null ? null : (this.cache.get(id) ?? null);
  }

  /**
   * Returns a user. Only the client's own account can be fetched from the server (with
   * `Routes.user()`); anyone else comes from the cache.
   *
   * @param user - The user.
   * @param options - `force` refreshes the client's own account.
   * @throws {@link StrafeError} `NotFound` for an uncached user other than the client.
   */
  public async fetch(user: UserResolvable, options: FetchUserOptions = {}): Promise<User> {
    const id = this.resolveId(user);
    const me = this.client.user as ClientUser | null;
    if (id === '@me' || (id !== null && id === me?.id)) {
      if (me && options.force !== true) return me;
      const data = await this.client.rest.get<APISelfUser>(Routes.user());
      return this.client._setClientUser(data);
    }
    const cached = id === null ? undefined : this.cache.get(id);
    if (cached) return cached;
    throw new StrafeError(ErrorCodes.NotFound, `User ${id ?? '?'} (Strafe has no user lookup endpoint)`);
  }

  /**
   * Opens (or returns) the PM with a user (`POST /rooms`). 1:1 PMs are always end-to-end encrypted,
   * so the room is useful for knowing it exists, not for posting.
   *
   * @param user - The user.
   * @param options - `force` asks the server even when a PM is cached.
   */
  public async createPM(user: UserResolvable, options: { force?: boolean } = {}): Promise<PMRoom> {
    const id = this.resolveId(user) ?? '';
    if (options.force !== true) {
      const cached = this.cache.get(id)?.pmRoom;
      if (cached) return cached;
    }
    const data = await this.client.rest.post<APIPMRoom>(Routes.rooms(), { body: { recipient_id: id } });
    const room = this.client.rooms._add(data);
    if (!room?.isPM()) throw new StrafeError(ErrorCodes.InvalidType, 'The opened room', 'a PM');
    return room;
  }

  /**
   * Not possible for bots: PMs are always end-to-end encrypted. Rejects with `PMsEncrypted`.
   *
   * @param _user - Ignored.
   * @param _options - Ignored.
   */
  public send(_user: UserResolvable, _options?: unknown): Promise<never> {
    return Promise.reject(new StrafeError(ErrorCodes.PMsEncrypted));
  }
}

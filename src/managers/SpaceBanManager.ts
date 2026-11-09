import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { Space } from '../structures/Space.js';
import { SpaceBan } from '../structures/SpaceBan.js';
import type { APIBan } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';
import type { BanOptions, UserResolvable } from './SpaceMemberManager.js';
import { isFetchOne, isListOptions } from './SpaceMemberManager.js';

/** Options to fetch one ban. */
export interface FetchBanOptions {
  /** The user. */
  user: UserResolvable;
  /** Skip the cache. */
  force?: boolean;
}

/**
 * A space's bans (Ban Members). The list has no paging, and there is no endpoint for one ban, so
 * fetching one fetches the list.
 */
export class SpaceBanManager extends CachedManager<Snowflake, SpaceBan, UserResolvable> {
  /** The space. */
  declare public readonly space: Space;

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client, 'SpaceBanManager');
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** @internal */
  public _add(data: APIBan, cache = true): SpaceBan {
    return this._upsert(data.user_id, data, cache, () => new SpaceBan(this.client, data, this.space));
  }

  /**
   * The id of what names a user.
   *
   * @param resolvable - What to resolve.
   */
  public override resolveId(resolvable: UserResolvable | SpaceBan): Snowflake | null {
    if (resolvable instanceof SpaceBan) return resolvable.user.id;
    return this.space.members.resolveId(resolvable);
  }

  /**
   * Fetches every ban, or one (`fetch(user)` / `fetch({ user, force })`).
   *
   * @param options - A user, options, or nothing for all.
   */
  public fetch(options: UserResolvable | FetchBanOptions): Promise<SpaceBan>;
  public fetch(options?: { cache?: boolean }): Promise<Collection<Snowflake, SpaceBan>>;
  public async fetch(options?: UserResolvable | FetchBanOptions | { cache?: boolean }): Promise<SpaceBan | Collection<Snowflake, SpaceBan>> {
    if (options !== undefined && !isListOptions(options)) {
      const single: FetchBanOptions = isFetchOne<FetchBanOptions>(options) ? options : { user: options };
      const id = this.resolveId(single.user) ?? '';
      if (single.force !== true) {
        const cached = this.cache.get(id);
        if (cached) return cached;
      }
      await this.fetch();
      const ban = this.cache.get(id);
      if (!ban) throw new StrafeError(ErrorCodes.NotFound, `A ban of ${id}`);
      return ban;
    }
    const cache = (options as { cache?: boolean } | undefined)?.cache ?? true;
    const data = await this.client.rest.get<APIBan[]>(Routes.spaceBans(this.space.id));
    if (cache) this._cache.clear();
    const out = new Collection<Snowflake, SpaceBan>();
    for (const ban of data) out.set(ban.user_id, this._add(ban, cache));
    return out;
  }

  /**
   * Bans a user (Ban Members; a member must be below you). No messages are deleted.
   *
   * @param user - The user.
   * @param options - The reason.
   */
  public async create(user: UserResolvable, options: BanOptions = {}): Promise<Snowflake> {
    const id = this.resolveId(user) ?? '';
    await this.client.rest.post(Routes.spaceBan(this.space.id, id), options.reason === undefined ? {} : { body: { reason: options.reason } });
    return id;
  }

  /**
   * Lifts a ban.
   *
   * @param user - The user.
   * @param _reason - Ignored.
   */
  public async remove(user: UserResolvable, _reason?: string): Promise<null> {
    const id = this.resolveId(user) ?? '';
    await this.client.rest.delete(Routes.spaceBan(this.space.id, id));
    this._cache.delete(id);
    return null;
  }
}

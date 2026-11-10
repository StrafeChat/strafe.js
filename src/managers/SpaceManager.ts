import { Routes } from '../rest/Routes.js';
import { Space } from '../structures/Space.js';
import type { RESTPostAPISpaceJSONBody } from '../types/api/rest.js';
import type { APISpace } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Client } from '../client/Client.js';
import { CachedManager } from './BaseManager.js';

/** Options to fetch one space. */
export interface FetchSpaceOptions {
  /** The space. */
  space: Space | Snowflake;
  /** Skip the cache. */
  force?: boolean;
  /** Cache the result (default true). */
  cache?: boolean;
}

/** What {@link SpaceManager.create} takes. */
export interface SpaceCreateOptions {
  /** Name. */
  name: string;
  /** Description. */
  description?: string;
}

/**
 * The spaces the client is in. Filled from READY and kept current by
 * the gateway.
 */
export class SpaceManager extends CachedManager<Snowflake, Space, Space> {
  /**
   * @param client - The client.
   */
  public constructor(client: Client) {
    super(client, 'SpaceManager');
  }

  /** @internal */
  public _add(data: Partial<APISpace> & { id: Snowflake }, cache = true): Space {
    return this._upsert(data.id, data, cache, () => new Space(this.client, data));
  }

  /** Forgets a space and its rooms. @internal */
  public _remove(id: Snowflake): Space | null {
    const space = this._cache.get(id) ?? null;
    if (space) for (const roomId of [...space.rooms.cache.keys()]) this.client.rooms._remove(roomId);
    this._cache.delete(id);
    return space;
  }

  /**
   * Fetches one space (with its roles), or every space the client is in (`fetch()`).
   *
   * @param options - A space, options for one, or nothing for all.
   */
  public fetch(options: Space | Snowflake | FetchSpaceOptions): Promise<Space>;
  public fetch(options?: { cache?: boolean }): Promise<Collection<Snowflake, Space>>;
  public async fetch(options?: Space | Snowflake | FetchSpaceOptions | { cache?: boolean }): Promise<Space | Collection<Snowflake, Space>> {
    if (options === undefined || (typeof options === 'object' && !(options instanceof Space) && !('space' in options))) {
      const cache = (options as { cache?: boolean } | undefined)?.cache ?? true;
      const data = await this.client.rest.get<APISpace[]>(Routes.spaces());
      const out = new Collection<Snowflake, Space>();
      for (const space of data) out.set(space.id, this._add(space, cache));
      return out;
    }
    const one: FetchSpaceOptions = typeof options === 'string' || options instanceof Space ? { space: options } : (options);
    const id = typeof one.space === 'string' ? one.space : one.space.id;
    if (one.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    const data = await this.client.rest.get<APISpace>(Routes.space(id));
    return this._add(data, one.cache ?? true);
  }

  /**
   * Creates a space owned by the client (5 per minute).
   *
   * @param options - Name and description.
   */
  public async create(options: SpaceCreateOptions): Promise<Space> {
    const body: RESTPostAPISpaceJSONBody = { name: options.name };
    if (options.description !== undefined) body.description = options.description;
    const data = await this.client.rest.post<APISpace>(Routes.spaces(), { body });
    return this._add(data);
  }
}

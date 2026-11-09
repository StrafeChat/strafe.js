import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { APIRoomLike } from '../structures/rooms/BaseRoom.js';
import { createRoom } from '../structures/rooms/createRoom.js';
import type { AnyRoom } from '../structures/rooms/index.js';
import type { Space } from '../structures/Space.js';
import type { APIPMRoom } from '../types/api/room.js';
import { RoomType } from '../types/api/room.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Client } from '../client/Client.js';
import { CachedManager } from './BaseManager.js';

/** Options of {@link RoomManager.fetch}. */
export interface FetchRoomOptions {
  /** Skip the cache. */
  force?: boolean;
  /** Cache the result (default true). */
  cache?: boolean;
}

/**
 * Every room the client knows: space rooms, threads, PMs and group
 * PMs. Space rooms are also in their space's `space.rooms.cache` (the same objects).
 */
export class RoomManager extends CachedManager<Snowflake, AnyRoom, AnyRoom> {
  /**
   * @param client - The client.
   */
  public constructor(client: Client) {
    super(client, 'RoomManager');
  }

  /**
   * Adds or patches a room. Space rooms need their space (from `space` or `space_id`); a space
   * room whose space is unknown is skipped (`null`). READY's light room entries patch the full
   * room already cached instead of replacing it.
   *
   * @internal
   */
  public _add(data: APIRoomLike, space?: Space | null, cache = true): AnyRoom | null {
    const id = data.room_id ?? data.id;
    const existing = this._cache.get(id);
    if (existing) {
      existing._patch(data);
      return existing;
    }
    const spaceId = data.space_id;
    const owner = space ?? (spaceId === undefined || spaceId === '' ? null : (this.client.spaces.cache.get(spaceId) ?? null));
    const type = data.type ?? (owner ? RoomType.SpaceText : null);
    if (type === null) return null;
    const room = createRoom(this.client, { ...data, id, type }, owner);
    if (!room) return null;
    if (cache) {
      this._cache.set(id, room);
      if (owner && !room.isPMBased()) owner.rooms._cache.set(id, room);
    }
    return room;
  }

  /** Forgets a room (and its threads). @internal */
  public _remove(id: Snowflake): AnyRoom | null {
    const room = this._cache.get(id) ?? null;
    this._cache.delete(id);
    if (room && !room.isPMBased()) {
      room.space.rooms._cache.delete(id);
      for (const other of [...room.space.rooms._cache.values()]) {
        if (other.isThread() && other.parentId === id) this._remove(other.id);
      }
    }
    return room;
  }

  /**
   * Fetches a room by id (`GET /rooms/:id`). For a space room this light form has no permission
   * overrides; `space.rooms.fetch()` brings the full list with them.
   *
   * @param id - The room id.
   * @param options - Cache options.
   */
  public async fetch(id: Snowflake, options: FetchRoomOptions = {}): Promise<AnyRoom> {
    if (options.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    const data = await this.client.rest.get<APIPMRoom>(Routes.room(id));
    let space: Space | null = null;
    if (data.space_id !== undefined && data.space_id !== '') {
      space = this.client.spaces.cache.get(data.space_id) ?? (await this.client.spaces.fetch(data.space_id));
    }
    const room = this._add(data, space, options.cache ?? true);
    if (!room) throw new StrafeError(ErrorCodes.NotFound, `Room ${id}`);
    return room;
  }
}

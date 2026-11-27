import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import { Bridge } from '../structures/Bridge.js';
import type { TextRoom } from '../structures/rooms/TextRoom.js';
import type { APIBridge, APIBridgeSummary } from '../types/api/bridge.js';
import type { Snowflake } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';

/**
 * The bridges the client's bot drives (`client.bridges`), from READY and kept current by the
 * `BRIDGE_*` events. Their feed arrives on the bot's own connection. Bridges other bots drive are
 * in their room's `room.bridges`, not here.
 */
export class BridgeManager extends CachedManager<Snowflake, Bridge, Bridge> {
  /** Bridges deleted through the library, kept until their `BRIDGE_DELETE` arrives. @internal */
  private readonly tombstones = new Map<Snowflake, Bridge>();

  /**
   * @param client - The client.
   */
  public constructor(client: Client) {
    super(client, 'BridgeManager');
  }

  /**
   * Caches bridge data: patches the known bridge, keeps it here when the client's bot drives it,
   * and in its room's `bridges`.
   *
   * @internal
   */
  public _add(data: APIBridgeSummary | APIBridge | (Partial<APIBridge> & { id: Snowflake }), room?: TextRoom | null): Bridge {
    const target = room ?? this.roomOf(data.room_id);
    const existing = this._cache.get(data.id) ?? target?.bridges.get(data.id);
    let bridge: Bridge;
    if (existing) {
      existing._patch(data);
      bridge = existing;
    } else {
      bridge = new Bridge(this.client, data);
    }
    if (bridge.driven) this._cache.set(bridge.id, bridge);
    target?.bridges.set(bridge.id, bridge);
    return bridge;
  }

  /**
   * Forgets a bridge.
   *
   * @internal
   */
  public _remove(id: Snowflake, roomId?: Snowflake): Bridge | null {
    const cached = this._cache.get(id);
    const room = this.roomOf(roomId ?? cached?.roomId);
    const inRoom = room?.bridges.get(id);
    this._cache.delete(id);
    room?.bridges.delete(id);
    return cached ?? inRoom ?? null;
  }

  /**
   * Forgets a bridge deleted through the library, holding it until its `BRIDGE_DELETE` arrives so
   * `bridgeDelete` is still emitted.
   *
   * @internal
   */
  public _delete(id: Snowflake, roomId: Snowflake): void {
    const removed = this._remove(id, roomId);
    if (!removed) return;
    this.tombstones.set(id, removed);
    if (this.tombstones.size > 100) {
      const oldest = this.tombstones.keys().next().value;
      if (oldest !== undefined) this.tombstones.delete(oldest);
    }
  }

  /**
   * The bridge `_delete()` held, once.
   *
   * @internal
   */
  public _takeTombstone(id: Snowflake): Bridge | null {
    const bridge = this.tombstones.get(id) ?? null;
    this.tombstones.delete(id);
    return bridge;
  }

  /**
   * Replaces the cache with READY's list.
   *
   * @internal
   */
  public _setFrom(list: readonly APIBridge[]): void {
    const keep = new Set(list.map((data) => data.id));
    for (const id of [...this._cache.keys()]) if (!keep.has(id)) this._remove(id);
    for (const data of list) this._add(data);
  }

  /**
   * Fetches a bridge (Manage Webhooks in its room, or its bot).
   *
   * @param id - The bridge id.
   * @param options - `force` skips the cache.
   */
  public async fetch(id: Snowflake, options: { force?: boolean | undefined } = {}): Promise<Bridge> {
    const cached = this._cache.get(id);
    if (cached && !cached.partial && options.force !== true) return cached;
    return this._add(await this.client.rest.get<APIBridge>(Routes.bridge(id)));
  }

  private roomOf(roomId: Snowflake | undefined): TextRoom | null {
    if (roomId === undefined) return null;
    const room = this.client.rooms.cache.get(roomId);
    return room?.isTextRoom() ? room : null;
  }
}

import type { Client } from '../client/Client.js';
import { Collection } from '../util/Collection.js';
import type { CacheManagerName } from '../util/Options.js';
import type { Snowflake } from '../util/Snowflake.js';

/** The base of every manager: it knows its {@link Client}. */
export abstract class BaseManager {
  /** The client. */
  declare public readonly client: Client<true>;

  /**
   * @param client - The client.
   */
  public constructor(client: Client) {
    Object.defineProperty(this, 'client', { value: client, enumerable: false, writable: false });
  }
}

/**
 * A manager over a collection of structures: `cache`, `resolve` and `resolveId`.
 *
 * @typeParam Holds - The structure held.
 * @typeParam R - What `resolve` accepts besides an id or a `Holds`.
 */
export abstract class DataManager<K extends Snowflake, Holds extends { id: K }, R = never> extends BaseManager {
  /** The cached structures, by id. */
  public abstract get cache(): Collection<K, Holds>;

  /**
   * The cached structure for an id or structure, or `null`.
   *
   * @param resolvable - An id or the structure.
   */
  public resolve(resolvable: Holds | K | R): Holds | null {
    if (typeof resolvable === 'string') return this.cache.get(resolvable as K) ?? null;
    const id = this.resolveId(resolvable);
    return id === null ? null : (this.cache.get(id) ?? null);
  }

  /**
   * The id of an id or structure (no cache needed), or `null`.
   *
   * @param resolvable - An id or the structure.
   */
  public resolveId(resolvable: Holds | K | R): K | null {
    if (typeof resolvable === 'string') return resolvable as K;
    if (typeof resolvable === 'object' && resolvable !== null && 'id' in resolvable) return (resolvable as { id: K }).id;
    return null;
  }

  /** The cached ids. */
  public toJSON(): K[] {
    return [...this.cache.keys()];
  }

  /** The cache itself, like discord.js. */
  public override valueOf(): Collection<K, Holds> {
    return this.cache;
  }
}

/**
 * A {@link DataManager} that owns its cache (limited by the client's `makeCache` option) and adds or
 * patches structures as data arrives.
 */
export abstract class CachedManager<K extends Snowflake, Holds extends { id: K; _patch(data: never): void }, R = never> extends DataManager<
  K,
  Holds,
  R
> {
  /** @internal */
  public readonly _cache: Collection<K, Holds>;

  /**
   * @param client - The client.
   * @param cacheName - The name `makeCache` sees.
   */
  protected constructor(client: Client, cacheName: CacheManagerName) {
    super(client);
    this._cache = client.options.makeCache(cacheName) as unknown as Collection<K, Holds>;
  }

  /** The cached structures, by id. */
  public get cache(): Collection<K, Holds> {
    return this._cache;
  }

  /**
   * Upserts: patches the cached structure with `data`, or builds a new one with `create` and caches
   * it when `cache` is true.
   *
   * @internal
   */
  protected _upsert(id: K, data: unknown, cache: boolean, create: () => Holds): Holds {
    const existing = this._cache.get(id);
    if (existing) {
      existing._patch(data as never);
      return existing;
    }
    const created = create();
    if (cache) this._cache.set(id, created);
    return created;
  }
}

/** Builds an empty plain collection (for computed caches). @internal */
export function emptyCollection<K, V>(): Collection<K, V> {
  return new Collection<K, V>();
}

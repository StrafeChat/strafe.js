import { Collection } from './Collection.js';

/** Options for a {@link LimitedCollection}. */
export interface LimitedCollectionOptions<K, V> {
  /** The most entries kept. `Infinity` (the default) keeps everything; 0 keeps nothing. */
  maxSize?: number;
  /** Entries this returns true for are never evicted (and may push the size past `maxSize`). */
  keepOverLimit?: ((value: V, key: K, collection: LimitedCollection<K, V>) => boolean) | null;
}

/**
 * A {@link Collection} with a size limit: adding an entry to a full collection drops the oldest one
 * (the first inserted) that `keepOverLimit` does not protect. Used for caches that would otherwise
 * grow forever, such as each room's messages.
 *
 * @example
 * ```ts
 * const recent = new LimitedCollection<string, Message>({ maxSize: 50 });
 * ```
 */
export class LimitedCollection<K, V> extends Collection<K, V> {
  /** The most entries kept. */
  public maxSize: number;
  /** Entries this returns true for are never evicted. */
  public keepOverLimit: ((value: V, key: K, collection: LimitedCollection<K, V>) => boolean) | null;

  /**
   * @param options - Size limit and the keep predicate.
   * @param iterable - Initial entries (the limit applies to them too).
   */
  public constructor(options: LimitedCollectionOptions<K, V> = {}, iterable?: Iterable<readonly [K, V]> | null) {
    super();
    this.maxSize = options.maxSize ?? Infinity;
    this.keepOverLimit = options.keepOverLimit ?? null;
    if (iterable) for (const [key, value] of iterable) this.set(key, value);
  }

  /**
   * Adds or replaces an entry, evicting the oldest unprotected entry when the collection is full.
   *
   * @param key - The key.
   * @param value - The value.
   */
  public override set(key: K, value: V): this {
    // `Map`'s constructor calls `set` before our fields exist.
    if ((this.maxSize as number | undefined) === undefined) return super.set(key, value);
    if (this.maxSize === 0 && !this.keepOverLimit?.(value, key, this)) return this;
    if (this.size >= this.maxSize && !this.has(key)) {
      for (const [k, v] of this) {
        if (this.keepOverLimit?.(v, k, this)) continue;
        this.delete(k);
        break;
      }
    }
    return super.set(key, value);
  }
}

/** Names of the managers whose caches {@link Options.cacheWithLimits} can limit. */
export type CacheManagerName =
  | 'SpaceManager'
  | 'RoomManager'
  | 'UserManager'
  | 'SpaceRoomManager'
  | 'SpaceMemberManager'
  | 'RoleManager'
  | 'SpaceBanManager'
  | 'SpaceInviteManager'
  | 'SpaceEmojiManager'
  | 'MessageManager'
  | 'ReactionManager'
  | 'ReactionUserManager'
  | 'PermissionOverwriteManager'
  | 'ThreadMemberManager'
  | 'VoiceStateManager';

/**
 * Makes the cache collection of a manager. The default ({@link Options.DefaultMakeCacheSettings})
 * keeps the 200 newest messages per room and everything else.
 *
 * @param manager - The manager's name.
 */
export type CacheFactory = (manager: CacheManagerName) => Collection<string, unknown>;

/** Per-manager limits for {@link Options.cacheWithLimits}: a size, or full {@link LimitedCollectionOptions}. */
export type CacheWithLimitsOptions = Partial<Record<CacheManagerName, number | LimitedCollectionOptions<string, unknown>>>;

/**
 * Helpers for client options.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `Options`.
 *
 * @example
 * ```ts
 * const client = new Client({
 *   instance: 'app.strafe.chat',
 *   makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, ReactionManager: 0 }),
 * });
 * ```
 */
export class Options {
  private constructor() {
    // static only
  }

  /** The default cache limits: the 200 newest messages per room, everything else unlimited. */
  public static readonly DefaultMakeCacheSettings: Readonly<CacheWithLimitsOptions> = Object.freeze({ MessageManager: 200 });

  /**
   * A cache factory with a size limit per manager. Managers that are not named keep everything.
   *
   * @param settings - Limits by manager name.
   */
  public static cacheWithLimits(settings: CacheWithLimitsOptions = {}): CacheFactory {
    return (manager) => {
      const setting = settings[manager];
      if (setting === undefined) return new Collection<string, unknown>();
      if (typeof setting === 'number') {
        return setting === Infinity ? new Collection<string, unknown>() : new LimitedCollection<string, unknown>({ maxSize: setting });
      }
      return setting.maxSize === undefined || setting.maxSize === Infinity
        ? new Collection<string, unknown>()
        : new LimitedCollection<string, unknown>(setting);
    };
  }

  /** A cache factory that keeps everything (no limits at all, messages included). */
  public static cacheEverything(): CacheFactory {
    return () => new Collection<string, unknown>();
  }
}

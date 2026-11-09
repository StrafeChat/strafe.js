import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import { SpaceEmoji } from '../structures/Emoji.js';
import type { Space } from '../structures/Space.js';
import type { APIEmoji } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import { resolveFile } from '../util/DataResolver.js';
import type { Snowflake } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';

/** What {@link SpaceEmojiManager.create} takes. */
export interface SpaceEmojiCreateOptions {
  /** The image (png, jpg, gif or webp; at most 512 KB by default). */
  attachment: BufferResolvable;
  /** Name: 2-32 characters of `A-Za-z0-9_`. */
  name: string;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** A space's custom emojis (at most 50). Changes need Manage Emojis. Emojis are not in READY: call `fetch()`. */
export class SpaceEmojiManager extends CachedManager<Snowflake, SpaceEmoji, SpaceEmoji> {
  /** The space. */
  declare public readonly space: Space;

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client, 'SpaceEmojiManager');
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** @internal */
  public _add(data: APIEmoji, cache = true): SpaceEmoji {
    return this._upsert(data.id, data, cache, () => new SpaceEmoji(this.client, data, this.space));
  }

  /**
   * Fetches every emoji of the space, or one.
   *
   * @param id - An emoji id, or nothing for all.
   * @param options - `force` skips the cache.
   */
  public fetch(id: Snowflake, options?: { force?: boolean }): Promise<SpaceEmoji>;
  public fetch(id?: null, options?: { force?: boolean }): Promise<Collection<Snowflake, SpaceEmoji>>;
  public async fetch(id?: Snowflake | null, options: { force?: boolean } = {}): Promise<SpaceEmoji | Collection<Snowflake, SpaceEmoji>> {
    if (id !== undefined && id !== null && options.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    const data = await this.client.rest.get<APIEmoji[]>(Routes.spaceEmojis(this.space.id));
    const ids = new Set(data.map((emoji) => emoji.id));
    for (const key of [...this._cache.keys()]) if (!ids.has(key)) this._cache.delete(key);
    for (const emoji of data) this._add(emoji);
    if (id !== undefined && id !== null) {
      const emoji = this.cache.get(id);
      if (!emoji) throw new StrafeError(ErrorCodes.NotFound, `Emoji ${id}`);
      return emoji;
    }
    return new Collection(this.cache);
  }

  /**
   * Uploads a custom emoji.
   *
   * @param options - The image and name.
   */
  public async create(options: SpaceEmojiCreateOptions): Promise<SpaceEmoji> {
    const file = await resolveFile(options.attachment, undefined, this.client.rest.options.makeRequest);
    const data = await this.client.rest.post<APIEmoji>(Routes.spaceEmojis(this.space.id), {
      files: [{ name: file.name, data: file.data, key: 'file', ...(file.contentType === undefined ? {} : { contentType: file.contentType }) }],
      body: { name: options.name },
    });
    return this._add(data);
  }

  /**
   * Renames an emoji.
   *
   * @param emoji - The emoji or id.
   * @param options - The new name.
   */
  public async edit(emoji: SpaceEmoji | Snowflake, options: { name: string; reason?: string }): Promise<SpaceEmoji> {
    const id = this.resolveId(emoji) ?? '';
    const data = await this.client.rest.patch<APIEmoji>(Routes.spaceEmoji(this.space.id, id), { body: { name: options.name } });
    return this._add(data);
  }

  /**
   * Deletes an emoji.
   *
   * @param emoji - The emoji or id.
   * @param _reason - Ignored.
   */
  public async delete(emoji: SpaceEmoji | Snowflake, _reason?: string): Promise<void> {
    const id = this.resolveId(emoji) ?? '';
    await this.client.rest.delete(Routes.spaceEmoji(this.space.id, id));
    this._cache.delete(id);
  }
}

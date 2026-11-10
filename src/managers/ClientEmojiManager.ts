import { Routes } from '../rest/Routes.js';
import { Emoji } from '../structures/Emoji.js';
import type { SpaceEmoji } from '../structures/Emoji.js';
import type { APIEmoji } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { DataManager } from './BaseManager.js';

/**
 * The custom emojis of every space the client is in (computed from each space's emoji cache, which
 * fills when `space.emojis.fetch()` runs or emoji events arrive).
 */
export class ClientEmojiManager extends DataManager<Snowflake, SpaceEmoji, SpaceEmoji> {
  /** Every cached custom emoji. */
  public get cache(): Collection<Snowflake, SpaceEmoji> {
    const out = new Collection<Snowflake, SpaceEmoji>();
    for (const space of this.client.spaces.cache.values()) {
      for (const [id, emoji] of space.emojis.cache) out.set(id, emoji);
    }
    return out;
  }

  /**
   * Fetches any custom emoji by id (`GET /emojis/:id`), even from a space the client is not in.
   * Returns a {@link SpaceEmoji} when its space is cached, else a plain {@link Emoji}.
   *
   * @param id - The emoji id.
   * @param options - `force` skips the cache.
   */
  public async fetch(id: Snowflake, options: { force?: boolean } = {}): Promise<SpaceEmoji | Emoji> {
    if (options.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    const data = await this.client.rest.get<APIEmoji>(Routes.emoji(id));
    const space = this.client.spaces.cache.get(data.space_id);
    if (space) return space.emojis._add(data);
    return new Emoji(this.client, { id: data.id, name: data.name, animated: data.animated, url: data.url });
  }

  /** Fetches the emojis of every space the client is in (`GET /emojis`) and caches them. */
  public async fetchAll(): Promise<Collection<Snowflake, SpaceEmoji>> {
    const data = await this.client.rest.get<APIEmoji[]>(Routes.emojis());
    for (const emoji of data) this.client.spaces.cache.get(emoji.space_id)?.emojis._add(emoji);
    return this.cache;
  }
}

import type { Client } from '../client/Client.js';
import type { APIEmoji } from '../types/api/space.js';
import { formatEmoji } from '../util/Formatters.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { Base } from './Base.js';
import type { Space } from './Space.js';

/**
 * An emoji: a unicode emoji (`id === null`, `name` is the character) or a space's custom emoji.
 * In message text a custom emoji is written `<:name:id>`; as a reaction it is `custom:<id>`.
 */
export class Emoji extends Base {
  /** The custom emoji's id, or `null` for a unicode emoji. */
  declare public id: Snowflake | null;
  /** The name (the character itself for a unicode emoji; `null` when unknown). */
  declare public name: string | null;
  /** Whether a custom emoji is animated. */
  declare public animated: boolean;
  /** @internal */
  declare public _url: string | null;

  /**
   * @param client - The client.
   * @param data - Id, name, animated, url.
   */
  public constructor(client: Client, data: { id: Snowflake | null; name: string | null; animated?: boolean; url?: string }) {
    super(client);
    this.id = data.id;
    this.name = data.name;
    this.animated = data.animated ?? false;
    this._url = data.url ?? null;
  }

  /** @internal */
  public _patch(data: Partial<APIEmoji>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.animated !== undefined) this.animated = data.animated;
    if (data.url !== undefined) this._url = data.url;
  }

  /** The image URL of a custom emoji (`null` for unicode, or when not known). */
  public get imageURL(): string | null {
    return this._url;
  }

  /** The reaction route form: the unicode character, or `custom:<id>`. */
  public get identifier(): string {
    return this.id === null ? (this.name ?? '') : `custom:${this.id}`;
  }

  /** When a custom emoji was created (`null` for unicode). */
  public get createdTimestamp(): number | null {
    return this.id === null ? null : SnowflakeUtil.timestampFrom(this.id);
  }

  /** When a custom emoji was created. */
  public get createdAt(): Date | null {
    const time = this.createdTimestamp;
    return time === null ? null : new Date(time);
  }

  /** The text form: the character, or `<:name:id>` / `<a:name:id>`. */
  public override toString(): string {
    if (this.id === null) return this.name ?? '';
    return formatEmoji({ id: this.id, name: this.name ?? '_', animated: this.animated });
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { id: this.id, name: this.name, animated: this.animated, imageURL: this.imageURL };
  }
}

/** A space's custom emoji (names are 2-32 `[A-Za-z0-9_]` characters; 50 per space). */
export class SpaceEmoji extends Emoji {
  /** The id. */
  declare public id: Snowflake;
  /** The name. */
  declare public name: string;
  /** The space. */
  declare public readonly space: Space;
  /** Who uploaded it. */
  declare public creatorId: Snowflake | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIEmoji, space: Space) {
    super(client, { id: data.id, name: data.name, animated: data.animated, url: data.url });
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    this.creatorId = null;
    this._patch(data);
  }

  /** @internal */
  public override _patch(data: Partial<APIEmoji>): void {
    super._patch(data);
    if (data.creator_id !== undefined) this.creatorId = data.creator_id;
  }

  /** The space id. */
  public get spaceId(): Snowflake {
    return this.space.id;
  }

  /** The image URL. */
  public get url(): string {
    return this._url ?? '';
  }

  /**
   * Renames the emoji (Manage Emojis).
   *
   * @param options - The new name.
   */
  public edit(options: { name: string }): Promise<SpaceEmoji> {
    return this.space.emojis.edit(this, options);
  }

  /**
   * Renames the emoji.
   *
   * @param name - The new name.
   */
  public setName(name: string): Promise<SpaceEmoji> {
    return this.edit({ name });
  }

  /** Deletes the emoji (Manage Emojis). */
  public delete(): Promise<void> {
    return this.space.emojis.delete(this);
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), spaceId: this.spaceId, creatorId: this.creatorId };
  }
}

/**
 * The emoji of a reaction. Reaction events name a custom emoji only by id (`custom:<id>`); the
 * name and image are filled in from the cache when the emoji is known.
 */
export class ReactionEmoji extends Emoji {
  /**
   * @param client - The client.
   * @param identifier - `👋` or `custom:<id>`.
   */
  public constructor(client: Client, identifier: string) {
    const custom = /^custom:(\d+)$/.exec(identifier);
    if (custom) {
      const id = custom[1] ?? '';
      const known = client.emojis.cache.get(id);
      super(client, { id, name: known?.name ?? null, animated: known?.animated ?? false, ...(known ? { url: known.url } : {}) });
    } else {
      super(client, { id: null, name: identifier });
    }
  }
}

/** Something that names an emoji for a reaction: an {@link Emoji}, `👋`, `<:name:id>`, `name:id` or an id. */
export type EmojiIdentifierResolvable = Emoji | string;

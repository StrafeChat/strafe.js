import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { EmojiIdentifierResolvable } from '../structures/Emoji.js';
import { Emoji } from '../structures/Emoji.js';
import { Message } from '../structures/Message.js';
import type { MessageEditOptions, MessageResolvable } from '../structures/MessagePayload.js';
import { resolveMessageEdit } from '../structures/MessagePayload.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { TextBasedRoom } from '../structures/rooms/index.js';
import type { User } from '../structures/User.js';
import type { APIMessage } from '../types/api/message.js';
import type { RESTGetAPIRoomMessagesQuery, RESTGetAPIRoomPinsResult, RESTGetAPIRoomSearchResult, RESTReactionsResult } from '../types/api/rest.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';

/** Options to fetch one message. */
export interface FetchMessageOptions {
  /** The message. */
  message: MessageResolvable;
  /** Skip the cache. */
  force?: boolean;
  /** Cache the result (default true). */
  cache?: boolean;
}

/** Options to fetch a page of messages. Give at most one of `before`, `after`, `around`. */
export interface FetchMessagesOptions {
  /** How many (1-100, default 50). */
  limit?: number | undefined;
  /** Messages before this one (`undefined` is ignored, so `before: page.lastKey()` works). */
  before?: Snowflake | undefined;
  /** Messages after this one. */
  after?: Snowflake | undefined;
  /** Messages around this one. */
  around?: Snowflake | undefined;
  /** Cache the results (default true). */
  cache?: boolean | undefined;
}

/** Options of {@link MessageManager.search}. */
export interface MessageSearchOptions {
  /** Text to look for. */
  query?: string;
  /** Only messages by this user. */
  author?: User | Snowflake;
  /** Only messages mentioning this user. */
  mentions?: User | Snowflake;
  /** Only messages with a link or file of this kind. */
  has?: 'link' | 'file' | 'image' | 'video' | 'audio';
  /** Only messages before this one (paging). */
  before?: Snowflake;
  /** How many. */
  limit?: number;
}

/** A page of search results. */
export interface MessageSearchResult<InSpace extends boolean> {
  /** Whether the room can be searched at all (end-to-end encrypted rooms cannot). */
  searchable: boolean;
  /** The messages. */
  messages: Collection<Snowflake, Message<InSpace>>;
  /** Pass as `before` for the next page. */
  nextBeforeId: Snowflake | null;
}

function newestFirst<InSpace extends boolean>(messages: Message<InSpace>[]): Collection<Snowflake, Message<InSpace>> {
  messages.sort((a, b) => SnowflakeUtil.compare(b.id, a.id));
  return new Collection(messages.map((message) => [message.id, message] as const));
}

/**
 * A room's messages (discord.js's `MessageManager`). The cache keeps the newest 200 per room by
 * default (`makeCache` changes it).
 */
export class MessageManager<InSpace extends boolean = boolean> extends CachedManager<Snowflake, Message<InSpace>, Message<InSpace>> {
  /** The room. */
  declare public readonly room: TextBasedRoom;

  /**
   * @param room - The room.
   */
  public constructor(room: TextBasedRoom) {
    super(room.client, 'MessageManager');
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
  }

  /** @internal */
  public _add(data: Partial<APIMessage> & { id: Snowflake }, cache = true): Message<InSpace> {
    return this._upsert(data.id, data, cache, () => new Message<InSpace>(this.client, data, this.room));
  }

  /**
   * Fetches one message (`fetch(id)`, or `fetch({ message, force })`), or a page of messages
   * (`limit` plus one of `before`, `after` or `around`). Pages come back newest first, whatever the cursor.
   *
   * @param options - A message, or paging options.
   * @example
   * ```ts
   * const last50 = await room.messages.fetch();
   * const older = await room.messages.fetch({ before: last50.lastKey(), limit: 100 });
   * const one = await room.messages.fetch('2102226824774811648');
   * ```
   */
  public fetch(options: MessageResolvable | FetchMessageOptions): Promise<Message<InSpace>>;
  public fetch(options?: FetchMessagesOptions): Promise<Collection<Snowflake, Message<InSpace>>>;
  public async fetch(options?: MessageResolvable | FetchMessageOptions | FetchMessagesOptions): Promise<Message<InSpace> | Collection<Snowflake, Message<InSpace>>> {
    if (typeof options === 'string' || options instanceof Message || (typeof options === 'object' && 'message' in options)) {
      const one: FetchMessageOptions = typeof options === 'string' || options instanceof Message ? { message: options } : options;
      const id = typeof one.message === 'string' ? one.message : one.message.id;
      if (one.force !== true) {
        const cached = this.cache.get(id);
        if (cached && !cached.partial) return cached;
      }
      const data = await this.client.rest.get<APIMessage>(Routes.roomMessage(this.room.id, id));
      return this._add(data, one.cache ?? true);
    }
    const page = options ?? {};
    const query: RESTGetAPIRoomMessagesQuery = {};
    if (page.limit !== undefined) query.limit = page.limit;
    if (page.before !== undefined) query.before = page.before;
    else if (page.after !== undefined) query.after = page.after;
    else if (page.around !== undefined) query.around = page.around;
    const data = await this.client.rest.get<APIMessage[]>(Routes.roomMessages(this.room.id), { query: { ...query } });
    return newestFirst(data.map((message) => this._add(message, page.cache ?? true)));
  }

  /** Fetches the pinned messages, newest pin first (at most 50 per room). */
  public async fetchPins(): Promise<Collection<Snowflake, Message<InSpace>>> {
    const data = await this.client.rest.get<RESTGetAPIRoomPinsResult>(Routes.roomPins(this.room.id));
    const out = new Collection<Snowflake, Message<InSpace>>();
    for (const item of data.items) {
      const message = this._add({ ...item.message, pinned: true, pinned_at: item.pinned_at, pinned_by: item.pinned_by });
      out.set(message.id, message);
    }
    return out;
  }

  /**
   * Searches the room's messages. End-to-end encrypted rooms answer `searchable: false`.
   *
   * @param options - Text and filters.
   */
  public async search(options: MessageSearchOptions = {}): Promise<MessageSearchResult<InSpace>> {
    const query: Record<string, string | number> = {};
    if (options.query !== undefined) query.q = options.query;
    if (options.author !== undefined) query.from = typeof options.author === 'string' ? options.author : options.author.id;
    if (options.mentions !== undefined) query.mentions = typeof options.mentions === 'string' ? options.mentions : options.mentions.id;
    if (options.has !== undefined) query.has = options.has;
    if (options.before !== undefined) query.before = options.before;
    if (options.limit !== undefined) query.limit = options.limit;
    const data = await this.client.rest.get<RESTGetAPIRoomSearchResult>(Routes.roomMessageSearch(this.room.id), { query });
    return {
      searchable: data.searchable,
      messages: newestFirst(data.messages.map((message) => this._add(message, false))),
      nextBeforeId: data.next_before_id ?? null,
    };
  }

  /**
   * Edits a message (your own; text and embeds only).
   *
   * @param message - The message or id.
   * @param options - Text or {@link MessageEditOptions}.
   */
  public async edit(message: MessageResolvable, options: string | MessageEditOptions): Promise<Message<InSpace>> {
    if (this.room.isEncrypted()) throw new StrafeError(this.room.isPM() ? ErrorCodes.PMsEncrypted : ErrorCodes.RoomEncrypted);
    const id = typeof message === 'string' ? message : message.id;
    const body = resolveMessageEdit(this.client, options);
    const data = await this.client.rest.patch<APIMessage>(Routes.roomMessage(this.room.id, id), { body });
    return this._add(data);
  }

  /**
   * Deletes a message: your own, or others' with Manage Messages in a space text room or thread.
   *
   * @param message - The message or id.
   */
  public async delete(message: MessageResolvable): Promise<void> {
    const id = typeof message === 'string' ? message : message.id;
    await this.client.rest.delete(Routes.roomMessage(this.room.id, id));
    this._cache.delete(id);
  }

  /**
   * Pins a message.
   *
   * @param message - The message or id.
   * @param _reason - Ignored.
   */
  public async pin(message: MessageResolvable, _reason?: string): Promise<void> {
    await this.client.rest.put(Routes.roomMessagePin(this.room.id, typeof message === 'string' ? message : message.id));
  }

  /**
   * Unpins a message.
   *
   * @param message - The message or id.
   * @param _reason - Ignored.
   */
  public async unpin(message: MessageResolvable, _reason?: string): Promise<void> {
    await this.client.rest.delete(Routes.roomMessagePin(this.room.id, typeof message === 'string' ? message : message.id));
  }

  /**
   * Reacts to a message.
   *
   * @param message - The message or id.
   * @param emoji - A unicode emoji, `<:name:id>`, an id or an {@link Emoji}.
   */
  public async react(message: MessageResolvable, emoji: EmojiIdentifierResolvable): Promise<MessageReaction> {
    const id = typeof message === 'string' ? message : message.id;
    const identifier = emoji instanceof Emoji ? emoji.identifier : emoji;
    if (identifier.trim() === '') throw new StrafeError(ErrorCodes.EmojiInvalid, emoji instanceof Emoji ? emoji.toJSON() : emoji);
    const route = Routes.roomMessageReaction(this.room.id, id, identifier);
    const data = await this.client.rest.put<RESTReactionsResult>(route, {});
    const target = this.cache.get(id) ?? this._add({ id, room_id: this.room.id }, false);
    target.reactions._setFrom(data.reactions);
    const key = decodeURIComponent(route.slice(route.lastIndexOf('/') + 1));
    const reaction = target.reactions.cache.get(key.startsWith('custom:') ? key.slice('custom:'.length) : key);
    if (!reaction) throw new StrafeError(ErrorCodes.EmojiInvalid, identifier);
    return reaction;
  }
}

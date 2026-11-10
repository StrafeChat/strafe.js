import { Routes } from '../rest/Routes.js';
import type { MessageResolvable } from '../structures/MessagePayload.js';
import type { TextRoom } from '../structures/rooms/TextRoom.js';
import type { ThreadAutoArchiveDuration, ThreadRoom } from '../structures/rooms/ThreadRoom.js';
import type { RESTGetAPIArchivedThreadsQuery, RESTGetAPIArchivedThreadsResult, RESTPostAPIThreadJSONBody } from '../types/api/rest.js';
import type { APISpaceRoom } from '../types/api/room.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { DataManager } from './BaseManager.js';

/** What {@link ThreadManager.create} takes. */
export interface ThreadCreateOptions {
  /** Name (1-100 characters). */
  name: string;
  /** Minutes without activity before it archives (default 1440). */
  autoArchiveDuration?: ThreadAutoArchiveDuration;
  /** Start it from this message (the thread gets the message's id). */
  startMessage?: MessageResolvable;
  /** Private thread (Create Private Threads); not with `startMessage`. */
  private?: boolean;
  /** For private threads: members may add others. */
  invitable?: boolean;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** Options of {@link ThreadManager.fetchArchived}. */
export interface FetchArchivedThreadsOptions {
  /** Threads archived before this time. */
  before?: Date | string | number;
  /** How many (default 25). */
  limit?: number;
}

/** A page of archived threads. */
export interface FetchedThreads {
  /** The threads. */
  threads: Collection<Snowflake, ThreadRoom>;
  /** Whether there are more. */
  hasMore: boolean;
}

/** A text room's threads (discord.js's `ThreadManager`). */
export class ThreadManager extends DataManager<Snowflake, ThreadRoom, ThreadRoom> {
  /** The room. */
  declare public readonly room: TextRoom;

  /**
   * @param room - The room.
   */
  public constructor(room: TextRoom) {
    super(room.client);
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
  }

  /** The cached threads of this room. */
  public get cache(): Collection<Snowflake, ThreadRoom> {
    const out = new Collection<Snowflake, ThreadRoom>();
    for (const room of this.room.space.rooms.cache.values()) {
      if (room.isThread() && room.parentId === this.room.id) out.set(room.id, room);
    }
    return out;
  }

  private add(data: APISpaceRoom): ThreadRoom {
    const room = this.client.rooms._add(data, this.room.space);
    if (!room?.isThread()) throw new TypeError('The server did not answer with a thread');
    return room;
  }

  /**
   * Creates a thread: from a message (`startMessage`), or on its own (public, or private with
   * `private: true`).
   *
   * @param options - Name, duration, start message, privacy.
   * @example
   * ```ts
   * const thread = await message.startThread({ name: 'Discussion' });
   * const other = await room.threads.create({ name: 'Mods only', private: true });
   * ```
   */
  public async create(options: ThreadCreateOptions): Promise<ThreadRoom> {
    if (options.startMessage !== undefined) {
      const messageId = typeof options.startMessage === 'string' ? options.startMessage : options.startMessage.id;
      const data = await this.client.rest.post<APISpaceRoom>(Routes.roomMessageThreads(this.room.id, messageId), {
        body: { name: options.name, ...(options.autoArchiveDuration === undefined ? {} : { auto_archive_minutes: options.autoArchiveDuration }) },
      });
      return this.add(data);
    }
    const body: RESTPostAPIThreadJSONBody = { name: options.name };
    if (options.autoArchiveDuration !== undefined) body.auto_archive_minutes = options.autoArchiveDuration;
    if (options.private !== undefined) body.private = options.private;
    if (options.invitable !== undefined) body.invitable = options.invitable;
    const data = await this.client.rest.post<APISpaceRoom>(Routes.roomThreads(this.room.id), { body });
    return this.add(data);
  }

  /**
   * Fetches one thread by id.
   *
   * @param id - The thread id.
   * @param options - `force` skips the cache.
   */
  public async fetch(id: Snowflake, options: { force?: boolean } = {}): Promise<ThreadRoom> {
    if (options.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    return this.add(await this.client.rest.get<APISpaceRoom>(Routes.thread(id)));
  }

  /** Fetches this room's active threads. */
  public async fetchActive(): Promise<Collection<Snowflake, ThreadRoom>> {
    const all = await this.room.space.rooms.fetchActiveThreads();
    return all.filter((thread) => thread.parentId === this.room.id);
  }

  /**
   * Fetches a page of this room's archived threads, newest first.
   *
   * @param options - Paging.
   */
  public async fetchArchived(options: FetchArchivedThreadsOptions = {}): Promise<FetchedThreads> {
    const query: RESTGetAPIArchivedThreadsQuery = {};
    if (options.before !== undefined) query.before = new Date(options.before).toISOString();
    if (options.limit !== undefined) query.limit = options.limit;
    const data = await this.client.rest.get<RESTGetAPIArchivedThreadsResult>(Routes.roomArchivedThreads(this.room.id), { query: { ...query } });
    const threads = new Collection<Snowflake, ThreadRoom>();
    for (const thread of data.threads) {
      const room = this.add(thread);
      threads.set(room.id, room);
    }
    return { threads, hasMore: data.has_more };
  }
}

import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import { ThreadManager } from '../../managers/ThreadManager.js';
import type { RoomType } from '../../types/api/room.js';
import type { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Message } from '../Message.js';
import type { AwaitMessagesOptions, MessageCollectorOptions } from '../MessageCollector.js';
import { MessageCollector, awaitMessages } from '../MessageCollector.js';
import type { MessageCreateOptions, MessageResolvable } from '../MessagePayload.js';
import type { Space } from '../Space.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseSpaceRoom } from './BaseSpaceRoom.js';
import { bulkDelete, sendMessage, sendTyping } from './TextBased.js';

/** A space text room (`RoomType.SpaceText`). */
export class TextRoom extends BaseSpaceRoom {
  declare public readonly type: RoomType.SpaceText;
  /** The topic. */
  declare public topic: string | null;
  /** Slowmode in seconds (0 = off). Manage Messages and Manage Rooms are exempt. */
  declare public rateLimitPerUser: number;
  /** The newest message's id, when known. */
  declare public lastMessageId: Snowflake | null;
  /** Cached messages and fetching. */
  declare public readonly messages: MessageManager<true>;
  /** Threads of this room. */
  declare public readonly threads: ThreadManager;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.SpaceText }, space: Space) {
    super(client, data, space);
    Object.defineProperty(this, 'messages', { value: new MessageManager(this), enumerable: false });
    Object.defineProperty(this, 'threads', { value: new ThreadManager(this), enumerable: false });
    this.topic = null;
    this.rateLimitPerUser = 0;
    this.lastMessageId = null;
    this._patch(data);
  }

  /** @internal */
  public override _patch(data: APIRoomLike): void {
    super._patch(data);
    if (data.topic !== undefined) this.topic = data.topic === '' ? null : data.topic;
    if (data.slowmode_seconds !== undefined) this.rateLimitPerUser = data.slowmode_seconds;
    if (data.last_message_id !== undefined) this.lastMessageId = data.last_message_id;
  }

  /** The newest message, when cached. */
  public get lastMessage(): Message<true> | null {
    return this.lastMessageId === null ? null : (this.messages.cache.get(this.lastMessageId) ?? null);
  }

  /**
   * Sends a message.
   *
   * @param options - Text, or {@link MessageCreateOptions}.
   * @throws {@link StrafeError} `RoomEncrypted` in an end-to-end encrypted room (checked before any request).
   * @example
   * ```ts
   * await room.send('Hello!');
   * await room.send({ content: 'Report', embeds: [embed], files: [new URL('./report.pdf', import.meta.url)] });
   * ```
   */
  public send(options: string | MessageCreateOptions): Promise<Message<true>> {
    return sendMessage(this, options);
  }

  /** Shows "typing..." for about 5 seconds. */
  public sendTyping(): Promise<void> {
    return sendTyping(this);
  }

  /**
   * Collects the messages sent here, like discord.js's `createMessageCollector()`.
   *
   * @param options - Filter, `max`, `time`, `idle`...
   */
  public createMessageCollector(options: MessageCollectorOptions = {}): MessageCollector {
    return new MessageCollector(this, options);
  }

  /**
   * Waits for messages here, like discord.js's `awaitMessages()`: resolves with what was collected
   * once a limit or the time is reached, or rejects with it for an end reason listed in `errors`.
   *
   * @param options - Filter, `max`, `time`, `errors`...
   * @example
   * ```ts
   * const answers = await room.awaitMessages({ filter: (m) => m.author.id === userId, max: 1, time: 30_000, errors: ['time'] });
   * ```
   */
  public awaitMessages(options: AwaitMessagesOptions = {}): Promise<Collection<Snowflake, Message>> {
    return awaitMessages(this, options);
  }

  /**
   * Deletes up to 100 messages: the newest `n`, or the ones given. Strafe has no bulk endpoint, so
   * this is one request per message.
   *
   * @param messages - A count, a collection or a list of messages or ids.
   * @param _filterOld - Ignored: Strafe has no age limit on deleting.
   * @throws {@link BulkDeleteError} when some deletions failed.
   */
  public bulkDelete(
    messages: number | Collection<Snowflake, Message> | readonly MessageResolvable[],
    _filterOld?: boolean,
  ): Promise<Collection<Snowflake, Message | Snowflake>> {
    return bulkDelete(this, messages);
  }

  /**
   * Sets the topic (at most 1024 characters).
   *
   * @param topic - The topic; `null` or `''` clears it.
   */
  public setTopic(topic: string | null): Promise<this> {
    return this.edit({ topic: topic ?? '' });
  }

  /**
   * Sets slowmode.
   *
   * @param seconds - Seconds between messages per member (0 = off).
   */
  public setRateLimitPerUser(seconds: number): Promise<this> {
    return this.edit({ rateLimitPerUser: seconds });
  }

  /**
   * Turns end-to-end encryption on or off (Manage Rooms). A bot cannot read or post in an
   * encrypted room.
   *
   * @param encrypted - On or off.
   */
  public setEncrypted(encrypted: boolean): Promise<this> {
    return this.edit({ e2eeEnabled: encrypted });
  }
}

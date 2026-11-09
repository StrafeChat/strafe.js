import { Events } from '../client/ClientEvents.js';
import type { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { CollectorOptions } from './Collector.js';
import { Collector, awaitCollector } from './Collector.js';
import type { Message } from './Message.js';
import type { TextBasedRoom } from './rooms/index.js';

/** Options of {@link MessageCollector}, like discord.js's `MessageCollectorOptions`. */
export interface MessageCollectorOptions extends CollectorOptions<[Message]> {
  /** Stop after this many messages were collected (reason `'limit'`). */
  max?: number;
  /** Stop after this many messages were seen, collected or not (reason `'processedLimit'`). */
  maxProcessed?: number;
}

/** Options of `room.awaitMessages()`. */
export interface AwaitMessagesOptions extends MessageCollectorOptions {
  /** End reasons that reject the promise (with the collection) instead of resolving it, e.g. `['time']`. */
  errors?: string[];
}

/**
 * Collects the messages sent in one room, like discord.js's `MessageCollector`. It ends with reason
 * `'time'`, `'idle'`, `'limit'`, `'processedLimit'`, `'user'` (`stop()`), or `'roomDelete'`,
 * `'threadDelete'` or `'spaceDelete'` when the room goes away. Messages in end-to-end encrypted
 * rooms are collected too, with `content === null`.
 *
 * @example
 * ```ts
 * const collector = room.createMessageCollector({ filter: (m) => m.author.id === userId, time: 30_000 });
 * collector.on('collect', (m) => console.log(`Got ${m.content}`));
 * collector.on('end', (collected, reason) => console.log(`${collected.size} messages (${reason})`));
 * ```
 */
export class MessageCollector extends Collector<Message> {
  /** The room. */
  declare public readonly room: TextBasedRoom;
  /** Messages seen so far, collected or not. */
  public received = 0;
  declare public readonly options: MessageCollectorOptions;

  /**
   * @param room - The room to collect in.
   * @param options - Filter, limits, time.
   */
  public constructor(room: TextBasedRoom, options: MessageCollectorOptions = {}) {
    super(room.client, options);
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
    this.listen(Events.MessageCreate, (message) => this.handleCollect(message));
    this.listen(Events.MessageDelete, (message) => this.handleDispose(message as Message));
    this.listen(Events.RoomDelete, (deleted) => {
      if (deleted.id === this.room.id) this.stop('roomDelete');
    });
    this.listen(Events.ThreadDelete, (thread) => {
      if (thread.id === this.room.id) this.stop('threadDelete');
    });
    this.listen(Events.SpaceDelete, (space) => {
      if (!this.room.isPMBased() && space.id === this.room.spaceId) this.stop('spaceDelete');
    });
  }

  protected collect(message: Message): string | null {
    if (message.roomId !== this.room.id) return null;
    this.received++;
    return message.id;
  }

  protected dispose(message: Message): string | null {
    return message.roomId === this.room.id ? message.id : null;
  }

  protected limitReached(): string | null {
    if (this.options.max !== undefined && this.collected.size >= this.options.max) return 'limit';
    if (this.options.maxProcessed !== undefined && this.received >= this.options.maxProcessed) return 'processedLimit';
    return null;
  }
}

/**
 * `room.awaitMessages()`: collects until a limit or time, then resolves with the messages.
 *
 * @internal
 */
export function awaitMessages(room: TextBasedRoom, options: AwaitMessagesOptions = {}): Promise<Collection<Snowflake, Message>> {
  return awaitCollector(new MessageCollector(room, options), options.errors);
}

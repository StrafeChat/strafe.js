import { Events } from '../client/ClientEvents.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { CollectorOptions } from './Collector.js';
import { Collector, awaitCollector } from './Collector.js';
import type { Message } from './Message.js';
import type { MessageReaction } from './MessageReaction.js';
import type { User } from './User.js';

/** Options of {@link ReactionCollector}, like discord.js's `ReactionCollectorOptions`. */
export interface ReactionCollectorOptions extends CollectorOptions<[MessageReaction, User]> {
  /** Stop after this many reactions were collected (reason `'limit'`). */
  max?: number;
  /** Stop after this many different emoji were collected (reason `'emojiLimit'`). */
  maxEmojis?: number;
  /** Stop after this many different people reacted (reason `'userLimit'`). */
  maxUsers?: number;
}

/** Options of `message.awaitReactions()`. */
export interface AwaitReactionsOptions extends ReactionCollectorOptions {
  /** End reasons that reject the promise (with the collection) instead of resolving it, e.g. `['time']`. */
  errors?: string[];
}

/**
 * Collects the reactions added to one message, like discord.js's `ReactionCollector`. `collected`
 * is keyed like `message.reactions.cache` (a custom emoji's id, or the unicode emoji). It ends with
 * reason `'time'`, `'idle'`, `'limit'`, `'emojiLimit'`, `'userLimit'`, `'user'`, or
 * `'messageDelete'`, `'roomDelete'`, `'threadDelete'` or `'spaceDelete'` when the message goes away.
 *
 * @example
 * ```ts
 * const poll = await room.send('Vote with 👍 or 👎');
 * const votes = await poll.awaitReactions({ filter: (reaction) => ['👍', '👎'].includes(reaction.emoji.name ?? ''), time: 60_000 });
 * ```
 */
export class ReactionCollector extends Collector<MessageReaction, [User]> {
  /** The message. */
  declare public readonly message: Message;
  /** Everyone whose reaction was collected. */
  public readonly users = new Collection<Snowflake, User>();
  /** How many reactions were collected (one per person and emoji). */
  public total = 0;
  declare public readonly options: ReactionCollectorOptions;

  /**
   * @param message - The message to collect reactions on.
   * @param options - Filter, limits, time.
   */
  public constructor(message: Message, options: ReactionCollectorOptions = {}) {
    super(message.client, options);
    Object.defineProperty(this, 'message', { value: message, enumerable: false });
    this.on('collect', (_reaction, user) => {
      this.total++;
      this.users.set(user.id, user);
    });
    this.listen(Events.MessageReactionAdd, (reaction, user) => this.handleCollect(reaction, user));
    this.listen(Events.MessageReactionRemove, (reaction, user) => this.handleDispose(reaction, user));
    this.listen(Events.MessageDelete, (deleted) => {
      if (deleted.id === this.message.id) this.stop('messageDelete');
    });
    this.listen(Events.RoomDelete, (room) => {
      if (room.id === this.message.roomId) this.stop('roomDelete');
    });
    this.listen(Events.ThreadDelete, (thread) => {
      if (thread.id === this.message.roomId) this.stop('threadDelete');
    });
    this.listen(Events.SpaceDelete, (space) => {
      if (space.id === this.message.spaceId) this.stop('spaceDelete');
    });
  }

  /**
   * The key of a reaction in `collected`: the custom emoji's id, or the unicode emoji.
   *
   * @param reaction - The reaction.
   */
  public static key(reaction: MessageReaction): string {
    return reaction.id;
  }

  protected collect(reaction: MessageReaction): string | null {
    return reaction.message.id === this.message.id ? ReactionCollector.key(reaction) : null;
  }

  protected dispose(reaction: MessageReaction, user: User): string | null {
    if (reaction.message.id !== this.message.id) return null;
    const key = ReactionCollector.key(reaction);
    if (this.collected.has(key) && this.users.has(user.id)) {
      this.total = Math.max(0, this.total - 1);
      // Recounted from the reactions still collected, so someone with another reaction stays.
      if (!this.collected.some((other) => other !== reaction && other.users.cache.has(user.id))) this.users.delete(user.id);
    }
    // The emoji leaves `collected` only once nobody has it any more.
    return reaction.count === 0 ? key : null;
  }

  protected limitReached(): string | null {
    if (this.options.max !== undefined && this.total >= this.options.max) return 'limit';
    if (this.options.maxEmojis !== undefined && this.collected.size >= this.options.maxEmojis) return 'emojiLimit';
    if (this.options.maxUsers !== undefined && this.users.size >= this.options.maxUsers) return 'userLimit';
    return null;
  }
}

/**
 * `message.awaitReactions()`: collects until a limit or time, then resolves with the reactions.
 *
 * @internal
 */
export function awaitReactions(message: Message, options: AwaitReactionsOptions = {}): Promise<Collection<string, MessageReaction>> {
  return awaitCollector(new ReactionCollector(message, options), options.errors);
}

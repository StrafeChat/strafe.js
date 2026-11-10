import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import type { Emoji } from '../structures/Emoji.js';
import type { Message } from '../structures/Message.js';
import { MessageReaction } from '../structures/MessageReaction.js';
import type { APIReactionSummary } from '../types/api/message.js';
import { CachedManager } from './BaseManager.js';

/** Reactions on a message, keyed by the custom emoji's id or the unicode emoji. */
export class ReactionManager extends CachedManager<string, MessageReaction, MessageReaction | Emoji> {
  /** The message. */
  declare public readonly message: Message;

  /**
   * @param message - The message.
   */
  public constructor(message: Message) {
    super(message.client, 'ReactionManager');
    Object.defineProperty(this, 'message', { value: message, enumerable: false });
  }

  /** @internal */
  public _add(data: Partial<APIReactionSummary> & { emoji: string }, cache = true): MessageReaction {
    const custom = /^custom:(\d+)$/.exec(data.emoji);
    const key = custom?.[1] ?? data.emoji;
    return this._upsert(key, data, cache, () => new MessageReaction(this.client, data, this.message));
  }

  /** Replaces the reactions with a server summary. @internal */
  public _setFrom(summaries: readonly APIReactionSummary[]): void {
    const keys = new Set<string>();
    for (const summary of summaries) keys.add(this._add(summary).id);
    for (const key of [...this._cache.keys()]) if (!keys.has(key)) this._cache.delete(key);
  }

  /**
   * The cache key of a reaction, an emoji, or an identifier (`👋`, `custom:<id>`, an id).
   *
   * @param resolvable - What to resolve.
   */
  public override resolveId(resolvable: MessageReaction | Emoji | string): string | null {
    if (typeof resolvable === 'string') {
      const custom = /^(?:custom:|<a?:\w*:)?(\d{5,20})>?$/.exec(resolvable);
      return custom?.[1] ?? resolvable;
    }
    if (resolvable instanceof MessageReaction) return resolvable.id;
    return resolvable.id ?? resolvable.name;
  }

  /**
   * Not available: Strafe has no endpoint to clear the reactions of a message.
   */
  public removeAll(): Promise<never> {
    return Promise.reject(new StrafeError(ErrorCodes.Unsupported, 'Removing every reaction', 'the API has no endpoint for it'));
  }
}

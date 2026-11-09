import type { Client } from '../client/Client.js';
import { ReactionUserManager } from '../managers/ReactionUserManager.js';
import { Routes } from '../rest/Routes.js';
import type { APIReactionSummary } from '../types/api/message.js';
import type { RESTReactionsResult } from '../types/api/rest.js';
import type { Snowflake } from '../util/Snowflake.js';
import { ReactionEmoji } from './Emoji.js';
import type { SpaceEmoji } from './Emoji.js';
import type { Message } from './Message.js';

/**
 * A reaction on a message. Built from the message's reaction summary, or from a reaction event
 * (then `count` may be unknown until fetched: `if (reaction.partial) await reaction.fetch()`).
 */
export class MessageReaction {
  /** The message. */
  declare public readonly message: Message;
  /** The client. */
  declare public readonly client: Client<true>;
  /** The emoji as the server names it: `👋` or `custom:<id>`. */
  public readonly identifier: string;
  /** How many reacted, when known. */
  public count: number | null;
  /** Whether the client reacted. */
  public me: boolean;
  /** Who reacted. */
  declare public readonly users: ReactionUserManager;

  /**
   * @param client - The client.
   * @param data - Summary or event data.
   * @param message - The message.
   */
  public constructor(client: Client, data: Partial<APIReactionSummary> & { emoji: string }, message: Message) {
    Object.defineProperty(this, 'client', { value: client, enumerable: false });
    Object.defineProperty(this, 'message', { value: message, enumerable: false });
    Object.defineProperty(this, 'users', { value: new ReactionUserManager(this), enumerable: false });
    this.identifier = data.emoji;
    this.count = data.count ?? null;
    this.me = data.me ?? false;
  }

  /** @internal */
  public _patch(data: Partial<APIReactionSummary>): void {
    if (data.count !== undefined) this.count = data.count;
    if (data.me !== undefined) this.me = data.me;
  }

  /** The key in `message.reactions.cache`: the custom emoji's id, or the unicode emoji. */
  public get id(): string {
    const custom = /^custom:(\d+)$/.exec(this.identifier);
    return custom?.[1] ?? this.identifier;
  }

  /** The emoji: the space's {@link SpaceEmoji} when cached, else a {@link ReactionEmoji}. */
  public get emoji(): SpaceEmoji | ReactionEmoji {
    const custom = /^custom:(\d+)$/.exec(this.identifier);
    if (custom) {
      const known = this.client.emojis.cache.get(custom[1] ?? '');
      if (known) return known;
    }
    return new ReactionEmoji(this.client, this.identifier);
  }

  /** Whether the count is unknown. */
  public get partial(): boolean {
    return this.count === null;
  }

  /** Re-reads the reaction from the message (one `GET` of the message). */
  public async fetch(): Promise<MessageReaction> {
    const message = await this.message.fetch(true);
    const fresh = message.reactions.cache.get(this.id);
    if (fresh) return fresh;
    this.count = 0;
    this.me = false;
    return this;
  }

  /** Reacts with this emoji too. */
  public react(): Promise<MessageReaction> {
    return this.message.react(this.identifier);
  }

  /**
   * Removes the client's own reaction. Strafe has no endpoint to remove someone else's reaction.
   */
  public async remove(): Promise<this> {
    const data = await this.client.rest.delete<RESTReactionsResult>(Routes.roomMessageReaction(this.message.roomId, this.message.id, this.identifier));
    this.message.reactions._setFrom(data.reactions);
    return this;
  }

  /**
   * Applies a reaction-add event. The client's own reaction may already be counted: `react()`
   * stores the server's answer, which includes it, and the event can arrive before or after that
   * answer. So can a user the cache already lists. Neither is counted twice.
   *
   * @internal
   */
  public _add(userId: Snowflake): void {
    const self = userId === this.client._userId;
    if ((self && this.me) || this.users.cache.has(userId)) return;
    if (this.count !== null) this.count++;
    if (self) this.me = true;
    const user = this.client.users.cache.get(userId);
    if (user) this.users.cache.set(userId, user);
  }

  /**
   * Applies a reaction-remove event. When the client's own reaction is already gone (`remove()`
   * stored the server's answer, or the server reports a reaction that was never there), the count
   * is left alone, so a reaction others still have is not dropped.
   *
   * @internal
   */
  public _remove(userId: Snowflake): void {
    const self = userId === this.client._userId;
    if (self && !this.me) return;
    if (this.count !== null) this.count = Math.max(0, this.count - 1);
    if (self) this.me = false;
    this.users.cache.delete(userId);
  }

  /** Plain JSON. */
  public toJSON(): Record<string, unknown> {
    return { emoji: this.identifier, count: this.count, me: this.me, messageId: this.message.id };
  }
}

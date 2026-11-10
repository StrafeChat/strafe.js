import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import { Routes } from '../../rest/Routes.js';
import type { APIPMRoom, RoomType } from '../../types/api/room.js';
import { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Message } from '../Message.js';
import type { AwaitMessagesOptions, MessageCollectorOptions } from '../MessageCollector.js';
import { MessageCollector, awaitMessages } from '../MessageCollector.js';
import type { MessageCreateOptions } from '../MessagePayload.js';
import type { User } from '../User.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseRoom } from './BaseRoom.js';
import { sendMessage, sendTyping } from './TextBased.js';

/**
 * A group PM (`RoomType.GroupPM`). Group PMs are end-to-end encrypted by default; only when its
 * creator turns encryption off can a bot read and post in one.
 */
export class GroupPMRoom extends BaseRoom {
  declare public readonly type: RoomType.GroupPM;
  /** The name, if one is set. */
  declare public name: string | null;
  /** Who created it (the only one who can rename it or remove others). */
  declare public ownerId: Snowflake | null;
  /** Participants' ids. */
  declare public recipientIds: Snowflake[];
  /** The newest message's id, when known. */
  declare public lastMessageId: Snowflake | null;
  /** Messages. */
  declare public readonly messages: MessageManager<false>;

  /**
   * @param client - The client.
   * @param data - Wire data.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.GroupPM }) {
    super(client, data);
    Object.defineProperty(this, 'messages', { value: new MessageManager(this), enumerable: false });
    this.name = null;
    this.ownerId = null;
    this.recipientIds = [];
    this.lastMessageId = null;
    this._patch(data);
  }

  /** @internal */
  public override _patch(data: APIRoomLike): void {
    super._patch(data);
    if (data.name !== undefined) this.name = data.name === '' ? null : data.name;
    if (data.creator_id !== undefined) this.ownerId = data.creator_id;
    if (data.recipients !== undefined) this.recipientIds = [...data.recipients];
    if (data.participants !== undefined) {
      for (const participant of data.participants) this.client.users._add(participant);
      if (data.recipients === undefined) this.recipientIds = data.participants.map((p) => p.id);
    }
    if (data.last_message_id !== undefined) this.lastMessageId = data.last_message_id;
  }

  /** Cached participants. */
  public get recipients(): Collection<Snowflake, User> {
    const out = new Collection<Snowflake, User>();
    for (const id of this.recipientIds) {
      const user = this.client.users.cache.get(id);
      if (user) out.set(id, user);
    }
    return out;
  }

  /** The newest message, when cached. */
  public get lastMessage(): Message<false> | null {
    return this.lastMessageId === null ? null : (this.messages.cache.get(this.lastMessageId) ?? null);
  }

  /**
   * Sends a message (only when encryption is off for this group).
   *
   * @param options - Text or {@link MessageCreateOptions}.
   */
  public send(options: string | MessageCreateOptions): Promise<Message<false>> {
    return sendMessage(this, options);
  }

  /** Shows "typing...". */
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
   * Renames the group (creator only).
   *
   * @param name - The name (at most 100 characters).
   */
  public async setName(name: string): Promise<this> {
    const data = await this.client.rest.patch<APIPMRoom>(Routes.room(this.id), { body: { name } });
    this._patch(data);
    return this;
  }

  /**
   * Adds someone to the group (at most 50 participants).
   *
   * @param user - A user or id.
   */
  public async addRecipient(user: User | Snowflake): Promise<this> {
    await this.client.rest.post(Routes.roomParticipants(this.id), { body: { user_id: typeof user === 'string' ? user : user.id } });
    return this;
  }

  /**
   * Removes someone (creator only).
   *
   * @param user - A user or id.
   */
  public async removeRecipient(user: User | Snowflake): Promise<this> {
    await this.client.rest.delete(Routes.roomParticipant(this.id, typeof user === 'string' ? user : user.id));
    return this;
  }

  /** Leaves the group. */
  public async leave(): Promise<this> {
    await this.client.rest.delete(Routes.roomParticipant(this.id, this.client.user.id));
    this.client.rooms._remove(this.id);
    return this;
  }
}

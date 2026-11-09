import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import type { RoomType } from '../../types/api/room.js';
import type { Collection } from '../../util/Collection.js';
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
 * A 1:1 private message room (`RoomType.PM`). PMs between two accounts
 * are always end-to-end encrypted on Strafe and nobody can turn that off, so a bot can see the room
 * but never read or post in it: {@link PMRoom.send} rejects with `PMsEncrypted`.
 */
export class PMRoom extends BaseRoom {
  declare public readonly type: RoomType.PM;
  /** Both participants' ids. */
  declare public recipientIds: Snowflake[];
  /** The newest message's id, when known. */
  declare public lastMessageId: Snowflake | null;
  /** Messages (encrypted: `content` is always `null`). */
  declare public readonly messages: MessageManager<false>;

  /**
   * @param client - The client.
   * @param data - Wire data.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.PM }) {
    super(client, data);
    Object.defineProperty(this, 'messages', { value: new MessageManager(this), enumerable: false });
    this.recipientIds = [];
    this.lastMessageId = null;
    this._patch(data);
  }

  /** @internal */
  public override _patch(data: APIRoomLike): void {
    super._patch(data);
    if (data.recipients !== undefined) this.recipientIds = [...data.recipients];
    if (data.participants !== undefined) {
      for (const participant of data.participants) this.client.users._add(participant);
      if (data.recipients === undefined) this.recipientIds = data.participants.map((p) => p.id);
    }
    if (data.last_message_id !== undefined) this.lastMessageId = data.last_message_id;
  }

  /** The other participant's id. */
  public get recipientId(): Snowflake | null {
    const me = this.client._userId;
    return this.recipientIds.find((id) => id !== me) ?? this.recipientIds[0] ?? null;
  }

  /** The other participant, when cached. */
  public get recipient(): User | null {
    const id = this.recipientId;
    return id === null ? null : (this.client.users.cache.get(id) ?? null);
  }

  /** The newest message, when cached. */
  public get lastMessage(): Message<false> | null {
    return this.lastMessageId === null ? null : (this.messages.cache.get(this.lastMessageId) ?? null);
  }

  /**
   * Always rejects with `PMsEncrypted`: a 1:1 PM is end-to-end encrypted and a bot has no keys.
   *
   * @param options - Ignored.
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
}

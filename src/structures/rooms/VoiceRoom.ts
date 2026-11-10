import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import type { RoomType } from '../../types/api/room.js';
import { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Message } from '../Message.js';
import type { AwaitMessagesOptions, MessageCollectorOptions } from '../MessageCollector.js';
import { MessageCollector, awaitMessages } from '../MessageCollector.js';
import type { MessageCreateOptions, MessageResolvable } from '../MessagePayload.js';
import type { Space } from '../Space.js';
import type { SpaceMember } from '../SpaceMember.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseSpaceRoom } from './BaseSpaceRoom.js';
import { bulkDelete, sendMessage, sendTyping } from './TextBased.js';

/**
 * A space voice room (`RoomType.SpaceVoice`). It also has a text chat. Bots can read voice states
 * and moderate (mute, deafen, move, disconnect) but cannot join: calls are end-to-end encrypted.
 */
export class VoiceRoom extends BaseSpaceRoom {
  declare public readonly type: RoomType.SpaceVoice;
  /** Most people at once (0 = unlimited). */
  declare public userLimit: number;
  /** Audio bitrate in bits per second (0 = the instance's default). */
  declare public bitrate: number;
  /** Slowmode of the room's chat, in seconds. */
  declare public rateLimitPerUser: number;
  /** The chat's newest message id, when known. */
  declare public lastMessageId: Snowflake | null;
  /** The room's chat messages. */
  declare public readonly messages: MessageManager<true>;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.SpaceVoice }, space: Space) {
    super(client, data, space);
    Object.defineProperty(this, 'messages', { value: new MessageManager(this), enumerable: false });
    this.userLimit = 0;
    this.bitrate = 0;
    this.rateLimitPerUser = 0;
    this.lastMessageId = null;
    this._patch(data);
  }

  /** @internal */
  public override _patch(data: APIRoomLike): void {
    super._patch(data);
    if (data.user_limit !== undefined) this.userLimit = data.user_limit;
    if (data.bitrate !== undefined) this.bitrate = data.bitrate;
    if (data.slowmode_seconds !== undefined) this.rateLimitPerUser = data.slowmode_seconds;
    if (data.last_message_id !== undefined) this.lastMessageId = data.last_message_id;
  }

  /** Members connected to the room (from cached voice states and members). */
  public override get members(): Collection<Snowflake, SpaceMember> {
    const out = new Collection<Snowflake, SpaceMember>();
    for (const state of this.space.voiceStates.cache.values()) {
      if (state.roomId !== this.id) continue;
      const member = this.space.members.cache.get(state.id);
      if (member) out.set(member.id, member);
    }
    return out;
  }

  /** Whether the room is at its user limit. */
  public get full(): boolean {
    if (this.userLimit === 0) return false;
    let count = 0;
    for (const state of this.space.voiceStates.cache.values()) if (state.roomId === this.id) count++;
    return count >= this.userLimit;
  }

  /** The chat's newest message, when cached. */
  public get lastMessage(): Message<true> | null {
    return this.lastMessageId === null ? null : (this.messages.cache.get(this.lastMessageId) ?? null);
  }

  /**
   * Sends a message to the room's chat.
   *
   * @param options - Text or {@link MessageCreateOptions}.
   */
  public send(options: string | MessageCreateOptions): Promise<Message<true>> {
    return sendMessage(this, options);
  }

  /** Shows "typing..." in the chat. */
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
   * Deletes up to 100 messages of the chat, one request each. Note that only your own messages can
   * be deleted in a voice room's chat.
   *
   * @param messages - A count, a collection or a list.
   * @param _filterOld - Ignored.
   */
  public bulkDelete(
    messages: number | Collection<Snowflake, Message> | readonly MessageResolvable[],
    _filterOld?: boolean,
  ): Promise<Collection<Snowflake, Message | Snowflake>> {
    return bulkDelete(this, messages);
  }

  /**
   * Sets the user limit (0-99, 0 = unlimited).
   *
   * @param userLimit - The limit.
   */
  public setUserLimit(userLimit: number): Promise<this> {
    return this.edit({ userLimit });
  }

  /**
   * Sets the bitrate (8000-384000, or 0 for the default).
   *
   * @param bitrate - Bits per second.
   */
  public setBitrate(bitrate: number): Promise<this> {
    return this.edit({ bitrate });
  }
}

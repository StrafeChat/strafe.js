import type { Client } from '../client/Client.js';
import { ReactionManager } from '../managers/ReactionManager.js';
import type { ThreadCreateOptions } from '../managers/ThreadManager.js';
import { Routes } from '../rest/Routes.js';
import type { APIMessage, MessageSystemPayloads, MessageSystemType } from '../types/api/message.js';
import { RoomType } from '../types/api/room.js';
import { Collection } from '../util/Collection.js';
import { PermissionFlagsBits } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import type { If } from '../util/Util.js';
import { absoluteURL, parseTimestamp } from '../util/Util.js';
import { Attachment } from './Attachment.js';
import { Base } from './Base.js';
import { Embed } from './Embed.js';
import type { EmojiIdentifierResolvable } from './Emoji.js';
import { MessageMentions } from './MessageMentions.js';
import type { MessageEditOptions, MessageReplyOptions } from './MessagePayload.js';
import type { MessageReaction } from './MessageReaction.js';
import type { AwaitReactionsOptions, ReactionCollectorOptions } from './ReactionCollector.js';
import { ReactionCollector, awaitReactions } from './ReactionCollector.js';
import type { SpaceTextBasedRoom, TextBasedRoom } from './rooms/index.js';
import type { ThreadRoom } from './rooms/ThreadRoom.js';
import type { Space } from './Space.js';
import type { SpaceMember } from './SpaceMember.js';
import type { User } from './User.js';

/** Where a reply points. */
export interface MessageReference {
  /** The replied-to message. */
  messageId: Snowflake;
  /** Its room (always this message's room on Strafe). */
  roomId: Snowflake;
  /** Its space, if any. */
  spaceId: Snowflake | null;
}

/** A system notice's type and payload, parsed. */
export type MessageSystemData = { [T in MessageSystemType]: { type: T; data: MessageSystemPayloads[T] } }[MessageSystemType];

/** The sender id of system notices. */
export const SystemSenderId = '0';

/**
 * A message. In an end-to-end encrypted room `content` is `null` and {@link Message.encrypted} is
 * true: a bot has no keys, by design.
 *
 * @typeParam InSpace - Whether the message is known to be in a space; narrow with {@link Message.inSpace}.
 */
export class Message<InSpace extends boolean = boolean> extends Base {
  /** The id. */
  declare public readonly id: Snowflake;
  /** The room. */
  declare public readonly room: If<InSpace, SpaceTextBasedRoom, TextBasedRoom>;
  /** The author's id (`'0'` for system notices; `null` on a partial message). */
  declare public authorId: Snowflake | null;
  /** The text; `null` when encrypted or not known (partial). `''` for a message with only files or embeds. */
  declare public content: string | null;
  /** Whether the message is end-to-end encrypted (the bot cannot read it). */
  declare public encrypted: boolean;
  /** Embeds. */
  declare public embeds: Embed[];
  /** Files. */
  declare public attachments: Collection<Snowflake, Attachment>;
  /** Mentions. */
  declare public mentions: MessageMentions;
  /** The replied-to message, for a reply. */
  declare public reference: MessageReference | null;
  /** Whether it is pinned. */
  declare public pinned: boolean;
  /** When it was pinned (Unix ms). */
  declare public pinnedTimestamp: number | null;
  /** Who pinned it. */
  declare public pinnedById: Snowflake | null;
  /** The system notice's type and data, for a system message. */
  declare public systemData: MessageSystemData | null;
  /** The id of a thread started from this message. */
  declare public threadId: Snowflake | null;
  /** When it was sent (Unix ms). */
  declare public createdTimestamp: number;
  /** When it was last edited (Unix ms), or `null`. */
  declare public editedTimestamp: number | null;
  /** Reactions. */
  declare public readonly reactions: ReactionManager;
  /** @internal */
  declare public _partial: boolean;

  /**
   * @param client - The client.
   * @param data - Wire data (or just `{ id, room_id }` for a partial message).
   * @param room - The room.
   */
  public constructor(client: Client, data: Partial<APIMessage> & { id: Snowflake }, room: TextBasedRoom) {
    super(client);
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
    Object.defineProperty(this, 'reactions', { value: new ReactionManager(this as Message), enumerable: false });
    this.authorId = null;
    this.content = null;
    this.encrypted = false;
    this.embeds = [];
    this.attachments = new Collection();
    this.mentions = new MessageMentions(this, {});
    this.reference = null;
    this.pinned = false;
    this.pinnedTimestamp = null;
    this.pinnedById = null;
    this.systemData = null;
    this.threadId = null;
    this.createdTimestamp = SnowflakeUtil.timestampFrom(data.id);
    this.editedTimestamp = null;
    this._partial = data.sender_id === undefined;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIMessage>): void {
    if (data.sender_id !== undefined) {
      this.authorId = data.sender_id;
      this._partial = false;
      if (data.author) this.client.users._add(data.author);
      else if (!this.client.users.cache.has(data.sender_id)) {
        this.client.users._add({ id: data.sender_id, ...(data.sender_id === SystemSenderId ? { system: true, username: '' } : {}) });
      }
    }
    if (data.ciphertext !== undefined || data.plaintext !== undefined) {
      this.encrypted = (data.ciphertext ?? '') !== '' && data.plaintext === undefined;
      this.content = this.encrypted ? null : (data.plaintext ?? '');
    } else if (data.sender_id !== undefined && this.content === null && !this.encrypted) {
      // A reduced system notice: no text at all.
      this.content = '';
    }
    if (data.embeds !== undefined) {
      const api = this.client.rest.api;
      this.embeds = data.embeds.map((embed) => {
        const copy = structuredClone(embed);
        if (copy.image?.proxy_url !== undefined) copy.image.proxy_url = absoluteURL(copy.image.proxy_url, api) ?? copy.image.proxy_url;
        if (copy.thumbnail?.proxy_url !== undefined) copy.thumbnail.proxy_url = absoluteURL(copy.thumbnail.proxy_url, api) ?? copy.thumbnail.proxy_url;
        if (copy.author?.proxy_icon_url !== undefined) copy.author.proxy_icon_url = absoluteURL(copy.author.proxy_icon_url, api) ?? '';
        if (copy.footer?.proxy_icon_url !== undefined) copy.footer.proxy_icon_url = absoluteURL(copy.footer.proxy_icon_url, api) ?? '';
        return new Embed(copy);
      });
    }
    if (data.attachments !== undefined) {
      this.attachments = new Collection(data.attachments.map((a) => [a.id, new Attachment(a)] as const));
    }
    if (data.mentions !== undefined || data.mention_roles !== undefined || data.mention_everyone !== undefined || data.mention_users !== undefined) {
      this.mentions = new MessageMentions(this, data);
    } else if (data.sender_id !== undefined) {
      // A full payload leaves the keys out when there are no mentions.
      this.mentions = new MessageMentions(this, {});
    }
    if (data.reply_to_id !== undefined) {
      this.reference = { messageId: data.reply_to_id, roomId: this.room.id, spaceId: this.spaceId };
    } else if (data.sender_id !== undefined) {
      this.reference = null;
    }
    if (data.referenced_message) this.room.messages._add(data.referenced_message);
    if (data.sender_id !== undefined) {
      this.pinned = data.pinned === true;
      this.pinnedTimestamp = parseTimestamp(data.pinned_at);
      this.pinnedById = data.pinned_by ?? null;
      this.threadId = data.thread_id ?? null;
    }
    if (data.system_type !== undefined) this.systemData = parseSystem(data.system_type, data.system_payload);
    if (data.created_at !== undefined) this.createdTimestamp = parseTimestamp(data.created_at) ?? this.createdTimestamp;
    if (data.updated_at !== undefined) {
      const updated = parseTimestamp(data.updated_at);
      this.editedTimestamp = updated !== null && updated > this.createdTimestamp ? updated : null;
    }
    if (data.reactions !== undefined) this.reactions._setFrom(data.reactions);
  }

  /** Whether only the id is known (fetch it: `await message.fetch()`). */
  public get partial(): boolean {
    return this._partial;
  }

  /** The room id. */
  public get roomId(): Snowflake {
    return this.room.id;
  }

  /** The space id, for a space room. */
  public get spaceId(): If<InSpace, Snowflake> {
    const room = this.room;
    return ('space' in room ? room.space.id : null) as If<InSpace, Snowflake>;
  }

  /** The space, for a space room. */
  public get space(): If<InSpace, Space> {
    const room = this.room;
    return ('space' in room ? room.space : null) as If<InSpace, Space>;
  }

  /** The author (a partial user with only the id when the payload did not include it). */
  public get author(): User {
    // A partial message has no author; its type (PartialMessage) says so.
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    return (this.authorId === null ? null : this.client.users.cache.get(this.authorId)) as User;
  }

  /** The author's member, when cached (member lists are not in READY; fetch them once). */
  public get member(): SpaceMember | null {
    return this.authorId === null ? null : (this.space?.members.cache.get(this.authorId) ?? null);
  }

  /** Whether this is a system notice (member joined, message pinned...). */
  public get system(): boolean {
    return this.systemData !== null || this.authorId === SystemSenderId;
  }

  /** When it was sent. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** When it was last edited. */
  public get editedAt(): Date | null {
    return this.editedTimestamp === null ? null : new Date(this.editedTimestamp);
  }

  /** When it was pinned. */
  public get pinnedAt(): Date | null {
    return this.pinnedTimestamp === null ? null : new Date(this.pinnedTimestamp);
  }

  /** The thread started from it, when cached. */
  public get thread(): ThreadRoom | null {
    if (this.threadId === null) return null;
    const room = this.client.rooms.cache.get(this.threadId);
    return room?.isThread() ? room : null;
  }

  /** Whether a thread was started from it. */
  public get hasThread(): boolean {
    return this.threadId !== null;
  }

  /**
   * The room's page in the web client. Strafe has no links to single messages yet, so this is the
   * room's URL.
   */
  public get url(): string {
    return this.room.url;
  }

  /** The text with mentions replaced by names (`@name`, `@role`, `#room`) and `@everyone` defused. */
  public get cleanContent(): string | null {
    if (this.content === null) return null;
    const space = this.space;
    return this.content
      .replace(/<@!?(\d{1,20})>/g, (match, id: string) => {
        const member = space?.members.cache.get(id);
        const user = this.client.users.cache.get(id);
        const name = member?.displayName ?? user?.displayName;
        return name === null || name === undefined ? match : `@${name}`;
      })
      .replace(/<@&(\d{1,20})>/g, (match, id: string) => {
        const role = space?.roles.cache.get(id);
        return role ? `@${role.name}` : match;
      })
      .replace(/<#(\d{1,20})>/g, (match, id: string) => {
        const room = this.client.rooms.cache.get(id);
        return room && 'name' in room && typeof room.name === 'string' ? `#${room.name}` : match;
      })
      .replace(/@(everyone|here)/g, '@​$1');
  }

  /** Whether the client can edit it (its own, readable message). */
  public get editable(): boolean {
    return this.authorId === this.client._userId && !this.system && !this.encrypted;
  }

  /**
   * Whether the client can delete it: its own message, or, in a space text room or thread, with
   * Manage Messages. Others' messages in PMs and voice-room chats can never be deleted.
   */
  public get deletable(): boolean {
    if (this.authorId === this.client._userId) return true;
    const room = this.room;
    if (room.type !== RoomType.SpaceText && room.type !== RoomType.Thread) return false;
    const me = room.space.members.me;
    return me ? (room.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages) ?? false) : false;
  }

  /** Whether the client can pin it: anyone in a PM, Manage Messages in a space room. */
  public get pinnable(): boolean {
    if (this.system) return false;
    const room = this.room;
    if (room.isPMBased()) return true;
    const me = room.space.members.me;
    return me ? (room.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages) ?? false) : false;
  }

  /** Whether the message is in a space room (narrows `space`, `spaceId` and `room`). */
  public inSpace(): this is Message<true> & this {
    return 'space' in (this.room);
  }

  /**
   * Replies to the message.
   *
   * @param options - Text or {@link MessageReplyOptions}.
   * @example
   * ```ts
   * await message.reply('Pong!');
   * ```
   */
  public reply(options: string | MessageReplyOptions): Promise<Message<InSpace>> {
    const data = typeof options === 'string' ? { content: options } : options;
    return (this.room).send({ ...data, reply: { messageReference: this.id } }) as Promise<Message<InSpace>>;
  }

  /**
   * Edits the message (only your own; only text and embeds).
   *
   * @param options - Text or {@link MessageEditOptions}.
   */
  public edit(options: string | MessageEditOptions): Promise<Message<InSpace>> {
    return (this.room).messages.edit(this.id, options) as Promise<Message<InSpace>>;
  }

  /** Deletes the message. */
  public async delete(): Promise<this> {
    await (this.room).messages.delete(this.id);
    return this;
  }

  /**
   * Reacts with an emoji: unicode (`'👍'`), a custom emoji (`<:name:id>`, its id, or an
   * {@link Emoji}). Starting a new reaction needs Add Reactions; at most 20 different emoji per message.
   *
   * @param emoji - The emoji.
   */
  public react(emoji: EmojiIdentifierResolvable): Promise<MessageReaction> {
    return (this.room).messages.react(this.id, emoji);
  }

  /**
   * Collects the reactions added to this message, like discord.js's `createReactionCollector()`.
   *
   * @param options - Filter (`(reaction, user) => boolean`), `max`, `maxUsers`, `time`...
   */
  public createReactionCollector(options: ReactionCollectorOptions = {}): ReactionCollector {
    return new ReactionCollector(this, options);
  }

  /**
   * Waits for reactions on this message, like discord.js's `awaitReactions()`: resolves with what was
   * collected once a limit or the time is reached, or rejects with it for an end reason in `errors`.
   *
   * @param options - Filter, `max`, `time`, `errors`...
   * @example
   * ```ts
   * const question = await room.send('Delete everything? React with ✅ to confirm.');
   * await question.react('✅');
   * const confirmed = await question
   *   .awaitReactions({ filter: (reaction, user) => reaction.emoji.name === '✅' && user.id === askerId, max: 1, time: 30_000 })
   *   .then((collected) => collected.size === 1);
   * ```
   */
  public awaitReactions(options: AwaitReactionsOptions = {}): Promise<Collection<string, MessageReaction>> {
    return awaitReactions(this, options);
  }

  /** Pins the message (Manage Messages in spaces; anyone in PMs; at most 50 pins per room). */
  public async pin(): Promise<this> {
    await (this.room).messages.pin(this.id);
    this.pinned = true;
    return this;
  }

  /** Unpins the message. */
  public async unpin(): Promise<this> {
    await (this.room).messages.unpin(this.id);
    this.pinned = false;
    return this;
  }

  /**
   * Fetches the message again.
   *
   * @param force - Skip the cache (default true).
   */
  public fetch(force = true): Promise<Message<InSpace>> {
    return (this.room).messages.fetch({ message: this.id, force }) as Promise<Message<InSpace>>;
  }

  /** Fetches the message this one replies to. */
  public fetchReference(): Promise<Message<InSpace>> {
    if (!this.reference) return Promise.reject(new TypeError('This message is not a reply'));
    return (this.room).messages.fetch(this.reference.messageId) as Promise<Message<InSpace>>;
  }

  /**
   * Starts a thread from this message (Create Public Threads; space text rooms only).
   *
   * @param options - Name and auto-archive duration.
   */
  public startThread(options: Omit<ThreadCreateOptions, 'startMessage' | 'private' | 'invitable'>): Promise<ThreadRoom> {
    const room = this.room;
    if (!room.isTextRoom()) return Promise.reject(new TypeError('Threads can only be started in a space text room'));
    return room.threads.create({ ...options, startMessage: this.id });
  }

  /**
   * Fetches the message's raw data without touching the cache.
   *
   * @internal
   */
  public _fetchRaw(): Promise<APIMessage> {
    return this.client.rest.get<APIMessage>(Routes.roomMessage(this.roomId, this.id));
  }

  /**
   * Whether two messages hold the same id, text and edit time.
   *
   * @param message - The other message.
   */
  public equals(message: Message): boolean {
    return this.id === message.id && this.content === message.content && this.editedTimestamp === message.editedTimestamp;
  }

  /** The text (or `''`). */
  public override toString(): string {
    return this.content ?? '';
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      roomId: this.roomId,
      spaceId: this.spaceId,
      embeds: this.embeds.map((embed) => embed.toJSON()),
      attachments: [...this.attachments.values()].map((a) => a.toJSON()),
      reactions: this.reactions.toJSON(),
    };
  }
}

/**
 * A message the client only knows by id (from a delete or reaction event about an uncached
 * message): `partial` is true and `author`/`content` are `null`. `await message.fetch()` fills it
 * (unless it was deleted).
 */
export type PartialMessage = Omit<Message, 'partial' | 'author' | 'authorId' | 'content'> & {
  readonly partial: true;
  readonly author: null;
  readonly authorId: null;
  readonly content: null;
};

function parseSystem(type: MessageSystemType, payload: string | undefined): MessageSystemData {
  let data: unknown = {};
  if (payload !== undefined && payload !== '') {
    try {
      data = JSON.parse(payload);
    } catch {
      data = {};
    }
  }
  return { type, data } as MessageSystemData;
}

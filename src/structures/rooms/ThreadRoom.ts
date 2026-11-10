import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import { ThreadMemberManager } from '../../managers/ThreadMemberManager.js';
import { Routes } from '../../rest/Routes.js';
import type { APIMessage } from '../../types/api/message.js';
import type { RESTPatchAPIThreadJSONBody } from '../../types/api/rest.js';
import type { APISpaceRoom, APIThreadMetadata, RoomType } from '../../types/api/room.js';
import type { Collection } from '../../util/Collection.js';
import type { PermissionsBitField } from '../../util/PermissionsBitField.js';
import { PermissionFlagsBits } from '../../util/PermissionsBitField.js';
import type { Snowflake } from '../../util/Snowflake.js';
import { parseTimestamp } from '../../util/Util.js';
import type { Message } from '../Message.js';
import type { AwaitMessagesOptions, MessageCollectorOptions } from '../MessageCollector.js';
import { MessageCollector, awaitMessages } from '../MessageCollector.js';
import type { MessageCreateOptions, MessageResolvable } from '../MessagePayload.js';
import type { Space } from '../Space.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseRoom } from './BaseRoom.js';
import type { PermissionsTarget } from './permissions.js';
import { permissionsIn } from './permissions.js';
import { bulkDelete, sendMessage, sendTyping } from './TextBased.js';
import type { TextRoom } from './TextRoom.js';

/** How long a thread stays active without messages, in minutes. */
export type ThreadAutoArchiveDuration = 60 | 1440 | 4320 | 10080;

/** What {@link ThreadRoom.edit} changes. */
export interface ThreadEditOptions {
  /** Name (1-100 characters). */
  name?: string;
  /** Archive or unarchive. */
  archived?: boolean;
  /** Lock (only Manage Threads may post) or unlock. */
  locked?: boolean;
  /** For private threads: whether members may add others. */
  invitable?: boolean;
  /** Minutes without activity before it archives. */
  autoArchiveDuration?: ThreadAutoArchiveDuration;
  /** Slowmode in seconds (0-21600). */
  rateLimitPerUser?: number;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/**
 * A thread (`RoomType.Thread`) under a text room. A thread started from a message has that
 * message's id. Threads use their room's permissions; private threads are visible only to their
 * members and to Manage Threads.
 */
export class ThreadRoom extends BaseRoom {
  declare public readonly type: RoomType.Thread;
  /** The space. */
  declare public readonly space: Space;
  /** The name. */
  declare public name: string;
  /** The text room the thread belongs to. */
  declare public parentId: Snowflake | null;
  /** Who started it. */
  declare public ownerId: Snowflake | null;
  /** Whether it is archived. */
  declare public archived: boolean | null;
  /** Whether it is locked. */
  declare public locked: boolean | null;
  /** Whether it is private. */
  declare public isPrivate: boolean;
  /** For private threads: whether members may add others. */
  declare public invitable: boolean | null;
  /** Minutes without activity before it archives. */
  declare public autoArchiveDuration: number | null;
  /** When it was archived (Unix ms). */
  declare public archiveTimestamp: number | null;
  /** Last activity (Unix ms). */
  declare public lastActiveTimestamp: number | null;
  /** The message it was started from. */
  declare public starterMessageId: Snowflake | null;
  /** Messages in it. */
  declare public messageCount: number | null;
  /** Members in it. */
  declare public memberCount: number | null;
  /**
   * Whether the client has joined it. Known from READY, REST answers and the client's own member
   * events; thread create and update events are built for someone else and do not change it.
   */
  declare public joined: boolean;
  /** Slowmode in seconds. */
  declare public rateLimitPerUser: number;
  /** The newest message's id, when known. */
  declare public lastMessageId: Snowflake | null;
  /** Messages. */
  declare public readonly messages: MessageManager<true>;
  /** Members. */
  declare public readonly members: ThreadMemberManager;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.Thread }, space: Space) {
    super(client, data);
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    Object.defineProperty(this, 'messages', { value: new MessageManager(this), enumerable: false });
    Object.defineProperty(this, 'members', { value: new ThreadMemberManager(this), enumerable: false });
    this.name = '';
    this.parentId = null;
    this.ownerId = null;
    this.archived = null;
    this.locked = null;
    this.isPrivate = false;
    this.invitable = null;
    this.autoArchiveDuration = null;
    this.archiveTimestamp = null;
    this.lastActiveTimestamp = null;
    this.starterMessageId = null;
    this.messageCount = null;
    this.memberCount = null;
    this.joined = false;
    this.rateLimitPerUser = 0;
    this.lastMessageId = null;
    this._patch(data);
  }

  /** @internal */
  public override _patch(data: APIRoomLike & { thread?: Partial<APIThreadMetadata> }): void {
    super._patch(data);
    if (data.name !== undefined) this.name = data.name;
    if (data.parent_id !== undefined) this.parentId = data.parent_id;
    if (data.slowmode_seconds !== undefined) this.rateLimitPerUser = data.slowmode_seconds;
    if (data.last_message_id !== undefined) this.lastMessageId = data.last_message_id;
    const thread = data.thread as Partial<APIThreadMetadata> | undefined;
    if (thread) {
      if (thread.archived !== undefined) this.archived = thread.archived;
      if (thread.locked !== undefined) this.locked = thread.locked;
      if (thread.private !== undefined) this.isPrivate = thread.private;
      if (thread.invitable !== undefined) this.invitable = thread.invitable;
      if (thread.auto_archive_minutes !== undefined) this.autoArchiveDuration = thread.auto_archive_minutes;
      if (thread.owner_id !== undefined) this.ownerId = thread.owner_id;
      if (thread.archived_at !== undefined) this.archiveTimestamp = parseTimestamp(thread.archived_at);
      if (thread.last_active_at !== undefined) this.lastActiveTimestamp = parseTimestamp(thread.last_active_at);
      if (thread.starter_message_id !== undefined) this.starterMessageId = thread.starter_message_id;
      if (thread.message_count !== undefined) this.messageCount = thread.message_count;
      if (thread.member_count !== undefined) this.memberCount = thread.member_count;
      if (thread.joined !== undefined) this.joined = thread.joined;
    }
  }

  /** The space id. */
  public get spaceId(): Snowflake {
    return this.space.id;
  }

  /** The text room it belongs to, when cached. */
  public get parent(): TextRoom | null {
    if (this.parentId === null) return null;
    const parent = this.space.rooms.cache.get(this.parentId);
    return parent?.isTextRoom() ? parent : null;
  }

  /** When it was archived. */
  public get archivedAt(): Date | null {
    return this.archiveTimestamp === null ? null : new Date(this.archiveTimestamp);
  }

  /** The newest message, when cached. */
  public get lastMessage(): Message<true> | null {
    return this.lastMessageId === null ? null : (this.messages.cache.get(this.lastMessageId) ?? null);
  }

  /** Whether the client may post: not locked (unless Manage Threads), and Send Messages In Threads. */
  public get sendable(): boolean {
    const me = this.space.members.me;
    if (!me) return false;
    const perms = this.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.SendMessagesInThreads)) return false;
    return this.locked !== true || perms.has(PermissionFlagsBits.ManageThreads);
  }

  /**
   * Permissions here: the parent room's, and nothing in a private thread for someone who has not
   * joined it and lacks Manage Threads.
   *
   * @param memberOrRole - A member, user, role or id.
   */
  public permissionsFor(memberOrRole: PermissionsTarget): Readonly<PermissionsBitField> | null {
    return permissionsIn(this, memberOrRole);
  }

  /**
   * Sends a message (Send Messages In Threads). Posting in an archived thread unarchives it.
   *
   * @param options - Text or {@link MessageCreateOptions}.
   */
  public send(options: string | MessageCreateOptions): Promise<Message<true>> {
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
   * Deletes up to 100 messages, one request each.
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
   * Edits the thread.
   *
   * @param options - What to change.
   */
  public async edit(options: ThreadEditOptions): Promise<this> {
    const body: RESTPatchAPIThreadJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.archived !== undefined) body.archived = options.archived;
    if (options.locked !== undefined) body.locked = options.locked;
    if (options.invitable !== undefined) body.invitable = options.invitable;
    if (options.autoArchiveDuration !== undefined) body.auto_archive_minutes = options.autoArchiveDuration;
    if (options.rateLimitPerUser !== undefined) body.slowmode_seconds = options.rateLimitPerUser;
    const data = await this.client.rest.patch<APISpaceRoom>(Routes.thread(this.id), { body });
    this._patch(data);
    return this;
  }

  /**
   * Renames the thread.
   *
   * @param name - The name.
   */
  public setName(name: string): Promise<this> {
    return this.edit({ name });
  }

  /**
   * Archives or unarchives it.
   *
   * @param archived - Archived or not.
   */
  public setArchived(archived = true): Promise<this> {
    return this.edit({ archived });
  }

  /**
   * Locks or unlocks it.
   *
   * @param locked - Locked or not.
   */
  public setLocked(locked = true): Promise<this> {
    return this.edit({ locked });
  }

  /**
   * For a private thread: lets members add others, or not.
   *
   * @param invitable - Invitable or not.
   */
  public setInvitable(invitable = true): Promise<this> {
    return this.edit({ invitable });
  }

  /**
   * Sets how long it stays active without messages.
   *
   * @param autoArchiveDuration - Minutes: 60, 1440, 4320 or 10080.
   */
  public setAutoArchiveDuration(autoArchiveDuration: ThreadAutoArchiveDuration): Promise<this> {
    return this.edit({ autoArchiveDuration });
  }

  /**
   * Sets slowmode.
   *
   * @param seconds - 0-21600.
   */
  public setRateLimitPerUser(seconds: number): Promise<this> {
    return this.edit({ rateLimitPerUser: seconds });
  }

  /** Joins the thread. */
  public async join(): Promise<this> {
    await this.members.add('@me');
    return this;
  }

  /** Leaves the thread. */
  public async leave(): Promise<this> {
    await this.members.remove('@me');
    return this;
  }

  /** Fetches the message the thread was started from (in the parent room). */
  public async fetchStarterMessage(): Promise<Message<true> | null> {
    const id = this.starterMessageId ?? this.id;
    const parent = this.parent;
    if (!parent) {
      if (this.parentId === null) return null;
      const data = await this.client.rest.get<APIMessage>(Routes.roomMessage(this.parentId, id));
      const room = await this.client.rooms.fetch(this.parentId);
      return room.isTextBased() ? (room.messages._add(data) as Message<true>) : null;
    }
    return parent.messages.fetch(id);
  }

  /**
   * Deletes the thread (Manage Threads).
   *
   * @param _reason - Ignored.
   */
  public async delete(_reason?: string): Promise<this> {
    await this.client.rest.delete(Routes.thread(this.id));
    this.client.rooms._remove(this.id);
    return this;
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), spaceId: this.spaceId };
  }
}

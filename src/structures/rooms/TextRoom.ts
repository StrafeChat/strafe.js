import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import { ThreadManager } from '../../managers/ThreadManager.js';
import type { RoomType } from '../../types/api/room.js';
import type { APIBridgeSummary } from '../../types/api/bridge.js';
import { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Message } from '../Message.js';
import type { AwaitMessagesOptions, MessageCollectorOptions } from '../MessageCollector.js';
import { MessageCollector, awaitMessages } from '../MessageCollector.js';
import type { MessageCreateOptions, MessageResolvable } from '../MessagePayload.js';
import type { Space } from '../Space.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseSpaceRoom } from './BaseSpaceRoom.js';
import { bulkDelete, sendMessage, sendTyping } from './TextBased.js';
import type { Bridge, BridgeCreateOptions } from '../Bridge.js';
import type { Webhook, WebhookCreateOptions } from '../Webhook.js';
import { createBridge, createWebhook, fetchBridges, fetchWebhooks } from './webhooks.js';

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
   * What the room is bridged with, from READY and kept current by the `BRIDGE_*` events: everyone
   * who can view a room may know. Bridges the client's bot drives are full objects (also in
   * `client.bridges`); others are summaries (`settings` is `null`).
   */
  declare public readonly bridges: Collection<Snowflake, Bridge>;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.SpaceText }, space: Space) {
    super(client, data, space);
    Object.defineProperty(this, 'messages', { value: new MessageManager(this), enumerable: false });
    Object.defineProperty(this, 'threads', { value: new ThreadManager(this), enumerable: false });
    Object.defineProperty(this, 'bridges', { value: new Collection<Snowflake, Bridge>(), enumerable: false });
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
    if (data.bridges !== undefined) this._setBridges(data.bridges);
  }

  /**
   * Replaces the room's bridges with a list of summaries (or full bridges).
   *
   * @internal
   */
  public _setBridges(list: readonly APIBridgeSummary[]): void {
    const keep = new Set(list.map((data) => data.id));
    for (const id of [...this.bridges.keys()]) if (!keep.has(id)) this.bridges.delete(id);
    for (const data of list) this.client.bridges._add(data, this);
  }

  /** Whether the room is bridged with another platform. */
  public get bridged(): boolean {
    return this.bridges.size > 0;
  }

  /**
   * Creates a webhook (Manage Webhooks). The answer is the only time its token and URL are shown:
   * store them.
   *
   * @param options - Name, avatar, mass mentions, reason.
   * @throws {@link WebhookAPIError} `room_encrypted` in an end-to-end encrypted room, `webhook_limit` past 15 per room.
   * @example
   * ```ts
   * const hook = await room.createWebhook({ name: 'CI', avatar: new URL('./ci.png', import.meta.url) });
   * await saveSecret(hook.url);
   * ```
   */
  public createWebhook(options: WebhookCreateOptions): Promise<Webhook> {
    return createWebhook(this, options);
  }

  /** Fetches the room's webhooks (Manage Webhooks). Lists never carry tokens. */
  public fetchWebhooks(): Promise<Collection<Snowflake, Webhook>> {
    return fetchWebhooks(this);
  }

  /**
   * Bridges the room with another platform, driven by the client's bot (it needs Manage Webhooks
   * and Masquerade here). The room gets a notice saying so, and the bridge's feed starts arriving
   * as {@link Events.BridgeMessageCreate}.
   *
   * @param options - Platform, name, remote, settings.
   * @throws {@link BridgeAPIError} `private_room_ack_required` for a room not everyone can see
   *   (pass `acknowledgePrivate`), `room_encrypted`, `bridge_limit` past 3 per room.
   * @example
   * ```ts
   * const bridge = await room.createBridge({
   *   platform: 'discord',
   *   name: 'Discord #general',
   *   remote: { name: 'Example #general', url: 'https://discord.gg/example' },
   * });
   * ```
   */
  public createBridge(options: BridgeCreateOptions): Promise<Bridge> {
    return createBridge(this, options);
  }

  /** Fetches what the room is bridged with (anyone who can view it), refreshing {@link TextRoom.bridges}. */
  public fetchBridges(): Promise<Collection<Snowflake, Bridge>> {
    return fetchBridges(this);
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

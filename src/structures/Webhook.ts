import type { Client } from '../client/Client.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { APIMessage } from '../types/api/message.js';
import type { APIWebhook, RESTPatchAPIWebhookJSONBody, RESTPostAPIRoomWebhookJSONBody } from '../types/api/webhook.js';
import { WebhookType } from '../types/api/webhook.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { emptyToNull, parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { Message } from './Message.js';
import type { MessageResolvable } from './MessagePayload.js';
import type { TextBasedRoom, TextRoom, VoiceRoom } from './rooms/index.js';
import type { Space } from './Space.js';
import type { User } from './User.js';
import type { WebhookCredentials, WebhookFetchMessageOptions, WebhookMessageCreateOptions, WebhookMessageEditOptions } from './WebhookPayload.js';
import { deleteWebhookMessage, editWebhookMessage, executeWebhook, fetchWebhookMessage, resolveImageDataURI } from './WebhookPayload.js';

/** What `room.createWebhook()` takes. */
export interface WebhookCreateOptions {
  /** Name, 1-80 characters (no reserved names, names of the space's owner or moderators, or role names). */
  name: string;
  /** Avatar: a file, URL or `data:` URI (PNG, JPEG, GIF or WebP). */
  avatar?: BufferResolvable | null | undefined;
  /** Let it ping `@everyone`, `@here` and roles (you need Mention Everyone in the room). Off by default. */
  massMentions?: boolean | undefined;
  /** Audit-log reason. */
  reason?: string | undefined;
}

/** What `webhook.edit()` takes. */
export interface WebhookEditOptions {
  /** New name. */
  name?: string | undefined;
  /** New avatar, or `null` to remove it. */
  avatar?: BufferResolvable | null | undefined;
  /** Move it to another plaintext room of the same space (Manage Webhooks in both). */
  room?: TextRoom | VoiceRoom | Snowflake | undefined;
  /** Let it ping `@everyone`, `@here` and roles. */
  massMentions?: boolean | undefined;
  /** Audit-log reason. */
  reason?: string | undefined;
}

/**
 * Builds the body of a webhook create or edit, reading the avatar into a `data:` URI.
 *
 * @internal
 */
export async function webhookBody(
  client: Client,
  options: WebhookCreateOptions | WebhookEditOptions,
): Promise<RESTPostAPIRoomWebhookJSONBody & RESTPatchAPIWebhookJSONBody> {
  const body: RESTPatchAPIWebhookJSONBody = {};
  if (options.name !== undefined) body.name = options.name;
  if (options.avatar === null) body.avatar = null;
  else if (options.avatar !== undefined) body.avatar = await resolveImageDataURI(options.avatar, client.rest.options.makeRequest);
  if (options.massMentions !== undefined) body.mass_mentions = options.massMentions;
  if (options.reason !== undefined) body.reason = options.reason;
  if ('room' in options && options.room !== undefined) body.room_id = typeof options.room === 'string' ? options.room : options.room.id;
  return body as RESTPostAPIRoomWebhookJSONBody & RESTPatchAPIWebhookJSONBody;
}

/**
 * An incoming webhook: anything holding its token posts into its room under the name and avatar it
 * asks for, with a **WEBHOOK** tag. Compatible with Discord's: a tool that posts to a Discord
 * webhook works by changing the host.
 *
 * The token comes back only from `room.createWebhook()` and {@link Webhook.resetToken}; a webhook
 * from a list or a get has none, and can then be executed only by the bot that made it. To post
 * without logging in, use {@link WebhookClient}.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `Webhook`.
 *
 * @example
 * ```ts
 * const hook = await room.createWebhook({ name: 'CI' });
 * console.log(hook.url); // store it now: it is never shown again
 * await hook.send({ content: 'Build #42 passed', username: 'CI', allowedMentions: { parse: [] } });
 * ```
 */
export class Webhook extends Base {
  /** The id. */
  declare public readonly id: Snowflake;
  /** {@link WebhookType.Incoming}. */
  declare public type: WebhookType;
  /** The space. */
  declare public spaceId: Snowflake;
  /** The room it posts into. */
  declare public roomId: Snowflake;
  /** Default name of its messages. */
  declare public name: string;
  /** Default avatar URL, or `null`. */
  declare public avatar: string | null;
  /** The application whose bot made it (that bot manages and executes it without Manage Webhooks), or `null`. */
  declare public applicationId: Snowflake | null;
  /** Who made it, when the server said (not on token-authenticated reads). */
  declare public owner: User | null;
  /** Whether it may ping `@everyone`, `@here` and roles at all. */
  declare public massMentions: boolean;
  /** `encrypted` while its room is end-to-end encrypted (it cannot post), else `null`. */
  declare public disabledReason: 'encrypted' | null;
  /** When it was made (Unix ms). */
  declare public createdTimestamp: number;
  /** When it last posted (Unix ms), or `null`. */
  declare public lastUsedTimestamp: number | null;
  /** @internal */
  declare public _token: string | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   */
  public constructor(client: Client, data: APIWebhook) {
    super(client);
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    // Not enumerable, so `console.log(webhook)` and `JSON.stringify()` never print the token.
    Object.defineProperty(this, '_token', { value: null, enumerable: false, writable: true });
    this.owner = null;
    this.avatar = null;
    this.applicationId = null;
    this.massMentions = false;
    this.disabledReason = null;
    this.lastUsedTimestamp = null;
    this.createdTimestamp = SnowflakeUtil.timestampFrom(data.id);
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIWebhook>): void {
    if (data.type !== undefined) this.type = data.type;
    if (data.space_id !== undefined) this.spaceId = data.space_id;
    if (data.room_id !== undefined) this.roomId = data.room_id;
    if (data.name !== undefined) this.name = data.name;
    if (data.avatar !== undefined) this.avatar = emptyToNull(data.avatar);
    if (data.application_id !== undefined) this.applicationId = data.application_id;
    if (data.creator !== undefined) this.owner = this.client.users._add(data.creator);
    if (data.mass_mentions !== undefined) this.massMentions = data.mass_mentions;
    if (data.disabled_reason !== undefined) this.disabledReason = data.disabled_reason;
    if (data.created_at !== undefined) this.createdTimestamp = parseTimestamp(data.created_at) ?? this.createdTimestamp;
    if (data.last_used_at !== undefined) this.lastUsedTimestamp = parseTimestamp(data.last_used_at);
    if (typeof data.token === 'string' && data.token !== '') this._token = data.token;
  }

  /**
   * The secret token, when this object came from a create or a token reset (`null` otherwise).
   * Never logged or serialized; treat it like a password.
   */
  public get token(): string | null {
    return this._token;
  }

  /** The execute URL with the token (Discord's form), or `null` without a token. Treat it like a password. */
  public get url(): string | null {
    return this._token === null ? null : `${this.client.rest.api}/webhooks/${this.id}/${this._token}`;
  }

  /** The room, when cached. */
  public get room(): TextRoom | VoiceRoom | null {
    const room = this.client.rooms.cache.get(this.roomId);
    return room !== undefined && (room.isTextRoom() || room.isVoiceBased()) ? room : null;
  }

  /** The space, when cached. */
  public get space(): Space | null {
    return this.client.spaces.cache.get(this.spaceId) ?? null;
  }

  /** When it was made. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** When it last posted. */
  public get lastUsedAt(): Date | null {
    return this.lastUsedTimestamp === null ? null : new Date(this.lastUsedTimestamp);
  }

  /** Whether it cannot post right now (its room is end-to-end encrypted). */
  public get disabled(): boolean {
    return this.disabledReason !== null;
  }

  /** Whether the client's bot made it, and so may manage and execute it with its own token. */
  public get ownedByClient(): boolean {
    return this.applicationId !== null && this.applicationId === this.client._userId;
  }

  /** Whether this is an incoming webhook (bridges are listed by `room.fetchBridges()`, not here). */
  public isIncoming(): boolean {
    return this.type === WebhookType.Incoming;
  }

  /** @internal */
  private credentials(): WebhookCredentials {
    if (this._token !== null) return { id: this.id, token: this._token, tokenInURL: false };
    if (this.ownedByClient) return { id: this.id, token: null, tokenInURL: false };
    throw new StrafeError(ErrorCodes.WebhookTokenMissing);
  }

  /** Fetches the webhook again (Manage Webhooks in its room, or its owning bot). */
  public async fetch(): Promise<this> {
    this._patch(await this.client.rest.get<APIWebhook>(Routes.webhook(this.id)));
    return this;
  }

  /**
   * Edits the webhook (Manage Webhooks in its room, or its owning bot). Every change is audit-logged
   * and fires {@link Events.WebhooksUpdate}.
   *
   * @param options - Name, avatar, room, mass mentions.
   * @example
   * ```ts
   * await hook.edit({ name: 'CI bot', room: otherRoom });
   * ```
   */
  public async edit(options: WebhookEditOptions): Promise<this> {
    const body = await webhookBody(this.client, options);
    this._patch(await this.client.rest.patch<APIWebhook>(Routes.webhook(this.id), { body }));
    return this;
  }

  /**
   * Deletes the webhook. Its messages stay.
   *
   * @param reason - Audit-log reason.
   */
  public async delete(reason?: string): Promise<void> {
    await this.client.rest.delete(Routes.webhook(this.id), reason === undefined ? {} : { body: { reason } });
  }

  /**
   * Makes a new token: the old one (and every copy of the URL) stops working at once. Afterwards
   * {@link Webhook.token} and {@link Webhook.url} hold the new ones; store them, they are not shown
   * again.
   *
   * @param reason - Audit-log reason.
   */
  public async resetToken(reason?: string): Promise<this> {
    this._patch(await this.client.rest.post<APIWebhook>(Routes.webhookTokenReset(this.id), reason === undefined ? {} : { body: { reason } }));
    return this;
  }

  /**
   * Posts a message through the webhook: with its token, or as the bot that made it.
   *
   * @param options - Text or {@link WebhookMessageCreateOptions}.
   * @returns The message (in the room's cache), or `undefined` with `wait: false`.
   * @throws {@link StrafeError} `WebhookTokenMissing` without a token when the client's bot did not make it.
   * @example
   * ```ts
   * await hook.send({ content: 'Deployed', username: 'Deploy bot', embeds: [embed] });
   * ```
   */
  public send(options: WebhookMessageCreateOptions & { wait: false }): Promise<undefined>;
  public send(options: string | WebhookMessageCreateOptions): Promise<Message>;
  public async send(options: string | WebhookMessageCreateOptions): Promise<Message | undefined> {
    const data = await executeWebhook(this.client.rest, this.credentials(), options);
    return data === undefined ? undefined : this.toMessage(data);
  }

  /**
   * Fetches a message this webhook posted.
   *
   * @param message - The message or its id.
   * @param options - The thread it is in.
   */
  public async fetchMessage(message: MessageResolvable, options: WebhookFetchMessageOptions = {}): Promise<Message> {
    return this.toMessage(await fetchWebhookMessage(this.client.rest, this.credentials(), idOf(message), options));
  }

  /**
   * Edits a message this webhook posted: text, embeds, files, allowed mentions.
   *
   * @param message - The message or its id.
   * @param options - Text or {@link WebhookMessageEditOptions}.
   */
  public async editMessage(message: MessageResolvable, options: string | WebhookMessageEditOptions): Promise<Message> {
    return this.toMessage(await editWebhookMessage(this.client.rest, this.credentials(), idOf(message), options));
  }

  /**
   * Deletes a message this webhook posted (moderators delete it like any other, with Manage Messages).
   *
   * @param message - The message or its id.
   * @param options - The thread it is in.
   */
  public async deleteMessage(message: MessageResolvable, options: WebhookFetchMessageOptions = {}): Promise<void> {
    await deleteWebhookMessage(this.client.rest, this.credentials(), idOf(message), options);
  }

  /** Caches a message the webhook API returned in its room. @internal */
  private async toMessage(data: APIMessage): Promise<Message> {
    const room = await textRoom(this.client, data.room_id);
    return room.messages._add(data);
  }

  /** Plain JSON, without the token. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), owner: this.owner?.id ?? null };
  }
}

function idOf(message: MessageResolvable): Snowflake {
  return typeof message === 'string' ? message : message.id;
}

/**
 * The text-based room of an id, from the cache or fetched.
 *
 * @internal
 */
export async function textRoom(client: Client, roomId: Snowflake): Promise<TextBasedRoom> {
  const room = client.rooms.cache.get(roomId) ?? (await client.rooms.fetch(roomId));
  if (!room.isTextBased()) throw new StrafeError(ErrorCodes.RoomNotTextBased);
  return room;
}

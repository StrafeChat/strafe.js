import type { Client } from '../client/Client.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeRangeError, StrafeTypeError } from '../errors/StrafeError.js';
import { APIErrorCodes, BridgeAPIError } from '../errors/APIErrors.js';
import { BridgeBlockManager, BridgePuppetManager } from '../managers/BridgePuppetManager.js';
import { Routes } from '../rest/Routes.js';
import type { RouteLike } from '../rest/types.js';
import type {
  APIBridge,
  APIBridgeExternalLookup,
  APIBridgeExternalRef,
  APIBridgeMapEntry,
  APIBridgeSendResult,
  APIBridgeSettings,
  APIBridgeSummary,
  APIExternalUser,
  BridgeDriver,
  BridgePlatform,
  BridgeState,
  BridgeStateReason,
  GatewayBridgeMessageCreateData,
  RESTPatchAPIBridgeJSONBody,
  RESTPatchAPIBridgeMessageJSONBody,
  RESTPostAPIBridgeMessageJSONBody,
  RESTPostAPIRoomBridgeJSONBody,
} from '../types/api/bridge.js';
import type { APIMessage } from '../types/api/message.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { codePointLength, emptyToNull, parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import { Emoji } from './Emoji.js';
import type { EmojiIdentifierResolvable } from './Emoji.js';
import { Message } from './Message.js';
import type { EmbedResolvable, FileResolvable } from './MessagePayload.js';
import { MaxMessageLength, resolveEmbeds } from './MessagePayload.js';
import type { TextRoom } from './rooms/TextRoom.js';
import type { Space } from './Space.js';
import type { User } from './User.js';
import { textRoom } from './Webhook.js';
import { resolveImageDataURI, resolveSendFiles, withFiles } from './WebhookPayload.js';

/** How often, and how far apart (ms, growing), a send answered `send_in_progress` is tried again. */
const SEND_IN_PROGRESS_RETRIES = 3;
const SEND_IN_PROGRESS_DELAY = 250;

/** A bridge's switches, camelCased ({@link APIBridgeSettings}). */
export interface BridgeSettings {
  /** Copy bots' and webhooks' messages to the platform (off by default). */
  relayBots: boolean;
  /** Copy what other bridges post here (off: a room bridged twice does not cross-feed). */
  relayOtherBridges: boolean;
  /** A bridged reply may notify the person it answers (on by default). */
  replyPings: boolean;
  /** Bridged users may carry a name colour (turning it on needs Manage Roles). */
  allowColour: boolean;
  /** Cards offer the bridged user's profile on their platform. */
  showProfileLinks: boolean;
}

/** What a room is bridged with. */
export interface BridgeRemote {
  /** Name (1-100), shown on the room's bridge badge. */
  name: string;
  /** An `https://` link to it, or `null`. */
  url: string | null;
}

/** What `room.createBridge()` takes. */
export interface BridgeCreateOptions {
  /** The platform: `discord`, `matrix`, `irc`, `telegram`, `slack`, `xmpp`, `revolt` or `other`. */
  platform: BridgePlatform;
  /** The label shown on the tag for `other` (1-32, required then: "Mastodon"). */
  platformName?: string | undefined;
  /** The bridge's name (1-80): "Discord #general". */
  name: string;
  /** An avatar: a file, URL or `data:` URI. */
  avatar?: BufferResolvable | undefined;
  /** What the room is bridged with: shown to everyone in it. */
  remote?: { name: string; url?: string | undefined } | undefined;
  /** Initial switches (the rest keep their defaults). */
  settings?: Partial<BridgeSettings> | undefined;
  /**
   * Bridge a room that not everyone in the space can see: its messages leave the room's audience.
   * Without it such a room answers {@link BridgeAPIError} `private_room_ack_required`.
   */
  acknowledgePrivate?: boolean | undefined;
  /** Audit-log reason. */
  reason?: string | undefined;
}

/** What `bridge.edit()` takes. The driving bot may change the name, avatar, remote and state; the switches need Manage Webhooks. */
export interface BridgeEditOptions {
  /** New name. */
  name?: string | undefined;
  /** New avatar, or `null` to remove it. */
  avatar?: BufferResolvable | null | undefined;
  /** New remote, or `null` to clear it. */
  remote?: { name: string; url?: string | undefined } | null | undefined;
  /** Switches to change. */
  settings?: Partial<BridgeSettings> | undefined;
  /** Pause or resume. */
  state?: 'active' | 'paused' | undefined;
  /** Needed to resume in a room not everyone can see. */
  acknowledgePrivate?: boolean | undefined;
  /** Audit-log reason. */
  reason?: string | undefined;
}

/** The person on the other platform a bridged message speaks for. */
export interface BridgeExternalUser {
  /** Their id on the other platform (1-128 printable characters). Never shown to readers. */
  id: string;
  /** Their name (1-32; no reserved, staff or role names). A member's name is allowed; clients say it is not that member. */
  name: string;
  /** Their picture: `https://` (up to 512 characters) or `attachment://<filename>` of a file in the send. */
  avatarURL?: string | null | undefined;
  /** A name colour `0xRRGGBB`, only when the bridge has `allowColour`. */
  colour?: number | null | undefined;
  /** A bot on the other platform. */
  bot?: boolean | undefined;
  /** Their profile there (`https://`), shown only with `showProfileLinks`. */
  profileURL?: string | null | undefined;
}

/**
 * A message a bridge acts on: a string is the **other platform's** message id (the common case),
 * `{ externalMessageId, part }` the same with a part, `{ messageId }` or a {@link Message} a Strafe
 * message.
 */
export type BridgeMessageResolvable = string | { externalMessageId: string; part?: number | undefined } | { messageId: Snowflake } | Message;

/** What `bridge.send()` takes. */
export interface BridgeSendOptions {
  /** Who said it on the other platform. */
  externalUser: BridgeExternalUser;
  /**
   * The message's id on the other platform (1-256 printable ASCII). With `part` it makes the send
   * idempotent: a retry answers the message already posted (`duplicate: true`), so a send is
   * safe to repeat after a timeout.
   */
  externalMessageId: string;
  /** Which piece of a long external message this is (0-9, default 0). */
  part?: number | undefined;
  /** Text (at most 4000 code points). Mentions in it never notify, except the reply ping below. */
  content?: string | null | undefined;
  /** Embeds (at most 10; need `@everyone` to have Embed Links in the room). */
  embeds?: readonly EmbedResolvable[] | undefined;
  /** Files (at most 10; need `@everyone` to have Attach Files). */
  files?: readonly FileResolvable[] | undefined;
  /**
   * The message it answers: one this bridge posted or linked (`{ externalMessageId, part? }`, or the
   * external id as a string), or any message of the room (`{ messageId }` or a {@link Message}). An
   * unknown one is dropped and the send goes through (`replyDropped: true`).
   */
  replyTo?: BridgeMessageResolvable | undefined;
  /** Whether a reply notifies the person it answers (only when the bridge has `replyPings`; default yes). */
  repliedUser?: boolean | undefined;
}

/** What `bridge.send()` resolves with. */
export interface BridgeSendResult {
  /** The message (cached in its room), or `null` when it was posted before and has since been deleted. */
  message: Message | null;
  /** The message's id. */
  messageId: Snowflake;
  /** The bridged user's id on Strafe (moderators block by it). */
  puppetId: Snowflake;
  /** The same external message id and part was posted before: `message` is that message. */
  duplicate: boolean;
  /** `replyTo` named an unknown message, so it was sent without the reply. */
  replyDropped: boolean;
}

/** What `bridge.editMessage()` takes. */
export interface BridgeMessageEditOptions {
  /** New text. */
  content?: string | null | undefined;
  /** New embeds; `[]` or `null` removes them. */
  embeds?: readonly EmbedResolvable[] | null | undefined;
  /** Which part of the external message (default: the first). */
  part?: number | undefined;
}

/** Where a bridge copied a message: the copy's id on the platform and its part. */
export interface BridgeExternalMessage {
  /** The copy's id on the other platform. */
  externalMessageId: string;
  /** The part. */
  part: number;
}

/** One entry of a bridge's id map. */
export interface BridgeMessageLink extends BridgeExternalMessage {
  /** The Strafe message. */
  messageId: Snowflake;
  /** Its room. */
  roomId: Snowflake;
  /** `inbound`: the bridge posted it here; `outbound`: a Strafe message the bridge copied out ({@link Bridge.link}). */
  direction: 'inbound' | 'outbound';
}

/** A message of the bridge's feed (`bridgeMessageCreate`, and the backlog). */
export interface BridgeFeedMessage {
  /** The message (cached in its room). */
  message: Message;
  /** The copy of the message it answers, when this bridge has one: reply to that on the platform. */
  replyExternal: BridgeExternalMessage | null;
}

/** What `bridge.backlog()` and `fetchBacklog()` take. */
export interface BridgeBacklogOptions {
  /** Start after this message (default: when the bridge was made). */
  after?: Snowflake | Message | undefined;
  /** Messages per request (1-100, default 100). */
  limit?: number | undefined;
}

/** What `bridge.react()` and `unreact()` take: who reacts. */
export interface BridgeReactOptions {
  /** The person's id on the other platform. */
  externalUserId: string;
  /** Their name and picture, to remember them if this is the first thing they do (adding only). */
  externalUser?: Omit<BridgeExternalUser, 'id'> | undefined;
}

/** Turns wire settings into {@link BridgeSettings}. @internal */
export function bridgeSettings(data: APIBridgeSettings): BridgeSettings {
  return {
    relayBots: data.relay_bots,
    relayOtherBridges: data.relay_other_bridges,
    replyPings: data.reply_pings,
    allowColour: data.allow_colour,
    showProfileLinks: data.show_profile_links,
  };
}

/** Turns {@link BridgeSettings} into a wire patch. @internal */
export function settingsToAPI(settings: Partial<BridgeSettings>): Partial<APIBridgeSettings> {
  const out: Partial<APIBridgeSettings> = {};
  if (settings.relayBots !== undefined) out.relay_bots = settings.relayBots;
  if (settings.relayOtherBridges !== undefined) out.relay_other_bridges = settings.relayOtherBridges;
  if (settings.replyPings !== undefined) out.reply_pings = settings.replyPings;
  if (settings.allowColour !== undefined) out.allow_colour = settings.allowColour;
  if (settings.showProfileLinks !== undefined) out.show_profile_links = settings.showProfileLinks;
  return out;
}

/** Turns a wire external ref into {@link BridgeExternalMessage}. @internal */
export function externalRef(data: APIBridgeExternalRef): BridgeExternalMessage {
  return { externalMessageId: data.external_message_id, part: data.part };
}

function mapEntry(data: APIBridgeMapEntry): BridgeMessageLink {
  return { messageId: data.message_id, roomId: data.room_id, part: data.part, direction: data.direction, externalMessageId: data.external_message_id };
}

function remoteBody(remote: { name: string; url?: string | undefined }): { name: string; url?: string } {
  return remote.url === undefined ? { name: remote.name } : { name: remote.name, url: remote.url };
}

/**
 * Builds the body of a bridge create.
 *
 * @internal
 */
export async function bridgeCreateBody(client: Client, options: BridgeCreateOptions): Promise<RESTPostAPIRoomBridgeJSONBody> {
  const body: RESTPostAPIRoomBridgeJSONBody = { platform: options.platform, name: options.name };
  if (options.platformName !== undefined) body.platform_name = options.platformName;
  if (options.avatar !== undefined) body.avatar = await resolveImageDataURI(options.avatar, client.rest.options.makeRequest);
  if (options.remote !== undefined) body.remote = remoteBody(options.remote);
  if (options.settings !== undefined) body.settings = settingsToAPI(options.settings);
  if (options.acknowledgePrivate !== undefined) body.acknowledge_private = options.acknowledgePrivate;
  if (options.reason !== undefined) body.reason = options.reason;
  return body;
}

function externalUserBody(user: Partial<BridgeExternalUser>): Partial<APIExternalUser> {
  const out: Partial<APIExternalUser> = {};
  if (user.id !== undefined) out.id = user.id;
  if (user.name !== undefined) out.name = user.name;
  if (user.avatarURL !== undefined) out.avatar_url = user.avatarURL;
  if (user.colour !== undefined) out.colour = user.colour;
  if (user.bot !== undefined) out.bot = user.bot;
  if (user.profileURL !== undefined) out.profile_url = user.profileURL;
  return out;
}

/**
 * A bridge: a room integration for one other platform, driven by a bot that holds Manage Webhooks
 * and Masquerade. Through it the bot posts what people say over there as **bridged users** (each
 * message tagged with the platform, and the bot named as its real sender), and it reads the room
 * back from a filtered feed ({@link Events.BridgeMessageCreate} and friends) to post on the other
 * side. The server keeps the id map, applies the room's rules to each bridged user, prevents loops
 * and enforces people's consent.
 *
 * Bridges the client's bot drives are in `client.bridges.cache` from READY. A room's bridges (any
 * driver: everyone may know what their room is bridged with) are in `room.bridges`; those not
 * driven by this bot are summaries (`settings` is `null`).
 *
 * @example
 * ```ts
 * const bridge = await room.createBridge({ platform: 'discord', name: 'Discord #general', remote: { name: 'Example #general' } });
 * await bridge.send({
 *   externalUser: { id: '81726354', name: 'Alice', avatarURL: 'https://cdn.discordapp.com/avatars/81726354/ab12.png' },
 *   externalMessageId: '1300000000000000',
 *   content: 'hello from the other side',
 * });
 * ```
 */
export class Bridge extends Base {
  /** The id. */
  declare public readonly id: Snowflake;
  /** The space. */
  declare public spaceId: Snowflake;
  /** The room it bridges. */
  declare public roomId: Snowflake;
  /** Its name. */
  declare public name: string;
  /** Its avatar URL, or `null`. */
  declare public avatar: string | null;
  /** The platform. */
  declare public platform: BridgePlatform;
  /** An `other` platform's label, or `null`. */
  declare public platformName: string | null;
  /** What the room is bridged with, or `null`. */
  declare public remote: BridgeRemote | null;
  /** Who drives it (`bot`). */
  declare public driver: BridgeDriver;
  /** The driving bot's user id, or `null`. */
  declare public driverId: Snowflake | null;
  /** The driving bot's application id, or `null`. */
  declare public applicationId: Snowflake | null;
  /** The driving bot's display name, or `null`. */
  declare public driverName: string | null;
  /** `active`, `paused` or `disabled`. */
  declare public state: BridgeState;
  /** Why it is not active, or `null`. */
  declare public stateReason: BridgeStateReason | null;
  /** Its switches; `null` on a summary (a bridge another bot drives, seen by a non-manager). */
  declare public settings: BridgeSettings | null;
  /** Who made it, when known. */
  declare public creator: User | null;
  /** When it was made (Unix ms). */
  declare public createdTimestamp: number;
  /** When it last changed (Unix ms), when known. */
  declare public updatedTimestamp: number | null;
  /** When it last posted (Unix ms), when known. */
  declare public lastUsedTimestamp: number | null;
  /** The bridged users it remembers (the driving bot only). */
  declare public readonly puppets: BridgePuppetManager;
  /** Moderators' blocks of bridged users (Kick Members or Manage Messages in the room). */
  declare public readonly blocks: BridgeBlockManager;

  /**
   * @param client - The client.
   * @param data - Wire data: the full bridge or its summary.
   */
  public constructor(client: Client, data: Partial<APIBridge> & { id: Snowflake }) {
    super(client);
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    Object.defineProperty(this, 'puppets', { value: new BridgePuppetManager(this), enumerable: false });
    Object.defineProperty(this, 'blocks', { value: new BridgeBlockManager(this), enumerable: false });
    this.spaceId = '';
    this.roomId = '';
    this.name = '';
    this.avatar = null;
    this.platform = 'other';
    this.platformName = null;
    this.remote = null;
    this.driver = 'bot';
    this.driverId = null;
    this.applicationId = null;
    this.driverName = null;
    this.state = 'active';
    this.stateReason = null;
    this.settings = null;
    this.creator = null;
    this.createdTimestamp = SnowflakeUtil.timestampFrom(data.id);
    this.updatedTimestamp = null;
    this.lastUsedTimestamp = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIBridge>): void {
    if (data.space_id !== undefined) this.spaceId = data.space_id;
    if (data.room_id !== undefined) this.roomId = data.room_id;
    if (data.name !== undefined) this.name = data.name;
    if (data.avatar !== undefined) this.avatar = emptyToNull(data.avatar);
    if (data.platform !== undefined) this.platform = data.platform;
    if (data.platform_name !== undefined) this.platformName = emptyToNull(data.platform_name);
    if (data.remote !== undefined) this.remote = data.remote === null ? null : { name: data.remote.name, url: data.remote.url };
    if (data.driver !== undefined) this.driver = data.driver;
    if (data.driver_id !== undefined) this.driverId = data.driver_id;
    if (data.application_id !== undefined) this.applicationId = data.application_id;
    if (data.driver_name !== undefined) this.driverName = data.driver_name;
    if (data.state !== undefined) this.state = data.state;
    if (data.state_reason !== undefined) this.stateReason = data.state_reason;
    if (data.settings !== undefined) this.settings = bridgeSettings(data.settings);
    if (data.creator !== undefined) this.creator = data.creator === null ? null : this.client.users._add(data.creator);
    if (data.created_at !== undefined) this.createdTimestamp = parseTimestamp(data.created_at) ?? this.createdTimestamp;
    if (data.updated_at !== undefined) this.updatedTimestamp = parseTimestamp(data.updated_at);
    if (data.last_used_at !== undefined) this.lastUsedTimestamp = parseTimestamp(data.last_used_at);
  }

  /** The room, when cached. */
  public get room(): TextRoom | null {
    const room = this.client.rooms.cache.get(this.roomId);
    return room?.isTextRoom() ? room : null;
  }

  /** The space, when cached. */
  public get space(): Space | null {
    return this.client.spaces.cache.get(this.spaceId) ?? null;
  }

  /** When it was made. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** Whether it is running. */
  public get active(): boolean {
    return this.state === 'active';
  }

  /** Whether it is paused (by a manager, its bot, or because the room became private). */
  public get paused(): boolean {
    return this.state === 'paused';
  }

  /** Whether the client's bot drives it (and so may send through it and receives its feed). */
  public get driven(): boolean {
    return this.driverId !== null && this.driverId === this.client._userId;
  }

  /** Whether only the public summary is known (`settings` is `null`). */
  public get partial(): boolean {
    return this.settings === null;
  }

  /** Fetches the full bridge (Manage Webhooks in its room, or its bot). */
  public async fetch(): Promise<this> {
    this._patch(await this.client.rest.get<APIBridge>(Routes.bridge(this.id)));
    return this;
  }

  /**
   * Changes the bridge: name, avatar, remote and state (its bot, or Manage Webhooks), switches
   * (Manage Webhooks; `allowColour: true` also needs Manage Roles). A bridge cannot move to
   * another room: people agreed to this one.
   *
   * @param options - What to change.
   */
  public async edit(options: BridgeEditOptions): Promise<this> {
    const body: RESTPatchAPIBridgeJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.avatar === null) body.avatar = null;
    else if (options.avatar !== undefined) body.avatar = await resolveImageDataURI(options.avatar, this.client.rest.options.makeRequest);
    if (options.remote === null) body.remote = null;
    else if (options.remote !== undefined) body.remote = remoteBody(options.remote);
    if (options.settings !== undefined) body.settings = settingsToAPI(options.settings);
    if (options.state !== undefined) body.state = options.state;
    if (options.acknowledgePrivate !== undefined) body.acknowledge_private = options.acknowledgePrivate;
    if (options.reason !== undefined) body.reason = options.reason;
    const data = await this.client.rest.patch<APIBridge>(Routes.bridge(this.id), { body });
    return this.client.bridges._add(data) as this;
  }

  /**
   * Changes some switches, keeping the others.
   *
   * @param settings - The switches to change.
   */
  public setSettings(settings: Partial<BridgeSettings>): Promise<this> {
    return this.edit({ settings });
  }

  /**
   * Pauses the bridge: sends are refused (`bridge_inactive`) and the feed stops until it resumes.
   * A pause by its bot can be lifted by the bot; a manager's only by a manager.
   *
   * @param reason - Audit-log reason.
   */
  public pause(reason?: string): Promise<this> {
    return this.edit({ state: 'paused', reason });
  }

  /**
   * Resumes the bridge.
   *
   * @param options - `acknowledgePrivate` for a room not everyone can see; audit-log reason.
   */
  public resume(options: { acknowledgePrivate?: boolean | undefined; reason?: string | undefined } = {}): Promise<this> {
    return this.edit({ state: 'active', ...options });
  }

  /**
   * Removes the bridge (its bot, or Manage Webhooks). The room gets the "unbridged" notice; the
   * messages stay.
   *
   * @param reason - Audit-log reason.
   */
  public async delete(reason?: string): Promise<void> {
    await this.client.rest.delete(Routes.bridge(this.id), reason === undefined ? {} : { body: { reason } });
    this.client.bridges._delete(this.id, this.roomId);
  }

  /**
   * Posts as a bridged user: a message someone wrote on the other platform. The first message of a
   * new `externalUser.id` mints their `puppetId`; later ones update their name and picture (each
   * message keeps the ones it was sent with). Sends are idempotent per external message id and
   * part, so a timed-out send is retried by the library and safe to repeat yourself; a retry that
   * finds the first attempt still being written (`send_in_progress`) waits and tries again.
   *
   * The room's rules apply to each bridged user as to a member with no roles: `@everyone` must be
   * able to send (else `puppet_cannot_send`), files and embeds need Attach Files and Embed Links
   * for `@everyone`, and slowmode and automod count per bridged user. Mentions never notify,
   * except a reply ping when the bridge has `replyPings`.
   *
   * @param options - Who, which external message, and what.
   * @throws {@link StrafeError} `BridgeSendInvalid` without an external user or message id;
   *   {@link BridgeAPIError} for what the server refuses (`puppet_blocked`, `bridge_inactive`...).
   * @example
   * ```ts
   * const { message, duplicate } = await bridge.send({
   *   externalUser: { id: author.id, name: author.displayName, avatarURL: author.avatarURL },
   *   externalMessageId: discordMessage.id,
   *   content: discordMessage.content,
   *   replyTo: discordMessage.reference ? { externalMessageId: discordMessage.reference.messageId } : undefined,
   * });
   * ```
   */
  public async send(options: BridgeSendOptions): Promise<BridgeSendResult> {
    const { externalUser } = options;
    if (typeof externalUser !== 'object' || typeof externalUser.id !== 'string' || externalUser.id === '' || typeof externalUser.name !== 'string' || externalUser.name.trim() === '') {
      throw new StrafeError(ErrorCodes.BridgeSendInvalid, 'externalUser needs an id and a name');
    }
    if (typeof options.externalMessageId !== 'string' || options.externalMessageId === '') {
      throw new StrafeError(ErrorCodes.BridgeSendInvalid, 'externalMessageId is required (a bridge only relays what exists elsewhere)');
    }
    const body: RESTPostAPIBridgeMessageJSONBody = {
      external_user: externalUserBody(externalUser) as APIExternalUser,
      external_message_id: options.externalMessageId,
    };
    if (options.part !== undefined) body.part = options.part;
    if (options.content !== undefined && options.content !== null && options.content !== '') {
      const length = codePointLength(options.content);
      if (length > MaxMessageLength) throw new StrafeRangeError(ErrorCodes.MessageTooLarge, `${length} characters (at most ${MaxMessageLength})`);
      body.content = options.content;
    }
    if (options.embeds && options.embeds.length > 0) body.embeds = resolveEmbeds(options.embeds);
    if (options.replyTo !== undefined) {
      const reply = messageRef(options.replyTo);
      body.reply_to = reply.messageId !== undefined ? { message_id: reply.messageId } : { external_message_id: reply.external ?? '', ...(reply.part === undefined ? {} : { part: reply.part }) };
    }
    if (options.repliedUser !== undefined) body.allowed_mentions = { replied_user: options.repliedUser };
    const files = await resolveSendFiles(options.files ?? [], this.client.rest.options.makeRequest);
    if (body.content === undefined && body.embeds === undefined && files.length === 0) throw new StrafeError(ErrorCodes.MessageEmpty);
    const request = { ...withFiles(body, files), idempotent: true };
    let data: APIBridgeSendResult;
    for (let attempt = 0; ; attempt++) {
      try {
        data = await this.client.rest.post<APIBridgeSendResult>(Routes.bridgeMessages(this.id), request);
        break;
      } catch (error) {
        // A retry that overtook the first attempt (still being written): wait for it to land, and
        // the next try answers it as a duplicate.
        if (!(error instanceof BridgeAPIError) || error.code !== APIErrorCodes.SendInProgress || attempt >= SEND_IN_PROGRESS_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, SEND_IN_PROGRESS_DELAY * (attempt + 1)));
      }
    }
    const result: BridgeSendResult = {
      message: null,
      messageId: data.id,
      puppetId: data.puppet_id,
      duplicate: data.duplicate === true,
      replyDropped: data.reply_dropped === true,
    };
    if (!('deleted' in data)) {
      const room = await textRoom(this.client, data.room_id);
      result.message = room.messages._add(data);
    }
    return result;
  }

  /**
   * Edits a message this bridge posted (someone edited it on the other platform).
   *
   * @param message - The other platform's message id (or `{ externalMessageId, part }`, `{ messageId }`, a {@link Message}).
   * @param options - Text or {@link BridgeMessageEditOptions}.
   * @example
   * ```ts
   * await bridge.editMessage(discordMessage.id, { content: discordMessage.content });
   * ```
   */
  public async editMessage(message: BridgeMessageResolvable, options: string | BridgeMessageEditOptions): Promise<Message> {
    const data: BridgeMessageEditOptions = typeof options === 'string' ? { content: options } : options;
    const ref = messageRef(message);
    const body: RESTPatchAPIBridgeMessageJSONBody = {};
    if (data.content !== undefined && data.content !== null) body.content = data.content;
    if (data.embeds === null) body.embeds = [];
    else if (data.embeds !== undefined) body.embeds = data.embeds.length === 0 ? [] : resolveEmbeds(data.embeds);
    const part = data.part ?? ref.part;
    if (part !== undefined) body.part = part;
    const result = await this.client.rest.patch<APIMessage>(this.messageRoute(ref), { body });
    const room = await textRoom(this.client, result.room_id);
    return room.messages._add(result);
  }

  /**
   * Deletes a message this bridge posted: every part, or one with `part`. Gone from the map after
   * 30 days: deleting older messages by external id answers `unknown_external_message`.
   *
   * @param message - The other platform's message id (or another {@link BridgeMessageResolvable}).
   * @param options - One part only.
   */
  public async deleteMessage(message: BridgeMessageResolvable, options: { part?: number | undefined } = {}): Promise<void> {
    const ref = messageRef(message);
    const part = options.part ?? ref.part;
    await this.client.rest.delete(this.messageRoute(ref), part === undefined ? {} : { query: { part } });
  }

  /**
   * Adds a bridged user's reaction (someone reacted on the other platform). `@everyone` needs Add
   * Reactions in the room, and a custom emoji must be the space's own.
   *
   * @param message - The other platform's message id (or another {@link BridgeMessageResolvable}).
   * @param emoji - A unicode emoji, `<:name:id>`, an id or an {@link Emoji}.
   * @param options - Who reacted.
   * @example
   * ```ts
   * await bridge.react(reaction.message.id, '👍', { externalUserId: user.id, externalUser: { name: user.username } });
   * ```
   */
  public async react(message: BridgeMessageResolvable, emoji: EmojiIdentifierResolvable, options: BridgeReactOptions): Promise<void> {
    await this.client.rest.put(this.reactionRoute(message, emoji, options.externalUserId), options.externalUser === undefined ? {} : { body: { external_user: externalUserBody(options.externalUser) } });
  }

  /**
   * Removes a bridged user's reaction.
   *
   * @param message - The other platform's message id (or another {@link BridgeMessageResolvable}).
   * @param emoji - The emoji.
   * @param options - Who reacted.
   */
  public async unreact(message: BridgeMessageResolvable, emoji: EmojiIdentifierResolvable, options: Pick<BridgeReactOptions, 'externalUserId'>): Promise<void> {
    await this.client.rest.delete(this.reactionRoute(message, emoji, options.externalUserId));
  }

  /**
   * Records that you copied a Strafe message to the platform. Replies there to the copy then
   * resolve (`replyTo: copyId`), and the message's edits, deletes and reactions arrive with the
   * copy's id in `external`. Call it after every copy you post.
   *
   * @param message - The Strafe message (or its id).
   * @param externalMessageId - The copy's id on the platform.
   * @param options - The part, when one message became several copies.
   * @throws {@link BridgeAPIError} `external_message_conflict` when that id already maps elsewhere.
   */
  public async link(message: Message | Snowflake, externalMessageId: string, options: { part?: number | undefined } = {}): Promise<void> {
    const id = typeof message === 'string' ? message : message.id;
    await this.client.rest.put(Routes.bridgeMessageExternal(this.id, id), {
      body: { external_message_id: externalMessageId, ...(options.part === undefined ? {} : { part: options.part }) },
    });
  }

  /**
   * Looks a message up in the id map, either way: the Strafe message of an external id (every
   * part), or the external copies of a Strafe message. Empty when there is no entry (it may have
   * expired after 30 days).
   *
   * @param message - An external id (string or `{ externalMessageId }`), or a Strafe message (`{ messageId }` or a {@link Message}).
   */
  public async lookup(message: BridgeMessageResolvable): Promise<BridgeMessageLink[]> {
    const ref = messageRef(message);
    if (ref.messageId !== undefined) {
      const list = await this.client.rest.get<APIBridgeMapEntry[]>(Routes.bridgeMessageExternal(this.id, ref.messageId));
      return list.map(mapEntry);
    }
    try {
      const data = await this.client.rest.get<APIBridgeExternalLookup>(Routes.bridgeExternalMessage(this.id, ref.external ?? ''));
      const parts = data.parts.length > 0 ? data.parts : [data];
      return parts.map(mapEntry).filter((entry) => ref.part === undefined || entry.part === ref.part);
    } catch (error) {
      if (error instanceof BridgeAPIError && error.status === 404 && error.code === 'unknown_external_message') return [];
      throw error;
    }
  }

  /**
   * One page of the feed you missed: the same filtered messages as {@link Events.BridgeMessageCreate},
   * oldest first, after `after` (only since the bridge was made; Read Message History applies).
   *
   * @param options - Where to start and how many.
   */
  public async fetchBacklog(options: BridgeBacklogOptions = {}): Promise<BridgeFeedMessage[]> {
    const after = options.after === undefined ? undefined : typeof options.after === 'string' ? options.after : options.after.id;
    const list = await this.client.rest.get<GatewayBridgeMessageCreateData[]>(Routes.bridgeMessages(this.id), { query: { after, limit: options.limit } });
    const out: BridgeFeedMessage[] = [];
    for (const entry of list) out.push(await feedMessage(this.client, entry));
    return out;
  }

  /**
   * Catches up after downtime: every feed message after `after`, oldest first, a page at a time.
   *
   * @param options - Where to start and the page size.
   * @example
   * ```ts
   * for await (const { message, replyExternal } of bridge.backlog({ after: lastCopiedId })) {
   *   await copyToPlatform(message, replyExternal);
   * }
   * ```
   */
  public async *backlog(options: BridgeBacklogOptions = {}): AsyncGenerator<BridgeFeedMessage, void, undefined> {
    let after = options.after === undefined ? undefined : typeof options.after === 'string' ? options.after : options.after.id;
    for (;;) {
      const page = await this.fetchBacklog({ after, limit: options.limit });
      if (page.length === 0) return;
      for (const entry of page) yield entry;
      after = page.at(-1)?.message.id;
    }
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), creator: this.creator?.id ?? null };
  }

  private messageRoute(ref: ResolvedRef): RouteLike {
    return ref.messageId !== undefined ? Routes.bridgeMessage(this.id, ref.messageId) : Routes.bridgeExternalMessage(this.id, ref.external ?? '');
  }

  private reactionRoute(message: BridgeMessageResolvable, emoji: EmojiIdentifierResolvable, externalUserId: string): RouteLike {
    const ref = messageRef(message);
    const identifier = emoji instanceof Emoji ? emoji.identifier : emoji;
    if (typeof identifier !== 'string' || identifier.trim() === '') throw new StrafeError(ErrorCodes.EmojiInvalid, identifier);
    if (typeof externalUserId !== 'string' || externalUserId === '') throw new StrafeTypeError(ErrorCodes.InvalidArgument, 'externalUserId is required');
    return ref.messageId !== undefined
      ? Routes.bridgeMessageReaction(this.id, ref.messageId, identifier, externalUserId)
      : Routes.bridgeExternalReaction(this.id, ref.external ?? '', identifier, externalUserId);
  }
}

interface ResolvedRef {
  messageId?: Snowflake;
  external?: string;
  part?: number;
}

function messageRef(message: BridgeMessageResolvable): ResolvedRef {
  if (typeof message === 'string') return { external: message };
  if (message instanceof Message) return { messageId: message.id };
  if ('messageId' in message) return { messageId: message.messageId };
  if ('externalMessageId' in message) return message.part === undefined ? { external: message.externalMessageId } : { external: message.externalMessageId, part: message.part };
  throw new StrafeTypeError(ErrorCodes.InvalidType, 'message', 'an external message id, { externalMessageId }, { messageId } or a Message');
}

/**
 * Caches a feed payload's message and reads its reply copy.
 *
 * @internal
 */
export async function feedMessage(client: Client, data: GatewayBridgeMessageCreateData): Promise<BridgeFeedMessage> {
  const room = await textRoom(client, data.message.room_id || data.room_id);
  const message = room.messages._add({ ...data.message, room_id: room.id }) as Message;
  return { message, replyExternal: data.reply_external ? externalRef(data.reply_external) : null };
}

/** Whether bridge data is the full object (it has `settings`). @internal */
export function isFullBridge(data: APIBridgeSummary | APIBridge): data is APIBridge {
  return 'settings' in data;
}

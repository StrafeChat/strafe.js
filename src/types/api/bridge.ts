import type { Snowflake } from '../../util/Snowflake.js';
import type { ISO8601Timestamp } from './common.js';
import type { APIEmbed, APIMessage } from './message.js';
import type { APIWebhookUser, WebhookType } from './webhook.js';

/** Platforms a bridge may declare; `other` needs a `platform_name`. */
export type BridgePlatform = 'discord' | 'matrix' | 'irc' | 'telegram' | 'slack' | 'xmpp' | 'revolt' | 'other';

/** Who drives a bridge. Only `bot` exists today: token-driven bridges are not available yet. */
export type BridgeDriver = 'bot' | 'token';

/** A bridge's state. */
export type BridgeState = 'active' | 'paused' | 'disabled';

/**
 * Why a bridge is not running: `paused_by_manager`, `paused_by_driver` (its bot paused it),
 * `became_private` (the room stopped being open to everyone; resume with the acknowledgement),
 * `driver_lost_permission` (the bot lacks View Room, Send Messages or Masquerade; resumes by itself)
 * or `encrypted` (the room is end-to-end encrypted).
 */
export type BridgeStateReason = 'paused_by_manager' | 'paused_by_driver' | 'became_private' | 'driver_lost_permission' | 'encrypted';

/** What a room is bridged with, as the driver declares it. */
export interface APIBridgeRemote {
  /** Name, 1-100 characters. */
  name: string;
  /** An `https://` link, or `null`. */
  url: string | null;
}

/** A bridge's switches. */
export interface APIBridgeSettings {
  /** Copy bots' and webhooks' messages to the platform (off by default). */
  relay_bots: boolean;
  /** Copy what other bridges post (off: no cross-feeding). */
  relay_other_bridges: boolean;
  /** A bridged reply may notify the person it answers (on by default). */
  reply_pings: boolean;
  /** Bridged users may carry a name colour (turning it on needs Manage Roles). */
  allow_colour: boolean;
  /** Cards offer the bridged user's profile on their platform. */
  show_profile_links: boolean;
}

/**
 * The public summary of a bridge, for everyone who can view its room (`GET /rooms/:id/bridges`,
 * rooms' `bridges`, `BRIDGE_CREATE`/`BRIDGE_UPDATE` to the room).
 */
export interface APIBridgeSummary {
  /** Bridge id. */
  id: Snowflake;
  /** {@link WebhookType.Bridge}. */
  type: WebhookType;
  /** The space. */
  space_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** Name (1-80). */
  name: string;
  /** Avatar URL, or `null`. */
  avatar: string | null;
  /** The platform. */
  platform: BridgePlatform;
  /** An `other` platform's label, else `null`. */
  platform_name: string | null;
  /** What the room is bridged with, or `null`. */
  remote: APIBridgeRemote | null;
  /** Who drives it. */
  driver: BridgeDriver;
  /** The driving bot's user id (its application's id), or `null`. */
  driver_id: Snowflake | null;
  /** The driving bot's application id, or `null`. */
  application_id: Snowflake | null;
  /** The driving bot's display name, or `null`. */
  driver_name: string | null;
  /** The state. */
  state: BridgeState;
  /** Why it is not active, or `null`. */
  state_reason: BridgeStateReason | null;
  /** When it was made. */
  created_at: ISO8601Timestamp;
}

/** The full bridge, for the room's managers and the driving bot (`GET /bridges/:id`, READY's `bridges`). */
export interface APIBridge extends APIBridgeSummary {
  /** The switches. */
  settings: APIBridgeSettings;
  /** When it last changed. */
  updated_at: ISO8601Timestamp;
  /** When it last posted, or `null`. */
  last_used_at: ISO8601Timestamp | null;
  /** Who made it, or `null`. */
  creator: APIWebhookUser | null;
}

/** `POST /rooms/:id/bridges`. */
export interface RESTPostAPIRoomBridgeJSONBody {
  /** The platform. */
  platform: BridgePlatform;
  /** Label for `other` (1-32). */
  platform_name?: string;
  /** Name (1-80). */
  name: string;
  /** A `data:` URI. */
  avatar?: string;
  /** What the room is bridged with. */
  remote?: { name: string; url?: string };
  /** Initial switches. */
  settings?: Partial<APIBridgeSettings>;
  /** Needed for a room not everyone in the space can see. */
  acknowledge_private?: boolean;
  /** Audit-log reason. */
  reason?: string;
}

/** `PATCH /bridges/:id`. */
export interface RESTPatchAPIBridgeJSONBody {
  /** New name. */
  name?: string;
  /** New avatar (`data:` URI), or `null` to clear it. */
  avatar?: string | null;
  /** New remote, or `null` to clear it. */
  remote?: { name: string; url?: string } | null;
  /** Switches to change. */
  settings?: Partial<APIBridgeSettings>;
  /** Pause or resume. */
  state?: 'active' | 'paused';
  /** Needed to resume in a room not everyone can see. */
  acknowledge_private?: boolean;
  /** Audit-log reason. */
  reason?: string;
}

/** The person on the other platform a bridged message speaks for. */
export interface APIExternalUser {
  /** Their id there (1-128 printable characters). Required; never shown to readers. */
  id: string;
  /** Their name (1-32 after the name rules). */
  name: string;
  /** Their picture: `https://` (up to 512) or `attachment://<filename>`. */
  avatar_url?: string | null;
  /** A name colour `0xRRGGBB`, only when the bridge allows colours. */
  colour?: number | null;
  /** A bot on the other platform. */
  bot?: boolean;
  /** Their profile there (`https://`), shown only with `show_profile_links`. */
  profile_url?: string | null;
}

/** `reply_to` of a bridge send: a message this bridge posted or linked, or any Strafe message of the room. */
export type APIBridgeReplyTo = { external_message_id: string; part?: number } | { message_id: Snowflake };

/** `POST /bridges/:id/messages`. */
export interface RESTPostAPIBridgeMessageJSONBody {
  /** Who said it. */
  external_user: APIExternalUser;
  /** The message on the other platform (1-256 printable ASCII). With `part`, the idempotency key. */
  external_message_id: string;
  /** Which piece of a long external message this is (0-9). */
  part?: number;
  /** Text, up to 4000 code points. */
  content?: string;
  /** Embeds (need `@everyone` to have Embed Links in the room). */
  embeds?: APIEmbed[];
  /** The message it answers. */
  reply_to?: APIBridgeReplyTo;
  /** Only `replied_user` counts, and only with the bridge's `reply_pings`. */
  allowed_mentions?: { replied_user?: boolean };
}

/** The answer to a bridge send: the message plus the puppet and what happened. */
export type APIBridgeSendResult = (APIMessage | { id: Snowflake; room_id: Snowflake; deleted: true }) & {
  /** The bridged user's id on Strafe. */
  puppet_id: Snowflake;
  /** The same external message (and part) was posted before: this is that message. */
  duplicate?: true;
  /** `reply_to` named an unknown message, so it was sent without the reply. */
  reply_dropped?: true;
};

/** `PATCH /bridges/:id/messages/external/:externalMessageId` (or `/messages/:messageId`). */
export interface RESTPatchAPIBridgeMessageJSONBody {
  /** New text. */
  content?: string;
  /** New embeds. */
  embeds?: APIEmbed[];
  /** Which part (default: the first). */
  part?: number;
}

/** `PUT /bridges/:id/messages/:messageId/external`: a Strafe message copied to the platform. */
export interface RESTPutAPIBridgeMessageExternalJSONBody {
  /** The copy's id on the platform. */
  external_message_id: string;
  /** Which part of the copy. */
  part?: number;
}

/** One pair of the bridge's id map: a Strafe message and its id on the other platform. */
export interface APIBridgeMapEntry {
  /** The Strafe message. */
  message_id: Snowflake;
  /** Its room. */
  room_id: Snowflake;
  /** The part. */
  part: number;
  /** `inbound`: posted here by the bridge; `outbound`: a Strafe message the driver copied out. */
  direction: 'inbound' | 'outbound';
  /** The id on the platform. */
  external_message_id: string;
}

/** `GET /bridges/:id/messages/external/:externalMessageId`: the first part, and every part. */
export interface APIBridgeExternalLookup extends APIBridgeMapEntry {
  /** Every part. */
  parts: APIBridgeMapEntry[];
}

/** A bridged user as the driver sees them (`GET /bridges/:id/puppets/:externalUserId`). */
export interface APIBridgePuppet {
  /** Their id on Strafe. */
  puppet_id: Snowflake;
  /** The bridge. */
  bridge_id: Snowflake;
  /** Their id on the other platform. */
  external_user_id: string;
  /** Last-known name. */
  name: string;
  /** Last-known picture, or `null`. */
  avatar: string | null;
  /** A bot on the other platform. */
  bot: boolean;
  /** Their profile, or `null`. */
  profile_url: string | null;
  /** Whether a moderator blocked them from this bridge. */
  blocked: boolean;
  /** When they last posted. */
  last_seen_at: ISO8601Timestamp;
  /** A member of the space with the same name, or `null`. */
  lookalike: { id: Snowflake; username: string } | null;
}

/** `PATCH /bridges/:id/puppets/:externalUserId`. */
export interface RESTPatchAPIBridgePuppetJSONBody {
  /** New name. */
  name?: string;
  /** New picture. */
  avatar_url?: string | null;
  /** A bot on the other platform. */
  bot?: boolean;
  /** Their profile. */
  profile_url?: string | null;
}

/** A moderator's block of a bridged user (`GET /bridges/:id/blocks`). */
export interface APIBridgeBlock {
  /** The bridged user's id on Strafe. */
  puppet_id: Snowflake;
  /** The bridge. */
  bridge_id: Snowflake;
  /** Their name when blocked. */
  name: string;
  /** Always `null` (pictures from other platforms load only through the media proxy). */
  avatar: null;
  /** Why, or `null`. */
  reason: string | null;
  /** When. */
  blocked_at: ISO8601Timestamp;
  /** The moderator (a user object, or an id when the account is gone), or `null`. */
  blocked_by: APIWebhookUser | Snowflake | null;
}

/** Where the bridge copied a message (feed events). */
export interface APIBridgeExternalRef {
  /** The copy's id on the platform. */
  external_message_id: string;
  /** The part. */
  part: number;
}

/** `GET /users/@me/bridge-consent`. */
export interface APIBridgeAccountConsent {
  /** The account default, or `null` when never set. */
  default: 'allow' | 'deny' | null;
}

/** `GET /spaces/:id/members/@me/bridge-consent`. */
export interface APIBridgeSpaceConsent {
  /** The member's choice for the space. */
  state: 'inherit' | 'allow' | 'deny';
  /** The space's mode. */
  mode: 'optout' | 'optin';
  /** The effective answer. */
  effective: string;
}

// ---- gateway: the bridge feed (on the driving bot's own connection) ----------------------------

/** `BRIDGE_MESSAGE_CREATE`, and each entry of `GET /bridges/:id/messages` (the backlog). */
export interface GatewayBridgeMessageCreateData {
  /** The bridge. */
  bridge_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The message as a bot sees it (`referenced_message` removed when its author is filtered out). */
  message: APIMessage;
  /** The copy of the message it answers, when the bridge has one. */
  reply_external?: APIBridgeExternalRef;
}

/** `BRIDGE_MESSAGE_UPDATE`. */
export interface GatewayBridgeMessageUpdateData extends GatewayBridgeMessageCreateData {
  /** Where the bridge copied it. */
  external: APIBridgeExternalRef[];
}

/** `BRIDGE_MESSAGE_DELETE`: sent whenever a copy is known, even for someone who opted out. */
export interface GatewayBridgeMessageDeleteData {
  /** The bridge. */
  bridge_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The deleted message. */
  message_id: Snowflake;
  /** Where the bridge copied it. */
  external: APIBridgeExternalRef[];
  /** Deleted by someone other than its author (a moderator), or, for a message the bridge posted, by anyone but its bot. */
  by_moderator: boolean;
}

/** The reactor of a bridge reaction event: a user object, with `puppet` for another bridge's bridged user. */
export type GatewayBridgeReactor = APIWebhookUser & {
  /** Set when the reactor is another bridge's bridged user. */
  puppet?: { bridge_id: Snowflake; puppet_id: Snowflake; platform: string; platform_name: string };
};

/** `BRIDGE_REACTION_ADD` / `BRIDGE_REACTION_REMOVE`. */
export interface GatewayBridgeReactionData {
  /** The bridge. */
  bridge_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The message. */
  message_id: Snowflake;
  /** Where the bridge copied the message. */
  external: APIBridgeExternalRef[];
  /** Who reacted. */
  user: GatewayBridgeReactor;
  /** A unicode emoji, or `custom:<id>`. */
  emoji: string;
}

/** `BRIDGE_OPTOUT`: someone said no to bridges; the copies of theirs still in the map. */
export interface GatewayBridgeOptOutData {
  /** The bridge. */
  bridge_id: Snowflake;
  /** Who opted out. */
  user_id: Snowflake;
  /** The copies to delete on the platform. */
  external: (APIBridgeExternalRef & { message_id: Snowflake })[];
}

/** `BRIDGE_PUPPET_BLOCK` / `BRIDGE_PUPPET_UNBLOCK`. */
export interface GatewayBridgePuppetBlockData {
  /** The bridge. */
  bridge_id: Snowflake;
  /** The bridged user on Strafe. */
  puppet_id: Snowflake;
  /** Their id on the other platform. */
  external_user_id: string;
}

/** `BRIDGE_CREATE` / `BRIDGE_UPDATE`: the summary to the room's viewers, the full bridge to its bot. */
export type GatewayBridgeData = APIBridgeSummary | APIBridge;

/** `BRIDGE_DELETE`. */
export interface GatewayBridgeDeleteData {
  /** The bridge id. */
  id: Snowflake;
  /** The bridge id again. */
  bridge_id?: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The space. */
  space_id?: Snowflake;
}

/** `WEBHOOKS_UPDATE`: something about the room's webhooks changed; refetch them if you show them. */
export interface GatewayWebhooksUpdateData {
  /** The space. */
  space_id: Snowflake;
  /** The room. */
  room_id: Snowflake;
}

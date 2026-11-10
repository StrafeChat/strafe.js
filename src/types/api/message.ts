import type { Snowflake } from '../../util/Snowflake.js';
import type { ISO8601Timestamp } from './common.js';
import type { APIUser } from './user.js';

/** An uploaded file (`POST /rooms/:id/attachments`, and `attachments` on messages). */
export interface APIAttachment {
  /** Upload id; send it in a message's `attachments`. */
  id: Snowflake;
  /** Sanitized file name (absent on encrypted uploads). */
  filename?: string;
  /** MIME type. */
  content_type?: string;
  /** Size in bytes. */
  size: number;
  /** URL on the instance CDN. */
  url: string;
  /** Image width, when given at upload. */
  width?: number;
  /** Image height, when given at upload. */
  height?: number;
  /** Set on end-to-end encrypted uploads. */
  encrypted?: true;
}

/** Embed footer. */
export interface APIEmbedFooter {
  /** Text (up to 2048). */
  text: string;
  /** Icon URL (http(s) or `attachment://`). */
  icon_url?: string;
  /** The icon through the instance's image proxy (received only). */
  proxy_icon_url?: string;
}

/** Embed image or thumbnail. */
export interface APIEmbedImage {
  /** URL (http(s) or `attachment://name`). */
  url: string;
  /** The image through the instance's image proxy (received only; may be a path to resolve against the API). */
  proxy_url?: string;
  /** Width (received only). */
  width?: number;
  /** Height (received only). */
  height?: number;
}

/** Embed author. */
export interface APIEmbedAuthor {
  /** Name (up to 256). */
  name: string;
  /** Link. */
  url?: string;
  /** Icon URL. */
  icon_url?: string;
  /** The icon through the image proxy (received only). */
  proxy_icon_url?: string;
}

/** Embed field. */
export interface APIEmbedField {
  /** Name (up to 256). */
  name: string;
  /** Value (up to 1024). */
  value: string;
  /** Show beside other inline fields. */
  inline?: boolean;
}

/**
 * A rich embed: Discord's fields and limits (title 256, description 4096, 25 fields, field name 256 /
 * value 1024, footer 2048, author 256, 6000 in total, 10 per message), counted in code points after
 * trimming. Only bots may send embeds, only in rooms that are not end-to-end encrypted.
 */
export interface APIEmbed {
  /** Always `rich` on received embeds. */
  type?: 'rich';
  /** Title. */
  title?: string;
  /** Description. */
  description?: string;
  /** Link for the title. */
  url?: string;
  /** RFC 3339 timestamp shown in the footer. */
  timestamp?: string;
  /** Color as an integer `0xRRGGBB`. */
  color?: number;
  /** Footer. */
  footer?: APIEmbedFooter;
  /** Large image. */
  image?: APIEmbedImage;
  /** Small image at the top right. */
  thumbnail?: APIEmbedImage;
  /** Author line. */
  author?: APIEmbedAuthor;
  /** Fields. */
  fields?: APIEmbedField[];
}

/** One emoji's reactions on a message. */
export interface APIReactionSummary {
  /** A unicode emoji, or `custom:<emoji id>`. */
  emoji: string;
  /** How many people reacted. */
  count: number;
  /** Whether you did. */
  me: boolean;
}

/** Kinds of system notices (`system_type`). */
export type MessageSystemType =
  | 'space_member_join'
  | 'space_member_leave'
  | 'space_birthday'
  | 'message_pinned'
  | 'thread_created'
  | 'thread_renamed'
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'room_renamed'
  | 'call_started'
  | 'call_ended';

/** The decoded `system_payload` of each {@link MessageSystemType}. */
export interface MessageSystemPayloads {
  /** Someone joined the space. */
  space_member_join: { user_id: Snowflake };
  /** Someone left, was kicked or banned. */
  space_member_leave: { user_id: Snowflake; how: 'left' | 'kicked' | 'banned' };
  /** A birthday notice. */
  space_birthday: { user_id: Snowflake; message: string };
  /** A message was pinned. */
  message_pinned: { actor_id: Snowflake; message_id: Snowflake };
  /** A thread was started. */
  thread_created: { actor_id: Snowflake; thread_id: Snowflake; name: string };
  /** A thread was renamed. */
  thread_renamed: { actor_id: Snowflake; name: string };
  /** Someone was added to a group PM. */
  member_added: { actor_id: Snowflake; user_id: Snowflake };
  /** Someone was removed from a group PM. */
  member_removed: { actor_id: Snowflake; user_id: Snowflake };
  /** Someone left a group PM. */
  member_left: { user_id: Snowflake };
  /** A group PM was renamed. */
  room_renamed: { actor_id: Snowflake; old_name: string; new_name: string };
  /** A call started. */
  call_started: { actor_id: Snowflake };
  /** A call ended. */
  call_ended: { actor_id: Snowflake; duration_seconds: number };
}

/**
 * A message. Plain rooms carry `plaintext`; end-to-end encrypted rooms carry only `ciphertext`,
 * which a bot cannot read. Edited when `updated_at` is later than `created_at`.
 */
export interface APIMessage {
  /** Message id. */
  id: Snowflake;
  /** The room. */
  room_id: Snowflake;
  /** The space (gateway events only). */
  space_id?: Snowflake;
  /** Author id; `"0"` for system notices. */
  sender_id: Snowflake;
  /** Author's device (`"0"` for bots). */
  sender_device_id: Snowflake;
  /** Encrypted body (`""` in plain rooms). */
  ciphertext: string;
  /** Text (absent when empty or encrypted). */
  plaintext?: string;
  /** The message replied to. */
  reply_to_id?: Snowflake;
  /** User ids mentioned (parsed from the text by the server). */
  mentions?: Snowflake[];
  /** Role ids mentioned. */
  mention_roles?: Snowflake[];
  /** Whether `@everyone`/`@here` pinged. */
  mention_everyone?: true;
  /** Files. */
  attachments?: APIAttachment[];
  /** Embeds (always an array, except on reduced system-notice events). */
  embeds?: APIEmbed[];
  /** When it was sent. */
  created_at: ISO8601Timestamp;
  /** When it was last edited (equal to `created_at` when never). */
  updated_at: ISO8601Timestamp;
  /** Deletion time (deleted messages are not listed). */
  deleted_at?: ISO8601Timestamp;
  /** Kind of system notice. */
  system_type?: MessageSystemType;
  /** JSON-ENCODED STRING of the notice's data ({@link MessageSystemPayloads}); `JSON.parse` it. */
  system_payload?: string;
  /** Whether it is pinned. */
  pinned?: true;
  /** When it was pinned. */
  pinned_at?: ISO8601Timestamp;
  /** Who pinned it. */
  pinned_by?: Snowflake;
  /** Thread started from this message (same id as the message). */
  thread_id?: Snowflake;
  /** Reactions (REST only). */
  reactions?: APIReactionSummary[];
  /** The author (best effort; absent on system notices). */
  author?: APIUser;
  /** Mentioned users. */
  mention_users?: APIUser[];
  /** The message replied to, one level deep (absent if deleted). */
  referenced_message?: APIMessage;
}

/** One pin (`GET /rooms/:id/pins`). */
export interface APIPin {
  /** When it was pinned. */
  pinned_at: ISO8601Timestamp;
  /** Who pinned it. */
  pinned_by: Snowflake;
  /** The message. */
  message: APIMessage;
}

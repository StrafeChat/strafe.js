import type { Snowflake } from '../../util/Snowflake.js';
import type { ISO8601Timestamp } from './common.js';
import type { APIEmbed } from './message.js';

/** Webhook types (`type` on a webhook): Discord's numbering, with Strafe's bridges as type 4. */
export enum WebhookType {
  /** An incoming webhook: anything holding its token posts into its room (Discord's type 1). */
  Incoming = 1,
  /** A bridge (a room integration for another platform; see {@link APIBridge}). */
  Bridge = 4,
}

/** The small public user object webhook and bridge payloads embed. */
export interface APIWebhookUser {
  /** User id. */
  id: Snowflake;
  /** Username. */
  username: string;
  /** Display name (may be empty). */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Whether the account is a bot. */
  bot: boolean;
}

/**
 * A webhook (`POST /rooms/:id/webhooks`, `GET /webhooks/:id`...). `token` and `url` come back only
 * from create and from a token reset: never from a list or a get.
 */
export interface APIWebhook {
  /** Webhook id. */
  id: Snowflake;
  /** {@link WebhookType.Incoming}. */
  type: WebhookType;
  /** The space. */
  space_id: Snowflake;
  /** The room it posts into. */
  room_id: Snowflake;
  /** Default name of its messages (1-80). */
  name: string;
  /** Default avatar URL, or `null`. */
  avatar: string | null;
  /** The application whose bot made it (that bot may manage and execute it with its own token). */
  application_id: Snowflake | null;
  /** Who made it. Left out of answers to token-authenticated requests. */
  creator?: APIWebhookUser;
  /** Whether it may ping `@everyone`, `@here` and roles at all (off unless someone with Mention Everyone turned it on). */
  mass_mentions: boolean;
  /** `encrypted` while its room is end-to-end encrypted (every execute is refused then), else `null`. */
  disabled_reason: 'encrypted' | null;
  /** When it was made. */
  created_at: ISO8601Timestamp;
  /** When it last posted, or `null`. */
  last_used_at: ISO8601Timestamp | null;
  /** The secret (`swh_...`): only in the answers to create and to a token reset. */
  token?: string;
  /** The execute URL with the token in it: only with `token`. */
  url?: string;
}

/** `POST /rooms/:id/webhooks`. */
export interface RESTPostAPIRoomWebhookJSONBody {
  /** Name, 1-80 characters (no reserved, staff or role names). */
  name: string;
  /** A `data:image/png|jpeg|gif|webp;base64,...` URI. */
  avatar?: string;
  /** Allow `@everyone` and role pings (needs Mention Everyone). */
  mass_mentions?: boolean;
  /** Audit-log reason. */
  reason?: string;
}

/** `PATCH /webhooks/:id` (the token form takes only `name` and `avatar`). */
export interface RESTPatchAPIWebhookJSONBody {
  /** New name. */
  name?: string;
  /** New avatar (`data:` URI), or `null` to clear it. */
  avatar?: string | null;
  /** Move it to another plaintext room of the same space (Manage Webhooks in both). */
  room_id?: Snowflake;
  /** Allow `@everyone` and role pings. */
  mass_mentions?: boolean;
  /** Audit-log reason. */
  reason?: string;
}

/** Mention kinds `allowed_mentions.parse` can list. */
export type AllowedMentionsType = 'users' | 'roles' | 'everyone';

/**
 * Discord's `allowed_mentions`, on webhook and bridge sends only: which mentions in the text
 * notify. Leaving it out notifies all three kinds; `{}` notifies nobody.
 */
export interface APIAllowedMentions {
  /** Kinds that notify. */
  parse?: AllowedMentionsType[];
  /** Users that may be notified (up to 100; not together with `users` in `parse`). */
  users?: Snowflake[];
  /** Roles that may be notified (up to 100; not together with `roles` in `parse`). */
  roles?: Snowflake[];
  /** Whether a reply notifies the author of the message it answers. */
  replied_user?: boolean;
}

/** `POST /webhooks/:id` (and `/webhooks/:id/:token`): Discord's execute body. */
export interface RESTPostAPIWebhookExecuteJSONBody {
  /** Text, up to 4000 code points. */
  content?: string;
  /** Post under this name instead of the webhook's (1-80, the name rules). */
  username?: string;
  /** Post with this picture: `https://` (up to 512 characters) or `attachment://<filename>`. */
  avatar_url?: string;
  /** Embeds (up to 10). A webhook needs no Embed Links bit. */
  embeds?: APIEmbed[];
  /** Which mentions notify. */
  allowed_mentions?: APIAllowedMentions;
  /** `4096` (SUPPRESS_NOTIFICATIONS) and `4` (SUPPRESS_EMBEDS, ignored). */
  flags?: number;
  /** Accepted and ignored. */
  tts?: boolean;
}

/** `PATCH /webhooks/:id[/:token]/messages/:messageId`. */
export interface RESTPatchAPIWebhookMessageJSONBody {
  /** New text. */
  content?: string;
  /** New embeds (`[]` removes them). */
  embeds?: APIEmbed[];
  /** Which mentions notify (they are parsed and filtered again). */
  allowed_mentions?: APIAllowedMentions;
  /** The files to keep (`[{ id }]`); left out keeps them all. */
  attachments?: { id: Snowflake }[];
}

/** Message flags a webhook execute may carry. */
export const WebhookMessageFlags = {
  /** Accepted and ignored: link previews are drawn by clients. */
  SuppressEmbeds: 1 << 2,
  /** No mention badges and no push notifications. */
  SuppressNotifications: 1 << 12,
} as const;

/** `masquerade.bridge` on a bridged message. External user ids are never part of it. */
export interface APIMasqueradeBridge {
  /** The bridge id. */
  id: Snowflake;
  /** The bridge's name. */
  name: string;
  /** Its platform (`discord`, `matrix`...). */
  platform: string;
  /** The label of an `other` platform ("Mastodon"), else `null`. */
  platform_name: string | null;
  /** The bridged user's id on Strafe (moderators block by it). */
  puppet_id: Snowflake;
  /** Whether the bridged user is a bot on the other platform. */
  external_bot: boolean;
  /** Their profile on the other platform, shown only when the bridge allows it. */
  profile_url: string | null;
}

/**
 * A message's `masquerade`: the identity a webhook or a bridge posted it under. Always visibly a
 * masquerade, with its real sender one click away (`via`).
 */
export interface APIMasquerade {
  /** `webhook` or `bridge`. */
  kind: 'webhook' | 'bridge';
  /** The name it was posted under. */
  name: string;
  /** The picture, through the instance's media proxy (may be a path), or `null`. */
  avatar: string | null;
  /** A name colour `0xRRGGBB` (bridges that allow it). */
  colour?: number;
  /** The bridge (bridged messages). */
  bridge?: APIMasqueradeBridge;
  /**
   * The real sender: the driving bot's user object for a bridged message, `{ webhook: { id, name } }`
   * for a webhook's.
   */
  via?: APIWebhookUser | { webhook: { id: Snowflake; name: string } };
  /** A member of the space with the same name ("Not the Strafe account \@alice"). */
  lookalike?: { id: Snowflake; username: string };
}

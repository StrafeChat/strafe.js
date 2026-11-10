import type { Snowflake } from '../../util/Snowflake.js';
import type { APIFederationRef, APIPresence, ISO8601Timestamp } from './common.js';
import type { APISpaceRoom } from './room.js';
import type { APIUserSummary } from './user.js';

/** A role (`spaces.RoleMap`). Lists come lowest first; `@everyone` is position 0. */
export interface APIRole {
  /** Role id (`@everyone`'s id is `space.everyone_role_id`, not the space id). */
  id: Snowflake;
  /** Name. */
  name: string;
  /** Permission bits (a JSON number). */
  permissions: number;
  /** Position; unique per space, higher is more powerful. */
  position: number;
  /** Color as `0xRRGGBB` (0 = none). */
  color: number;
  /** Whether members are listed separately. */
  hoist: boolean;
  /** Whether anyone may mention it. */
  mentionable: boolean;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it last changed. */
  updated_at: ISO8601Timestamp;
  /** Set on a bot's managed role: that bot's id. Managed roles cannot be assigned or deleted. */
  bot_id?: Snowflake;
}

/** Verification levels (who may post in a space). Bots are exempt. */
export enum SpaceVerificationLevel {
  /** Anyone. */
  None = 0,
  /** Verified email. */
  Low = 1,
  /** Account older than 5 minutes. */
  Medium = 2,
  /** Member for longer than 10 minutes. */
  High = 3,
}

/** Automod rule bits (`automod_flags`). */
export const SpaceAutomodFlags = {
  /** Block the same message repeated. */
  Repeated: 1,
  /** Block invite links. */
  InviteLinks: 2,
  /** Block mass mentions above `automod_mention_limit`. */
  MassMentions: 4,
} as const;

/** System room flags (`system_room_flags`). */
export const SpaceSystemRoomFlags = {
  /** Do not post join notices. */
  SuppressJoinNotifications: 1,
  /** Do not post leave notices. */
  SuppressLeaveNotifications: 2,
} as const;

/** A space (`spaceToJSON` and friends). */
export interface APISpace {
  /** Space id. */
  id: Snowflake;
  /** Name. */
  name: string;
  /** Initials shown without an icon. */
  name_acronym: string;
  /** Description. */
  description: string;
  /** Icon URL or `""`. */
  icon: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Owner's user id. */
  owner_id: Snowflake;
  /** Verification level. */
  verification_level: SpaceVerificationLevel;
  /** Marked official by the instance's administrators. */
  official: boolean;
  /** 0 = all messages, 1 = mentions only. */
  default_message_notifications: number;
  /** Reserved. */
  explicit_content_filter: number;
  /** Feature strings. */
  features: string[] | null;
  /** Seconds before an idle voice user is moved to the inactive voice room. */
  afk_timeout: number;
  /** {@link SpaceSystemRoomFlags} bits. */
  system_room_flags: number;
  /** Birthday message template (REST and events). */
  birthday_message?: string;
  /** Reserved. */
  max_presences: number;
  /** Reserved. */
  max_members: number;
  /** Reserved. */
  vanity_url_code: string;
  /** Preferred locale. */
  preferred_locale: string;
  /** Video participants per voice room. */
  max_video_room_users: number;
  /** Whether the space widget is on. */
  widget_enabled: boolean;
  /** {@link SpaceAutomodFlags} bits. */
  automod_flags: number;
  /** Mentions per message before automod refuses (0 = off). */
  automod_mention_limit: number;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it last changed. */
  updated_at: ISO8601Timestamp;
  /** The inactive voice room. */
  afk_room_id?: Snowflake;
  /** Where join/leave notices go. */
  system_room_id?: Snowflake;
  /** Where birthday notices go (wire name predates our vocabulary). */
  birthday_channel_id?: Snowflake;
  /** Rules room. */
  rules_room_id?: Snowflake;
  /** Updates room. */
  public_updates_room_id?: Snowflake;
  /** Room the space widget invites to. */
  widget_room_id?: Snowflake;
  /** The `@everyone` role's id. */
  everyone_role_id?: Snowflake;
  /** Set on a mirror of a space hosted elsewhere. */
  federation?: APIFederationRef;
  /** Roles (GET, READY, SPACE_CREATE, some SPACE_UPDATE), lowest first. */
  roles?: APIRole[];
  /** Rooms (SPACE_CREATE only). */
  rooms?: APISpaceRoom[];
}

/** A space in `GET /users/@me/spaces` (also reachable with the OAuth2 `spaces` scope). */
export interface APIPartialSpace {
  /** Space id. */
  id: Snowflake;
  /** Name. */
  name: string;
  /** Initials. */
  name_acronym: string;
  /** Icon URL or `""`. */
  icon: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Whether you own it. */
  owner: boolean;
  /** Your space-wide permissions (every bit for the owner). */
  permissions: number;
}

/**
 * A member (`GET /spaces/:id/members`). Flat: the user's fields sit at the top level, not under
 * `user`. `roles` leaves out `@everyone`.
 */
export interface APIMember {
  /** User id. */
  id: Snowflake;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Bio. */
  bio: string;
  /** About me. */
  about_me: string;
  /** Pronouns. */
  pronouns: string;
  /** Whether the account is a bot. */
  bot: boolean;
  /** Badge bits. */
  public_flags: number;
  /** Presence. */
  presence?: APIPresence;
  /** Home instance domain. */
  home_domain?: string;
  /** Id on the home instance. */
  origin_id?: Snowflake;
  /** When they joined. */
  joined_at: ISO8601Timestamp;
  /** Role ids, without `@everyone`. */
  roles: Snowflake[];
  /** Space nickname. */
  nick: string | null;
  /** Space avatar URL. */
  space_avatar: string | null;
  /** Space banner URL. */
  space_banner: string | null;
  /** Space "about me". */
  space_about_me: string | null;
  /** Space bio. */
  space_bio: string | null;
  /** Space pronouns. */
  space_pronouns: string | null;
}

/** A custom emoji. */
export interface APIEmoji {
  /** Emoji id. */
  id: Snowflake;
  /** The space it belongs to. */
  space_id: Snowflake;
  /** Name (2-32 of `A-Z a-z 0-9 _`). */
  name: string;
  /** Image URL. */
  url: string;
  /** Whether it is animated. */
  animated: boolean;
  /** Who uploaded it. */
  creator_id?: Snowflake;
  /** When it was created. */
  created_at?: ISO8601Timestamp;
  /** When it last changed. */
  updated_at?: ISO8601Timestamp;
}

/** An invite. */
export interface APIInvite {
  /** The code (`code@domain` for an invite to another instance). */
  code: string;
  /** The space. */
  space_id: Snowflake;
  /** Who created it. */
  inviter_id: Snowflake;
  /** Uses allowed (0 = unlimited). */
  max_uses: number;
  /** Uses so far. */
  current_uses: number;
  /** When it was created. */
  created_at: ISO8601Timestamp;
  /** When it expires. */
  expires_at?: ISO8601Timestamp;
  /** The creator. */
  inviter?: APIUserSummary;
}

/** An invite preview (`GET /spaces/invites/:code`, no auth). */
export interface APIInvitePreview {
  /** The space, without roles. */
  space: APISpace;
  /** Who invited, if known. */
  inviter: { display_name: string } | null;
  /** Members in the space. */
  member_count: number;
}

/** A ban. */
export interface APIBan {
  /** The banned user. */
  user_id: Snowflake;
  /** Reason given. */
  reason: string;
  /** Who banned them. */
  banned_by: Snowflake;
  /** When. */
  created_at: ISO8601Timestamp;
  /** The banned user, when known. */
  user?: APIUserSummary;
  /** The moderator, when known. */
  banned_by_user?: APIUserSummary;
}

/** Audit-log action types. */
export type AuditLogActionType =
  | 'space_update'
  | 'room_create'
  | 'room_update'
  | 'room_delete'
  | 'role_create'
  | 'role_update'
  | 'role_delete'
  | 'member_kick'
  | 'member_ban_add'
  | 'member_ban_remove'
  | 'member_roles_update'
  | 'invite_create'
  | 'invite_delete'
  | 'emoji_create'
  | 'emoji_update'
  | 'emoji_delete'
  | 'override_update'
  | 'override_delete'
  | 'bot_add'
  | 'ownership_transfer'
  | 'member_voice_mute'
  | 'member_voice_deafen'
  | 'member_voice_move'
  | 'member_voice_disconnect'
  | 'member_nick_update'
  | 'member_profile_reset';

/** One audit-log entry. */
export interface APIAuditLogEntry {
  /** Entry id. */
  id: Snowflake;
  /** What happened. */
  action_type: AuditLogActionType;
  /** Who did it. */
  user_id: Snowflake;
  /** What it was done to: an id, or `"<room>:role:<role>"` for overrides. */
  target_id: string;
  /** When. */
  created_at: ISO8601Timestamp;
  /** Field changes. */
  changes?: Record<string, { old?: unknown; new?: unknown }>;
  /** Reason (bans only). */
  reason?: string;
}

/** `GET /spaces/:id/audit-log`. */
export interface APIAuditLog {
  /** Entries, newest first. */
  entries: APIAuditLogEntry[];
  /** Users referenced by the entries. */
  users: Record<Snowflake, APIUserSummary>;
}

/** `GET /spaces/:id/widget.json` (no auth; 404 unless the space widget is on). */
export interface APISpaceWidget {
  /** Space id. */
  id: Snowflake;
  /** Name. */
  name: string;
  /** Icon URL. */
  icon: string;
  /** Description. */
  description: string;
  /** Members. */
  member_count: number;
  /** Members online. */
  presence_count: number;
  /** An invite code, if the widget has one. */
  instant_invite: string | null;
  /** The room the invite opens. */
  invite_room_name?: string;
}

import type { Snowflake } from '../../util/Snowflake.js';
import type { APIPresence, ISO8601Timestamp } from './common.js';

/**
 * Badge bits in `public_flags`.
 */
export const UserFlags = {
  /** Founder. */
  Founder: 1 << 0,
  /** Strafe staff. */
  Staff: 1 << 1,
  /** Support team. */
  Support: 1 << 2,
  /** Code contributor. */
  Contributor: 1 << 3,
  /** Translator. */
  Translator: 1 << 4,
  /** Reported a security bug. */
  BugDisclosure: 1 << 5,
  /** Alpha tester. */
  AlphaTester: 1 << 6,
} as const;

/**
 * A user as embedded in messages (`author`, `mention_users`), members and participants.
 *
 * `avatar` and `banner` are FULL URLs on the user's instance CDN, or `""`; there is no hash to
 * build a URL from. For people from other instances, `home_domain` names their instance and
 * `origin_id` their id there; `id` is this instance's local id for them.
 */
export interface APIUser {
  /** This instance's id for the user. */
  id: Snowflake;
  /** Unique, case-insensitive name (no discriminator). */
  username: string;
  /** Display name (may be empty). */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Profile bio. */
  bio: string;
  /** Short "about me". */
  about_me: string;
  /** Pronouns. */
  pronouns: string;
  /** Whether the account is a bot. */
  bot: boolean;
  /** The instance's official account (sender of official notices). */
  system?: boolean;
  /** Badge bits ({@link UserFlags}). */
  public_flags: number;
  /** Presence, when the server includes it. */
  presence?: APIPresence;
  /** `MM-DD`, only when the user opted in. */
  birthday?: string;
  /** Whether today is their birthday (opted-in users only). */
  is_birthday?: boolean;
  /** The user's home instance domain (set when the serving instance federates). */
  home_domain?: string;
  /** The id their home instance knows them by (equals `id` for local users). */
  origin_id?: Snowflake;
  /** Accent color (`#rrggbb` or `""`), in some payloads. */
  accent_color?: string;
}

/** The current account (`GET /users/@me`). */
export interface APISelfUser extends Omit<APIUser, 'presence' | 'birthday'> {
  /** For a bot, a synthetic `bot+<id>@bots.invalid`; `""` for OAuth2 tokens without the `email` scope. */
  email: string;
  /** Whether the email is verified. */
  verified_email: boolean;
  /** Accent color (`#rrggbb` or `""`). */
  accent_color: string;
  /** Whether the birthday is shared. */
  birthday_opt_in: boolean;
  /** `MM-DD` or `""`. */
  birthday: string;
  /** When the account was created. */
  created_at: ISO8601Timestamp;
  /** Own presence. */
  presence?: APIPresence;
}

/** The lighter user form in bans, audit logs and invites. */
export interface APIUserSummary {
  /** User id. */
  id: Snowflake;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Badge bits. */
  public_flags: number;
  /** Whether the account is a bot. */
  bot: boolean;
  /** Pronouns. */
  pronouns?: string;
  /** `MM-DD` (opted-in users). */
  birthday?: string;
  /** Whether today is their birthday. */
  is_birthday?: boolean;
}

/** A user in a reaction's user list. */
export interface APIReactionUser {
  /** User id. */
  id: Snowflake;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Whether the account is a bot. */
  bot: boolean;
}

/** A participant of a PM or group PM. */
export interface APIParticipant {
  /** User id. */
  id: Snowflake;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Avatar URL. */
  avatar?: string;
  /** Banner URL. */
  banner?: string;
  /** Bio. */
  bio?: string;
  /** About me. */
  about_me?: string;
  /** Badge bits. */
  public_flags: number;
  /** Whether the account is a bot. */
  bot?: boolean;
  /** The instance's official account. */
  system?: boolean;
  /** Presence. */
  presence?: APIPresence;
  /** Home instance domain. */
  home_domain?: string;
  /** Id on the home instance. */
  origin_id?: Snowflake;
}

/** The profile returned by `PATCH /users/@me` and the avatar/banner uploads. */
export interface APIOwnProfile {
  /** User id. */
  id: Snowflake;
  /** Email (synthetic for bots). */
  email: string;
  /** Whether the email is verified. */
  verified_email: boolean;
  /** Username. */
  username: string;
  /** Display name. */
  display_name: string;
  /** Bio. */
  bio: string;
  /** About me. */
  about_me: string;
  /** Avatar URL or `""`. */
  avatar: string;
  /** Banner URL or `""`. */
  banner: string;
  /** Accent color. */
  accent_color: string;
  /** Pronouns. */
  pronouns: string;
  /** Whether the birthday is shared. */
  birthday_opt_in: boolean;
  /** `MM-DD` or `""`. */
  birthday: string;
  /** Presence. */
  presence?: APIPresence;
}

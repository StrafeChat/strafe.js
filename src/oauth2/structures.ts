import type { APIPartialSpace } from '../types/api/space.js';
import type { APIApplicationSummary, APIOAuth2CurrentAuthorization, APIOAuth2TokenResponse } from '../types/api/oauth2.js';
import type { APISelfUser } from '../types/api/user.js';
import { userMention } from '../util/Formatters.js';
import { PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { UserFlagsBitField } from '../util/UserFlagsBitField.js';
import { emptyToNull, parseTimestamp } from '../util/Util.js';

/**
 * A token pair from {@link OAuth2Client.exchangeCode} or {@link OAuth2Client.refreshToken}. Plain
 * data, so it survives `JSON.stringify` into a session store.
 *
 * Strafe keeps one live pair per person and application: a new consent or a refresh replaces the
 * previous pair, so store the newest one.
 */
export interface OAuth2Tokens {
  /** Send as `Authorization: Bearer <accessToken>`. Valid for {@link OAuth2Tokens.expiresIn} seconds (7 days). */
  accessToken: string;
  /** Trade it for a new pair with {@link OAuth2Client.refreshToken}. It does not expire on its own. */
  refreshToken: string;
  /** Always `Bearer`. */
  tokenType: 'Bearer';
  /** Seconds the access token was valid for when it was issued. */
  expiresIn: number;
  /** When the access token expires (Unix ms, computed from the time of the response). */
  expiresTimestamp: number;
  /** The scopes granted. */
  scopes: string[];
}

/**
 * Turns a token response into {@link OAuth2Tokens}.
 *
 * @param data - The `POST /oauth2/token` body.
 * @param now - Time of the response (Unix ms).
 */
export function toOAuth2Tokens(data: APIOAuth2TokenResponse, now: number = Date.now()): OAuth2Tokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: 'Bearer',
    expiresIn: data.expires_in,
    expiresTimestamp: now + data.expires_in * 1000,
    scopes: data.scope.split(/\s+/).filter((scope) => scope.length > 0),
  };
}

/** The user data {@link OAuth2User} accepts: `GET /users/@me`, or the smaller user in `GET /oauth2/@me`. */
export type APIOAuth2UserLike = Partial<APISelfUser> & { id: Snowflake };

/**
 * The account behind an OAuth2 access token, from {@link OAuth2Client.fetchUser}. It has the
 * read-side shape of {@link User} (`username`, `displayName`, `globalName`, `avatarURL()`, `flags`,
 * `createdAt`...) plus the email, and needs no {@link Client}: a website logging people in has no
 * bot.
 *
 * Fields the token's scopes do not cover are `null` (`email` without the `email` scope).
 */
export class OAuth2User {
  /** The account's id on the instance. */
  public readonly id: Snowflake;
  /** Unique, case-insensitive name (no discriminators on Strafe). */
  public username: string;
  /** The chosen display name (discord.js's `globalName`), or `null`. */
  public globalName: string | null;
  /** Avatar URL, or `null`. */
  public avatar: string | null;
  /** Banner URL, or `null`. */
  public banner: string | null;
  /** Profile bio. */
  public bio: string | null;
  /** Short "about me". */
  public aboutMe: string | null;
  /** Pronouns. */
  public pronouns: string | null;
  /** Accent color as `#rrggbb`, or `null`. */
  public hexAccentColor: string | null;
  /** Whether the account is a bot (always false for a person who signed in). */
  public bot: boolean;
  /** Badges. */
  public flags: Readonly<UserFlagsBitField>;
  /** The email, with the `email` scope; `null` otherwise. */
  public email: string | null;
  /** Whether the email is verified (`null` without the `email` scope). */
  public verified: boolean | null;
  /** `MM-DD` when the person shares their birthday, else `null`. */
  public birthday: string | null;
  /** When the account was created (Unix ms). */
  public createdTimestamp: number;

  /**
   * @param data - `GET /users/@me` (or the user in `GET /oauth2/@me`).
   */
  public constructor(data: APIOAuth2UserLike) {
    this.id = data.id;
    this.username = data.username ?? '';
    this.globalName = emptyToNull(data.display_name);
    this.avatar = emptyToNull(data.avatar);
    this.banner = emptyToNull(data.banner);
    this.bio = emptyToNull(data.bio);
    this.aboutMe = emptyToNull(data.about_me);
    this.pronouns = emptyToNull(data.pronouns);
    this.hexAccentColor = emptyToNull(data.accent_color);
    this.bot = data.bot ?? false;
    this.flags = new UserFlagsBitField(data.public_flags ?? 0).freeze();
    const email = emptyToNull(data.email);
    this.email = email;
    this.verified = email === null ? null : (data.verified_email ?? false);
    this.birthday = emptyToNull(data.birthday);
    this.createdTimestamp = parseTimestamp(data.created_at) ?? SnowflakeUtil.timestampFrom(data.id);
  }

  /** The display name if set, else the username. */
  public get displayName(): string {
    return this.globalName ?? this.username;
  }

  /**
   * The handle. A token is always for an account on the instance that issued it, so this is the
   * username (people from other instances sign in on their own instance).
   */
  public get handle(): string {
    return this.username;
  }

  /** discord.js's `tag`: the {@link OAuth2User.handle} (Strafe has no discriminators). */
  public get tag(): string {
    return this.handle;
  }

  /** The accent color as a number, or `null`. */
  public get accentColor(): number | null {
    return this.hexAccentColor === null ? null : Number.parseInt(this.hexAccentColor.replace('#', ''), 16);
  }

  /** When the account was created. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** The avatar URL, or `null` (Strafe serves one full URL, with no size variants). */
  public avatarURL(): string | null {
    return this.avatar;
  }

  /** Same as {@link OAuth2User.avatarURL}: Strafe has no default avatar image. */
  public displayAvatarURL(): string | null {
    return this.avatar;
  }

  /** The banner URL, or `null`. */
  public bannerURL(): string | null {
    return this.banner;
  }

  /** The mention, `<@id>`. */
  public toString(): `<@${Snowflake}>` {
    return userMention(this.id);
  }

  /** Plain JSON. */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      username: this.username,
      globalName: this.globalName,
      displayName: this.displayName,
      avatar: this.avatar,
      banner: this.banner,
      bio: this.bio,
      aboutMe: this.aboutMe,
      pronouns: this.pronouns,
      hexAccentColor: this.hexAccentColor,
      bot: this.bot,
      flags: this.flags.bitfield,
      email: this.email,
      verified: this.verified,
      birthday: this.birthday,
      createdTimestamp: this.createdTimestamp,
    };
  }
}

/** A space the person is in, from {@link OAuth2Client.fetchSpaces} (the `spaces` scope). */
export class OAuth2Space {
  /** Space id. */
  public readonly id: Snowflake;
  /** Name. */
  public name: string;
  /** Initials, shown when there is no icon. */
  public nameAcronym: string;
  /** Icon URL, or `null`. */
  public icon: string | null;
  /** Banner URL, or `null`. */
  public banner: string | null;
  /** Whether the person owns the space. */
  public owner: boolean;
  /** The person's space-wide permissions there (every permission for the owner). */
  public permissions: Readonly<PermissionsBitField>;

  /**
   * @param data - One entry of `GET /users/@me/spaces`.
   */
  public constructor(data: APIPartialSpace) {
    this.id = data.id;
    this.name = data.name;
    this.nameAcronym = data.name_acronym;
    this.icon = emptyToNull(data.icon);
    this.banner = emptyToNull(data.banner);
    this.owner = data.owner;
    this.permissions = new PermissionsBitField(BigInt(data.permissions)).freeze();
  }

  /** When the space was created (from the id). */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /** When the space was created. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** The icon URL, or `null`. */
  public iconURL(): string | null {
    return this.icon;
  }

  /** The banner URL, or `null`. */
  public bannerURL(): string | null {
    return this.banner;
  }

  /** The name. */
  public toString(): string {
    return this.name;
  }

  /** Plain JSON. */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      nameAcronym: this.nameAcronym,
      icon: this.icon,
      banner: this.banner,
      owner: this.owner,
      permissions: this.permissions.toJSON(),
    };
  }
}

/** The application an access token belongs to (`GET /oauth2/@me`). */
export interface OAuth2Application {
  /** Application id; equals its client id and its bot's user id. */
  id: Snowflake;
  /** Name. */
  name: string;
  /** Description. */
  description: string;
  /** Icon URL, or `null`. */
  icon: string | null;
  /** Whether it has a bot. */
  hasBot: boolean;
  /** Whether anyone may install the bot (otherwise only its owner). */
  botPublic: boolean;
}

/** What an access token is, from {@link OAuth2Client.fetchCurrentAuthorization} (`GET /oauth2/@me`). */
export class OAuth2Authorization {
  /** The application the token was issued to. */
  public application: OAuth2Application;
  /** The scopes granted. */
  public scopes: string[];
  /** When the access token expires (Unix ms). */
  public expiresTimestamp: number;
  /** The person, with the `identify` or `email` scope; `null` otherwise. Has no email. */
  public user: OAuth2User | null;

  /**
   * @param data - The `GET /oauth2/@me` body.
   */
  public constructor(data: APIOAuth2CurrentAuthorization) {
    this.application = toApplication(data.application);
    this.scopes = [...data.scopes];
    this.expiresTimestamp = parseTimestamp(data.expires) ?? 0;
    this.user = data.user === undefined ? null : new OAuth2User(data.user);
  }

  /** When the access token expires. */
  public get expiresAt(): Date {
    return new Date(this.expiresTimestamp);
  }

  /**
   * Whether every given scope was granted.
   *
   * @param scopes - Scopes to check.
   */
  public hasScopes(...scopes: string[]): boolean {
    return scopes.every((scope) => this.scopes.includes(scope));
  }

  /** Plain JSON. */
  public toJSON(): Record<string, unknown> {
    return { application: this.application, scopes: this.scopes, expiresTimestamp: this.expiresTimestamp, user: this.user?.toJSON() ?? null };
  }
}

function toApplication(data: APIApplicationSummary): OAuth2Application {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    icon: emptyToNull(data.icon),
    hasBot: data.has_bot,
    botPublic: data.bot_public,
  };
}

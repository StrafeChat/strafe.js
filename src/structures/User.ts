import type { Client } from '../client/Client.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { RoomType } from '../types/api/room.js';
import type { APIUser } from '../types/api/user.js';
import { userMention } from '../util/Formatters.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { UserFlagsBitField } from '../util/UserFlagsBitField.js';
import { emptyToNull } from '../util/Util.js';
import { Base } from './Base.js';
import { Presence } from './Presence.js';
import type { PMRoom } from './rooms/PMRoom.js';

/**
 * Any of the user shapes the server sends (message authors, members, participants, reactors, ban
 * and audit-log summaries, voice states): only `id` is always there.
 */
export type APIUserLike = { id: Snowflake } & Partial<Omit<APIUser, 'id'>>;

/**
 * Accepted by `avatarURL()` and friends for discord.js compatibility. Strafe serves the uploaded
 * file at one full URL with no size or format variants, so these are ignored.
 */
export interface ImageURLOptions {
  /** Ignored. */
  size?: number;
  /** Ignored. */
  extension?: string;
  /** Ignored. */
  forceStatic?: boolean;
}

/**
 * A Strafe account: a person, a bot or the instance's official account.
 *
 * Users from other instances (federation) have a local id on this instance; {@link User.handle}
 * (`name@domain`) and {@link User.originId} identify them globally. There is no endpoint to look a
 * user up by id: users come with messages, members, reactions and bans.
 */
export class User extends Base {
  /** This instance's id for the user. */
  declare public readonly id: Snowflake;
  /** Unique, case-insensitive name (no discriminators on Strafe). `null` on a partial user. */
  declare public username: string | null;
  /** @internal */
  declare public _displayName: string | null;
  /** Avatar URL, or `null`. */
  declare public avatar: string | null;
  /** Banner URL, or `null`. */
  declare public banner: string | null;
  /** Profile bio. */
  declare public bio: string | null;
  /** Short "about me". */
  declare public aboutMe: string | null;
  /** Pronouns. */
  declare public pronouns: string | null;
  /** Accent color as `#rrggbb`, when known. */
  declare public hexAccentColor: string | null;
  /** Whether this is a bot (`null` when the payload did not say). */
  declare public bot: boolean | null;
  /** Whether this is the instance's official account (sender of official notices). */
  declare public system: boolean;
  /** Badges, when known. */
  declare public flags: Readonly<UserFlagsBitField> | null;
  /** The user's home instance (set when the serving instance federates). */
  declare public homeDomain: string | null;
  /** The id their home instance knows them by (equals `id` for local users). */
  declare public originId: Snowflake | null;
  /** `MM-DD`, only for users who share their birthday. */
  declare public birthday: string | null;
  /** The presence last seen. */
  declare public presence: Presence | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   */
  public constructor(client: Client, data: APIUserLike) {
    super(client);
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    this.username = null;
    this._displayName = null;
    this.avatar = null;
    this.banner = null;
    this.bio = null;
    this.aboutMe = null;
    this.pronouns = null;
    this.hexAccentColor = null;
    this.bot = null;
    this.system = false;
    this.flags = null;
    this.homeDomain = null;
    this.originId = null;
    this.birthday = null;
    this.presence = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: APIUserLike): void {
    if (data.username !== undefined) this.username = data.username;
    if (data.display_name !== undefined) this._displayName = emptyToNull(data.display_name);
    if (data.avatar !== undefined) this.avatar = emptyToNull(data.avatar);
    if (data.banner !== undefined) this.banner = emptyToNull(data.banner);
    if (data.bio !== undefined) this.bio = data.bio;
    if (data.about_me !== undefined) this.aboutMe = data.about_me;
    if (data.pronouns !== undefined) this.pronouns = data.pronouns;
    if (data.accent_color !== undefined) this.hexAccentColor = emptyToNull(data.accent_color);
    if (data.bot !== undefined) this.bot = data.bot;
    if (data.system !== undefined) this.system = data.system;
    if (data.public_flags !== undefined) this.flags = new UserFlagsBitField(data.public_flags).freeze();
    if (data.home_domain !== undefined) this.homeDomain = emptyToNull(data.home_domain);
    if (data.origin_id !== undefined) this.originId = data.origin_id;
    if (data.birthday !== undefined) this.birthday = emptyToNull(data.birthday);
    if (data.presence !== undefined) {
      if (this.presence) this.presence._patch(data.presence);
      else this.presence = new Presence(this.client, this.id, data.presence);
    }
  }

  /** Whether only the id is known (fetch it, or wait for a payload that carries it). */
  public get partial(): boolean {
    return this.username === null;
  }

  /** Display name: the chosen display name, else the username. */
  public get displayName(): string | null {
    return this._displayName ?? this.username;
  }

  /** The chosen display name only (discord.js's `globalName`); `null` when none is set. */
  public get globalName(): string | null {
    return this._displayName;
  }

  /** The accent color as a number, when known. */
  public get accentColor(): number | null {
    return this.hexAccentColor === null ? null : Number.parseInt(this.hexAccentColor.replace('#', ''), 16);
  }

  /**
   * Whether the user lives on another instance. Compares {@link User.homeDomain} with this
   * instance's federation domain (or its host when that is not known yet).
   */
  public get isRemote(): boolean {
    if (this.homeDomain === null) return false;
    const local = (this.client.federationDomain ?? this.client.urls.domain).toLowerCase();
    return this.homeDomain.toLowerCase() !== local;
  }

  /** The handle: `name` for local users, `name@domain` for users of other instances. */
  public get handle(): string | null {
    if (this.username === null) return null;
    return this.isRemote && this.homeDomain !== null ? `${this.username}@${this.homeDomain}` : this.username;
  }

  /**
   * discord.js's `tag`. Strafe has no discriminators, so this is the {@link User.handle}, which is
   * unique: `${user.tag}` in a log line keeps working.
   */
  public get tag(): string | null {
    return this.handle;
  }

  /** When the account was created on this instance (from the id). */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /** When the account was created on this instance. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** The cached PM with this user, if any. */
  public get pmRoom(): PMRoom | null {
    for (const room of this.client.rooms.cache.values()) {
      if (room.type === RoomType.PM && room.recipientId === this.id) return room;
    }
    return null;
  }

  /**
   * The avatar URL, or `null`. Strafe stores one file per avatar, so there are no size variants.
   *
   * @param _options - Ignored (see {@link ImageURLOptions}).
   */
  public avatarURL(_options?: ImageURLOptions): string | null {
    return this.avatar;
  }

  /**
   * The avatar URL, or `null` when there is none (Strafe has no default avatar image; clients draw initials).
   *
   * @param options - Ignored.
   */
  public displayAvatarURL(options?: ImageURLOptions): string | null {
    return this.avatarURL(options);
  }

  /**
   * The banner URL, or `null`.
   *
   * @param _options - Ignored.
   */
  public bannerURL(_options?: ImageURLOptions): string | null {
    return this.banner;
  }

  /**
   * Opens (or returns) the PM with this user. Note that a 1:1 PM is always end-to-end encrypted,
   * so a bot can open one but not post in it.
   *
   * @param force - Ask the server even when a PM is cached.
   */
  public createPM(force = false): Promise<PMRoom> {
    return this.client.users.createPM(this, { force });
  }

  /**
   * Not possible for bots: PMs between two accounts are always end-to-end encrypted on Strafe and a
   * bot has no keys. Always rejects with {@link ErrorCodes.PMsEncrypted}; reply in a space room instead.
   *
   * @param _options - Ignored.
   */
  public send(_options?: unknown): Promise<never> {
    return Promise.reject(new StrafeError(ErrorCodes.PMsEncrypted));
  }

  /**
   * Fetches the user. Only possible for the client's own user (there is no user lookup endpoint);
   * for others this returns the cached user.
   *
   * @param force - Skip the cache.
   */
  public fetch(force = true): Promise<User> {
    return this.client.users.fetch(this.id, { force });
  }

  /**
   * Whether two users hold the same data.
   *
   * @param user - The other user.
   */
  public equals(user: User): boolean {
    return (
      this.id === user.id &&
      this.username === user.username &&
      this._displayName === user._displayName &&
      this.avatar === user.avatar &&
      this.banner === user.banner &&
      this.bot === user.bot
    );
  }

  /** A mention: `<@id>`. */
  public override toString(): `<@${Snowflake}>` {
    return userMention(this.id);
  }

  /** Plain JSON, including the computed names. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), displayName: this.displayName, handle: this.handle, createdTimestamp: this.createdTimestamp };
  }
}

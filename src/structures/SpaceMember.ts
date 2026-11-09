import type { Client } from '../client/Client.js';
import type { BanOptions, SpaceMemberEditOptions } from '../managers/SpaceMemberManager.js';
import { SpaceMemberRoleManager } from '../managers/SpaceMemberRoleManager.js';
import type { GatewaySpaceMemberAddData, GatewaySpaceMemberUpdateData } from '../types/api/gateway.js';
import type { APIMember } from '../types/api/space.js';
import { userMention } from '../util/Formatters.js';
import { PermissionFlagsBits, PermissionsBitField, computeSpacePermissions } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { emptyToNull, parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { Presence } from './Presence.js';
import type { BaseSpaceRoom } from './rooms/BaseSpaceRoom.js';
import type { PMRoom } from './rooms/PMRoom.js';
import type { ThreadRoom } from './rooms/ThreadRoom.js';
import type { Space } from './Space.js';
import type { ImageURLOptions, User } from './User.js';
import type { VoiceState } from './VoiceState.js';

/** Any member payload: REST (`roles`), `SPACE_MEMBER_ADD` (`role_ids`) or `SPACE_MEMBER_UPDATE` (`user_id`). */
export type APIMemberLike = Partial<APIMember> &
  Partial<Omit<GatewaySpaceMemberAddData, 'space_id'>> &
  Partial<Omit<GatewaySpaceMemberUpdateData, 'space_id'>> & { id?: Snowflake; user_id?: Snowflake; space_id?: Snowflake };

const USER_KEYS = [
  'username',
  'display_name',
  'avatar',
  'banner',
  'bio',
  'about_me',
  'pronouns',
  'bot',
  'public_flags',
  'presence',
  'home_domain',
  'origin_id',
] as const;

/**
 * A member of a space. Members are not in READY: they arrive with
 * `space.members.fetch()` and member events. Per-space profile fields (nickname, avatar, banner,
 * bio, pronouns) override the account's own in that space.
 */
export class SpaceMember extends Base {
  /** The space. */
  declare public readonly space: Space;
  /** The user id. */
  declare public readonly id: Snowflake;
  /** The nickname in this space. */
  declare public nickname: string | null;
  /** The space avatar URL. */
  declare public spaceAvatar: string | null;
  /** The space banner URL. */
  declare public spaceBanner: string | null;
  /** The space bio. */
  declare public spaceBio: string | null;
  /** The space pronouns. */
  declare public spacePronouns: string | null;
  /** The space "about me". */
  declare public spaceAboutMe: string | null;
  /** When they joined (Unix ms); `null` on a partial member. */
  declare public joinedTimestamp: number | null;
  /** Role ids (without `@everyone`). @internal */
  declare public _roles: Snowflake[];
  /** Their roles. */
  declare public readonly roles: SpaceMemberRoleManager;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIMemberLike, space: Space) {
    super(client);
    const id = data.id ?? data.user_id ?? '';
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    Object.defineProperty(this, 'id', { value: id, enumerable: true });
    Object.defineProperty(this, 'roles', { value: new SpaceMemberRoleManager(this), enumerable: false });
    this.nickname = null;
    this.spaceAvatar = null;
    this.spaceBanner = null;
    this.spaceBio = null;
    this.spacePronouns = null;
    this.spaceAboutMe = null;
    this.joinedTimestamp = null;
    this._roles = [];
    if (!client.users.cache.has(id)) client.users._add({ id });
    this._patch(data);
  }

  /**
   * A copy with its own role manager, so `oldMember.roles.cache` in `spaceMemberUpdate` lists the
   * roles from before the change.
   *
   * @internal
   */
  public override _clone(): this {
    const { roles: _roles, ...descriptors } = Object.getOwnPropertyDescriptors(this);
    const clone = Object.defineProperties(Object.create(Object.getPrototypeOf(this) as object) as this, descriptors);
    Object.defineProperty(clone, 'roles', { value: new SpaceMemberRoleManager(clone), enumerable: false });
    return clone;
  }

  /** @internal */
  public _patch(data: APIMemberLike): void {
    const userPart: Record<string, unknown> = {};
    let hasUser = false;
    for (const key of USER_KEYS) {
      if (data[key] !== undefined) {
        userPart[key] = data[key];
        hasUser = true;
      }
    }
    if (hasUser) this.client.users._add({ ...userPart, id: this.id });
    const roles = data.roles ?? data.role_ids;
    if (roles !== undefined) this._roles = roles.filter((role) => role !== this.space.everyoneRoleId);
    if (data.nick !== undefined) this.nickname = emptyToNull(data.nick);
    if (data.space_avatar !== undefined) this.spaceAvatar = emptyToNull(data.space_avatar);
    if (data.space_banner !== undefined) this.spaceBanner = emptyToNull(data.space_banner);
    if (data.space_bio !== undefined) this.spaceBio = emptyToNull(data.space_bio);
    if (data.space_pronouns !== undefined) this.spacePronouns = emptyToNull(data.space_pronouns);
    if (data.space_about_me !== undefined) this.spaceAboutMe = emptyToNull(data.space_about_me);
    if (data.joined_at !== undefined) this.joinedTimestamp = parseTimestamp(data.joined_at);
  }

  /** The account. */
  public get user(): User {
    return this.client.users.cache.get(this.id) ?? this.client.users._add({ id: this.id });
  }

  /** Whether only part of the member is known (`await member.fetch()`). */
  public get partial(): boolean {
    return this.joinedTimestamp === null;
  }

  /** The space id. */
  public get spaceId(): Snowflake {
    return this.space.id;
  }

  /** When they joined. */
  public get joinedAt(): Date | null {
    return this.joinedTimestamp === null ? null : new Date(this.joinedTimestamp);
  }

  /** The name shown in this space: nickname, else display name, else username. */
  public get displayName(): string {
    return this.nickname ?? this.user.displayName ?? this.id;
  }

  /** Presence (account-wide on Strafe). */
  public get presence(): Presence | null {
    return this.user.presence;
  }

  /** Their voice state in this space, when cached. */
  public get voice(): VoiceState | null {
    return this.space.voiceStates.cache.get(this.id) ?? null;
  }

  /** The highest role's color (0 when none). */
  public get displayColor(): number {
    return this.roles.color?.color ?? 0;
  }

  /** The highest role's color as `#rrggbb`. */
  public get displayHexColor(): string {
    return `#${this.displayColor.toString(16).padStart(6, '0')}`;
  }

  /**
   * Space-wide permissions: everything for the owner and Administrators, else `@everyone` plus
   * the member's roles. For a room, use {@link SpaceMember.permissionsIn}.
   */
  public get permissions(): Readonly<PermissionsBitField> {
    return new PermissionsBitField(computeSpacePermissions(this.space._permissionSpaceData(), { id: this.id, roleIds: this._roles })).freeze();
  }

  /**
   * Permissions in a room of this space (overrides and implicit rules applied, like the server).
   *
   * @param room - The room or its id.
   */
  public permissionsIn(room: BaseSpaceRoom | ThreadRoom | Snowflake): Readonly<PermissionsBitField> {
    const resolved = typeof room === 'string' ? this.space.rooms.cache.get(room) : room;
    if (!resolved) throw new TypeError(`Room ${String(room)} is not a cached room of this space`);
    return (resolved.permissionsFor(this) ?? new PermissionsBitField().freeze());
  }

  /**
   * Whether the client outranks this member (owner, or a higher highest role), which kick, ban
   * and nickname changes require. Needs the client's member cached.
   */
  public get manageable(): boolean {
    if (this.id === this.space.ownerId) return false;
    if (this.id === this.client._userId) return false;
    const me = this.space.members.me;
    if (!me) return false;
    if (me.id === this.space.ownerId) return true;
    return me.roles.highest.comparePositionTo(this.roles.highest) > 0;
  }

  /** Whether the client can kick this member (Kick Members and outranks them). */
  public get kickable(): boolean {
    return this.manageable && (this.space.members.me?.permissions.has(PermissionFlagsBits.KickMembers) ?? false);
  }

  /** Whether the client can ban this member (Ban Members and outranks them). */
  public get bannable(): boolean {
    return this.manageable && (this.space.members.me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false);
  }

  /**
   * The space avatar, or `null`.
   *
   * @param _options - Ignored (see {@link ImageURLOptions}).
   */
  public avatarURL(_options?: ImageURLOptions): string | null {
    return this.spaceAvatar;
  }

  /**
   * The avatar shown in this space: the space avatar, else the account's.
   *
   * @param options - Ignored.
   */
  public displayAvatarURL(options?: ImageURLOptions): string | null {
    return this.spaceAvatar ?? this.user.displayAvatarURL(options);
  }

  /**
   * The banner shown in this space: the space banner, else the account's.
   *
   * @param options - Ignored.
   */
  public displayBannerURL(options?: ImageURLOptions): string | null {
    return this.spaceBanner ?? this.user.bannerURL(options);
  }

  /**
   * Edits the member: nickname, profile fields, roles, voice.
   *
   * @param options - What to change.
   */
  public edit(options: SpaceMemberEditOptions): Promise<SpaceMember> {
    return this.space.members.edit(this, options);
  }

  /**
   * Sets the nickname (Change Nickname for yourself, Manage Nicknames and a higher role for others).
   *
   * @param nick - The nickname; `null` clears it.
   * @param _reason - Ignored (Strafe records no reason).
   */
  public setNickname(nick: string | null, _reason?: string): Promise<SpaceMember> {
    return this.edit({ nick });
  }

  /**
   * Kicks the member (Kick Members, and a higher role than theirs).
   *
   * @param _reason - Ignored: Strafe does not record a reason for kicks.
   */
  public async kick(_reason?: string): Promise<this> {
    await this.space.members.kick(this);
    return this;
  }

  /**
   * Bans the member (Ban Members, and a higher role than theirs).
   *
   * @param options - The reason, which the audit log records.
   */
  public async ban(options: BanOptions = {}): Promise<this> {
    await this.space.members.ban(this, options);
    return this;
  }

  /**
   * Fetches the member again.
   *
   * @param force - Skip the cache (default true).
   */
  public fetch(force = true): Promise<SpaceMember> {
    return this.space.members.fetch({ user: this.id, force });
  }

  /** Opens the PM with this member (always end-to-end encrypted; a bot cannot post there). */
  public createPM(force = false): Promise<PMRoom> {
    return this.user.createPM(force);
  }

  /**
   * Not possible for bots (PMs are always end-to-end encrypted); rejects with `PMsEncrypted`.
   *
   * @param options - Ignored.
   */
  public send(options?: unknown): Promise<never> {
    return this.user.send(options);
  }

  /** A mention: `<@id>`. */
  public override toString(): `<@${Snowflake}>` {
    return userMention(this.id);
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), spaceId: this.spaceId, roles: [...this._roles], displayName: this.displayName };
  }
}

/** A member the client only knows by id (from a leave or update event): `partial` is true. */
export type PartialSpaceMember = SpaceMember;

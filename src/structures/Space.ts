import type { Client } from '../client/Client.js';
import { RoleManager } from '../managers/RoleManager.js';
import { SpaceBanManager } from '../managers/SpaceBanManager.js';
import { SpaceEmojiManager } from '../managers/SpaceEmojiManager.js';
import { SpaceInviteManager } from '../managers/SpaceInviteManager.js';
import { SpaceMemberManager } from '../managers/SpaceMemberManager.js';
import { SpaceRoomManager } from '../managers/SpaceRoomManager.js';
import { VoiceStateManager } from '../managers/VoiceStateManager.js';
import { Routes } from '../rest/Routes.js';
import type { APIAuditLog, APISpace, APISpaceWidget, AuditLogActionType } from '../types/api/space.js';
import type { RESTGetAPIAuditLogQuery, RESTPatchAPISpaceJSONBody } from '../types/api/rest.js';
import type { APISpaceRoom } from '../types/api/room.js';
import { SpaceSystemRoomFlags, SpaceVerificationLevel } from '../types/api/space.js';
import { BitField } from '../util/BitField.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import { resolveFile } from '../util/DataResolver.js';
import type { PermissionSpaceData } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { emptyToNull } from '../util/Util.js';
import { SpaceAuditLogs } from './AuditLog.js';
import { Base } from './Base.js';
import type { FederationRef } from './rooms/BaseRoom.js';
import { federationRef } from './rooms/BaseRoom.js';
import type { TextRoom } from './rooms/TextRoom.js';
import type { VoiceRoom } from './rooms/VoiceRoom.js';
import type { SpaceMember } from './SpaceMember.js';
import type { ImageURLOptions } from './User.js';

/** A flag name from {@link SpaceSystemRoomFlags}. */
export type SpaceSystemRoomFlagsString = keyof typeof SpaceSystemRoomFlags;

/** Which join/leave notices a space's system room suppresses. */
export class SpaceSystemRoomFlagsBitField extends BitField<SpaceSystemRoomFlagsString> {
  /** Flag name to bit. */
  public static override Flags: Readonly<Record<SpaceSystemRoomFlagsString, number>> = SpaceSystemRoomFlags;
}

/** What {@link Space.edit} changes. */
export interface SpaceEditOptions {
  /** Name. */
  name?: string;
  /** Description. */
  description?: string;
  /** Room for join/leave notices; `null` clears it. */
  systemRoom?: TextRoom | Snowflake | null;
  /** Notices to suppress. */
  systemRoomFlags?: number;
  /** Default notification level: 0 all messages, 1 mentions only. */
  defaultMessageNotifications?: 0 | 1;
  /** The inactive voice room (what discord.js calls the AFK setting); `null` clears it. */
  inactiveRoom?: VoiceRoom | Snowflake | null;
  /** Seconds before an idle member is moved there: 60, 300, 900, 1800 or 3600. */
  inactiveTimeout?: 60 | 300 | 900 | 1800 | 3600;
  /** Whether the space widget is on. */
  widgetEnabled?: boolean;
  /** Room the space widget invites to; `null` clears it. */
  widgetRoom?: TextRoom | Snowflake | null;
  /** Room for birthday messages; `null` clears it. */
  birthdayRoom?: TextRoom | Snowflake | null;
  /** The birthday message. */
  birthdayMessage?: string;
  /** Verification level 0-3 (bots are exempt from it). */
  verificationLevel?: SpaceVerificationLevel;
  /** Automod rules ({@link SpaceAutomodFlags}). */
  automodFlags?: number;
  /** Mentions per message the mass-mention rule allows (0-50). */
  automodMentionLimit?: number;
  /** Ignored (Strafe records no reason for this). */
  reason?: string;
}

/** Options of {@link Space.fetchAuditLogs}. */
export interface FetchAuditLogsOptions {
  /** Entries before this entry id. */
  before?: Snowflake;
  /** How many (1-100, default 50). */
  limit?: number;
  /** Only this action. */
  type?: AuditLogActionType;
}

function roomId(value: { id: Snowflake } | Snowflake | null): string {
  return value === null ? '' : typeof value === 'string' ? value : value.id;
}

/**
 * A space: rooms, roles, members, emojis, bans and invites. A space hosted
 * on another instance is mirrored here; {@link Space.federation} says where it lives.
 */
export class Space extends Base {
  /** The id. */
  declare public readonly id: Snowflake;
  /** Name. */
  declare public name: string;
  /** Short form of the name (shown when there is no icon). */
  declare public nameAcronym: string;
  /** Description. */
  declare public description: string | null;
  /** Icon URL. */
  declare public icon: string | null;
  /** Banner URL. */
  declare public banner: string | null;
  /** The owner's id. */
  declare public ownerId: Snowflake;
  /** The `@everyone` role's id (its own id on Strafe, not the space id). */
  declare public everyoneRoleId: Snowflake | null;
  /** Verification level (bots are exempt). */
  declare public verificationLevel: SpaceVerificationLevel;
  /** Whether the instance marked this space as official. */
  declare public official: boolean;
  /** Default notification level. */
  declare public defaultMessageNotifications: number;
  /** Feature flags. */
  declare public features: string[];
  /** The inactive voice room (discord.js's `afk` setting). */
  declare public inactiveRoomId: Snowflake | null;
  /** Seconds before idle members are moved to the inactive room. */
  declare public inactiveTimeout: number;
  /** The system room (join/leave notices). */
  declare public systemRoomId: Snowflake | null;
  /** Which notices the system room suppresses. */
  declare public systemRoomFlags: Readonly<SpaceSystemRoomFlagsBitField>;
  /** The birthday room. */
  declare public birthdayRoomId: Snowflake | null;
  /** The birthday message. */
  declare public birthdayMessage: string | null;
  /** The rules room. */
  declare public rulesRoomId: Snowflake | null;
  /** Whether the space widget is on. */
  declare public widgetEnabled: boolean;
  /** The space widget's room. */
  declare public widgetRoomId: Snowflake | null;
  /** Automod rules. */
  declare public automodFlags: number;
  /** Automod's mention limit. */
  declare public automodMentionLimit: number;
  /** Most members. */
  declare public maximumMembers: number | null;
  /** Preferred locale. */
  declare public preferredLocale: string | null;
  /** Where the space lives, when it is hosted on another instance. */
  declare public federation: FederationRef | null;

  /** Members. */
  declare public readonly members: SpaceMemberManager;
  /** Roles. */
  declare public readonly roles: RoleManager;
  /** Rooms (threads included). */
  declare public readonly rooms: SpaceRoomManager;
  /** Custom emojis. */
  declare public readonly emojis: SpaceEmojiManager;
  /** Bans. */
  declare public readonly bans: SpaceBanManager;
  /** Invites. */
  declare public readonly invites: SpaceInviteManager;
  /** Voice states. */
  declare public readonly voiceStates: VoiceStateManager;

  /**
   * @param client - The client.
   * @param data - Wire data (roles and rooms included when present).
   */
  public constructor(client: Client, data: Partial<APISpace> & { id: Snowflake }) {
    super(client);
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    for (const [key, Manager] of [
      ['members', SpaceMemberManager],
      ['roles', RoleManager],
      ['rooms', SpaceRoomManager],
      ['emojis', SpaceEmojiManager],
      ['bans', SpaceBanManager],
      ['invites', SpaceInviteManager],
      ['voiceStates', VoiceStateManager],
    ] as const) {
      Object.defineProperty(this, key, { value: new Manager(this), enumerable: false });
    }
    this.name = '';
    this.nameAcronym = '';
    this.description = null;
    this.icon = null;
    this.banner = null;
    this.ownerId = '';
    this.everyoneRoleId = null;
    this.verificationLevel = SpaceVerificationLevel.None;
    this.official = false;
    this.defaultMessageNotifications = 0;
    this.features = [];
    this.inactiveRoomId = null;
    this.inactiveTimeout = 0;
    this.systemRoomId = null;
    this.systemRoomFlags = new SpaceSystemRoomFlagsBitField().freeze();
    this.birthdayRoomId = null;
    this.birthdayMessage = null;
    this.rulesRoomId = null;
    this.widgetEnabled = false;
    this.widgetRoomId = null;
    this.automodFlags = 0;
    this.automodMentionLimit = 0;
    this.maximumMembers = null;
    this.preferredLocale = null;
    this.federation = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APISpace>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.name_acronym !== undefined) this.nameAcronym = data.name_acronym;
    if (data.description !== undefined) this.description = emptyToNull(data.description);
    if (data.icon !== undefined) this.icon = emptyToNull(data.icon);
    if (data.banner !== undefined) this.banner = emptyToNull(data.banner);
    if (data.owner_id !== undefined) this.ownerId = data.owner_id;
    if (data.everyone_role_id !== undefined) this.everyoneRoleId = data.everyone_role_id;
    if (data.verification_level !== undefined) this.verificationLevel = data.verification_level;
    if (data.official !== undefined) this.official = data.official;
    if (data.default_message_notifications !== undefined) this.defaultMessageNotifications = data.default_message_notifications;
    if (data.features !== undefined) this.features = data.features ?? [];
    if (data.afk_room_id !== undefined) this.inactiveRoomId = emptyToNull(data.afk_room_id);
    if (data.afk_timeout !== undefined) this.inactiveTimeout = data.afk_timeout;
    if (data.system_room_id !== undefined) this.systemRoomId = emptyToNull(data.system_room_id);
    if (data.system_room_flags !== undefined) this.systemRoomFlags = new SpaceSystemRoomFlagsBitField(data.system_room_flags).freeze();
    if (data.birthday_channel_id !== undefined) this.birthdayRoomId = emptyToNull(data.birthday_channel_id);
    if (data.birthday_message !== undefined) this.birthdayMessage = emptyToNull(data.birthday_message);
    if (data.rules_room_id !== undefined) this.rulesRoomId = emptyToNull(data.rules_room_id);
    if (data.widget_enabled !== undefined) this.widgetEnabled = data.widget_enabled;
    if (data.widget_room_id !== undefined) this.widgetRoomId = emptyToNull(data.widget_room_id);
    if (data.automod_flags !== undefined) this.automodFlags = data.automod_flags;
    if (data.automod_mention_limit !== undefined) this.automodMentionLimit = data.automod_mention_limit;
    if (data.max_members !== undefined) this.maximumMembers = data.max_members;
    if (data.preferred_locale !== undefined) this.preferredLocale = emptyToNull(data.preferred_locale);
    if (data.federation !== undefined) this.federation = federationRef(data.federation);
    if (data.roles !== undefined) this.roles._setAll(data.roles);
    if (data.rooms !== undefined) this._patchRooms(data.rooms);
  }

  /**
   * Adds or patches rooms of this space (READY's `space_rooms` entry, or `SPACE_CREATE`'s `rooms`).
   *
   * @internal
   */
  public _patchRooms(rooms: readonly APISpaceRoom[]): void {
    for (const room of rooms) this.client.rooms._add(room, this);
  }

  /** The data the permission resolver needs. @internal */
  public _permissionSpaceData(): PermissionSpaceData {
    const rolePermissions = new Map<Snowflake, bigint>();
    for (const role of this.roles.cache.values()) rolePermissions.set(role.id, role.permissions.bitfield);
    return { ownerId: this.ownerId, everyoneRoleId: this.everyoneRoleId, rolePermissions };
  }

  /** When the space was created. */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /** When the space was created. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** Whether the space is mirrored from another instance. */
  public get federated(): boolean {
    return this.federation !== null;
  }

  /** The cached owner member. */
  public get owner(): SpaceMember | null {
    return this.members.cache.get(this.ownerId) ?? null;
  }

  /** The system room, when cached. */
  public get systemRoom(): TextRoom | null {
    const room = this.systemRoomId === null ? undefined : this.rooms.cache.get(this.systemRoomId);
    return room?.isTextRoom() ? room : null;
  }

  /** The inactive voice room, when cached. */
  public get inactiveRoom(): VoiceRoom | null {
    const room = this.inactiveRoomId === null ? undefined : this.rooms.cache.get(this.inactiveRoomId);
    return room?.isVoiceBased() ? room : null;
  }

  /** The rules room, when cached. */
  public get rulesRoom(): TextRoom | null {
    const room = this.rulesRoomId === null ? undefined : this.rooms.cache.get(this.rulesRoomId);
    return room?.isTextRoom() ? room : null;
  }

  /** The space widget's room, when cached. */
  public get widgetRoom(): TextRoom | null {
    const room = this.widgetRoomId === null ? undefined : this.rooms.cache.get(this.widgetRoomId);
    return room?.isTextRoom() ? room : null;
  }

  /**
   * The icon URL, or `null`.
   *
   * @param _options - Ignored (Strafe serves one file).
   */
  public iconURL(_options?: ImageURLOptions): string | null {
    return this.icon;
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
   * Fetches the space again (with its roles).
   *
   * @param force - Skip the cache (default true).
   */
  public fetch(force = true): Promise<Space> {
    return this.client.spaces.fetch({ space: this.id, force });
  }

  /** Fetches the owner's member. */
  public fetchOwner(): Promise<SpaceMember> {
    return this.members.fetch(this.ownerId);
  }

  /**
   * Edits the space (Manage Space).
   *
   * @param options - What to change.
   */
  public async edit(options: SpaceEditOptions): Promise<this> {
    const body: RESTPatchAPISpaceJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.description !== undefined) body.description = options.description;
    if (options.systemRoom !== undefined) body.system_room_id = roomId(options.systemRoom);
    if (options.systemRoomFlags !== undefined) body.system_room_flags = options.systemRoomFlags;
    if (options.defaultMessageNotifications !== undefined) body.default_message_notifications = options.defaultMessageNotifications;
    if (options.inactiveRoom !== undefined) body.afk_room_id = roomId(options.inactiveRoom);
    if (options.inactiveTimeout !== undefined) body.afk_timeout = options.inactiveTimeout;
    if (options.widgetEnabled !== undefined) body.widget_enabled = options.widgetEnabled;
    if (options.widgetRoom !== undefined) body.widget_room_id = roomId(options.widgetRoom);
    if (options.birthdayRoom !== undefined) body.birthday_channel_id = roomId(options.birthdayRoom);
    if (options.birthdayMessage !== undefined) body.birthday_message = options.birthdayMessage;
    if (options.verificationLevel !== undefined) body.verification_level = options.verificationLevel;
    if (options.automodFlags !== undefined) body.automod_flags = options.automodFlags;
    if (options.automodMentionLimit !== undefined) body.automod_mention_limit = options.automodMentionLimit;
    const data = await this.client.rest.patch<APISpace>(Routes.space(this.id), { body });
    this._patch(data);
    return this;
  }

  /**
   * Renames the space.
   *
   * @param name - The new name.
   */
  public setName(name: string): Promise<this> {
    return this.edit({ name });
  }

  /**
   * Sets the system room.
   *
   * @param room - The room, or `null`.
   */
  public setSystemRoom(room: TextRoom | Snowflake | null): Promise<this> {
    return this.edit({ systemRoom: room });
  }

  /**
   * Sets the verification level.
   *
   * @param level - 0-3.
   */
  public setVerificationLevel(level: SpaceVerificationLevel): Promise<this> {
    return this.edit({ verificationLevel: level });
  }

  /**
   * Uploads a new icon (Manage Space).
   *
   * @param icon - The image.
   */
  public setIcon(icon: BufferResolvable): Promise<this> {
    return this.upload(Routes.spaceIcon(this.id), icon);
  }

  /**
   * Uploads a new banner (Manage Space).
   *
   * @param banner - The image.
   */
  public setBanner(banner: BufferResolvable): Promise<this> {
    return this.upload(Routes.spaceBanner(this.id), banner);
  }

  private async upload(route: ReturnType<typeof Routes.spaceIcon>, file: BufferResolvable): Promise<this> {
    const resolved = await resolveFile(file, undefined, this.client.rest.options.makeRequest);
    const data = await this.client.rest.post<APISpace>(route, {
      files: [{ name: resolved.name, data: resolved.data, ...(resolved.contentType === undefined ? {} : { contentType: resolved.contentType }) }],
    });
    this._patch(data);
    return this;
  }

  /**
   * Hands the space to another member (owner only).
   *
   * @param member - The new owner.
   */
  public async setOwner(member: SpaceMember | Snowflake): Promise<this> {
    const data = await this.client.rest.post<APISpace>(Routes.spaceTransferOwnership(this.id), {
      body: { user_id: typeof member === 'string' ? member : member.id },
    });
    this._patch(data);
    return this;
  }

  /**
   * Fetches a page of the audit log (Manage Space or Administrator).
   *
   * @param options - Paging and an action filter.
   */
  public async fetchAuditLogs(options: FetchAuditLogsOptions = {}): Promise<SpaceAuditLogs> {
    const query: RESTGetAPIAuditLogQuery = {};
    if (options.before !== undefined) query.before = options.before;
    if (options.limit !== undefined) query.limit = options.limit;
    if (options.type !== undefined) query.action = options.type;
    const data = await this.client.rest.get<APIAuditLog>(Routes.spaceAuditLog(this.id), { query: { ...query } });
    return new SpaceAuditLogs(this.client, this, data);
  }

  /** Fetches the space widget's data (404 unless the widget is on). */
  public fetchWidget(): Promise<APISpaceWidget> {
    return this.client.rest.get<APISpaceWidget>(Routes.spaceWidget(this.id), { auth: false });
  }

  /** Leaves the space (the owner must transfer or delete it instead). */
  public async leave(): Promise<this> {
    await this.client.rest.post(Routes.spaceLeave(this.id));
    this.client.spaces._remove(this.id);
    return this;
  }

  /** Deletes the space (owner only; the server asks for its exact name, which this sends). */
  public async delete(): Promise<this> {
    await this.client.rest.delete(Routes.space(this.id), { body: { name: this.name } });
    this.client.spaces._remove(this.id);
    return this;
  }

  /** The name. */
  public override toString(): string {
    return this.name;
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      systemRoomFlags: this.systemRoomFlags.bitfield,
      roles: this.roles.toJSON(),
      rooms: this.rooms.toJSON(),
      members: this.members.toJSON(),
      emojis: this.emojis.toJSON(),
    };
  }
}

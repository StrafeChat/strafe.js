import { BitField, type BitFieldResolvable } from './BitField.js';
import type { Snowflake } from './Snowflake.js';

/**
 * Strafe's permission bits (`equinox/internal/modules/permissions/bits.go`). The values differ from
 * Discord's (Send Messages is `1n << 1n` here), and some names use Strafe's nouns: `ViewRoom`,
 * `ManageRooms`, `ManageSpace`, `CreateInvite`, `ManageEmojis`, `Video`. Bits are append-only.
 */
export const PermissionFlagsBits = {
  /** See the room and its messages exist (room). */
  ViewRoom: 1n << 0n,
  /** Post messages (room). */
  SendMessages: 1n << 1n,
  /** Read messages sent before you opened the room (room). */
  ReadMessageHistory: 1n << 2n,
  /** Start a new reaction emoji on a message; adding to an existing one needs only View (room). */
  AddReactions: 1n << 3n,
  /** Use custom emoji from other spaces (room). Not enforced by the server today. */
  UseExternalEmojis: 1n << 4n,
  /** Ping `@everyone` / `@here`, and roles that are not mentionable (room). */
  MentionEveryone: 1n << 5n,
  /** Delete and pin others' messages; exempt from slowmode and automod (room). */
  ManageMessages: 1n << 6n,
  /** Create, edit and assign roles below your own; edit room overrides (space). */
  ManageRoles: 1n << 7n,
  /** Create, edit, reorder and delete rooms and sections (space). */
  ManageRooms: 1n << 8n,
  /** Remove members below you (space). */
  KickMembers: 1n << 9n,
  /** Ban members below you (space). */
  BanMembers: 1n << 10n,
  /** Every permission everywhere; still bound by role hierarchy (space). */
  Administrator: 1n << 11n,
  /** Edit the space's settings and read its audit log (space). */
  ManageSpace: 1n << 12n,
  /** Create invites (space). */
  CreateInvite: 1n << 13n,
  /** Upload, rename and delete the space's custom emoji (space). */
  ManageEmojis: 1n << 14n,
  /** Join voice rooms (room). */
  Connect: 1n << 15n,
  /** Talk in voice rooms (room). */
  Speak: 1n << 16n,
  /** Share camera and screen (room). */
  Video: 1n << 17n,
  /** Server-mute others (room). */
  MuteMembers: 1n << 18n,
  /** Server-deafen others (room). */
  DeafenMembers: 1n << 19n,
  /** Move others between voice rooms, and disconnect them (room). */
  MoveMembers: 1n << 20n,
  /** Talk without push-to-talk (room). */
  UseVAD: 1n << 21n,
  /** Be heard over others (room). */
  PrioritySpeaker: 1n << 22n,
  /** Upload files (room). */
  AttachFiles: 1n << 23n,
  /** Start public threads (room). */
  CreatePublicThreads: 1n << 24n,
  /** Start private threads (room). */
  CreatePrivateThreads: 1n << 25n,
  /** Post in threads (instead of Send Messages) (room). */
  SendMessagesInThreads: 1n << 26n,
  /** Rename, archive, lock and delete threads; see private ones (room). */
  ManageThreads: 1n << 27n,
  /** Change your own nickname (space). */
  ChangeNickname: 1n << 28n,
  /** Change others' nicknames and reset their space profiles (space). */
  ManageNicknames: 1n << 29n,
  /** Send embeds, and have links previewed (room). */
  EmbedLinks: 1n << 30n,
} as const;

/** A permission flag name. */
export type PermissionsString = keyof typeof PermissionFlagsBits;

/** Anything {@link PermissionsBitField.resolve} accepts. */
export type PermissionResolvable = BitFieldResolvable<PermissionsString, bigint> | number;

const F = PermissionFlagsBits;

/** Every thread bit. */
const ALL_THREADS = F.CreatePublicThreads | F.CreatePrivateThreads | F.SendMessagesInThreads | F.ManageThreads;
/** Every voice bit. */
const ALL_VOICE = F.Connect | F.Speak | F.Video | F.MuteMembers | F.DeafenMembers | F.MoveMembers | F.UseVAD | F.PrioritySpeaker;
/** Every room-scoped bit (what the owner and Administrators hold in any room). */
const ALL_ROOM =
  F.ViewRoom |
  F.SendMessages |
  F.ReadMessageHistory |
  F.AddReactions |
  F.UseExternalEmojis |
  F.MentionEveryone |
  F.ManageMessages |
  F.AttachFiles |
  ALL_THREADS |
  ALL_VOICE |
  F.EmbedLinks;
/** Every bit. */
const ALL_SPACE =
  ALL_ROOM |
  F.ManageRoles |
  F.ManageRooms |
  F.KickMembers |
  F.BanMembers |
  F.Administrator |
  F.ManageSpace |
  F.CreateInvite |
  F.ManageEmojis |
  F.ChangeNickname |
  F.ManageNicknames;
/** What `@everyone` gets in a new space. */
const DEFAULT_EVERYONE =
  F.ViewRoom |
  F.SendMessages |
  F.ReadMessageHistory |
  F.AddReactions |
  F.UseExternalEmojis |
  F.CreateInvite |
  F.AttachFiles |
  F.CreatePublicThreads |
  F.SendMessagesInThreads |
  F.Connect |
  F.Speak |
  F.Video |
  F.UseVAD |
  F.ChangeNickname |
  F.EmbedLinks;

/**
 * A set of permissions, like discord.js's `PermissionsBitField`: a `bigint` inside, Strafe's
 * {@link PermissionFlagsBits}, and Administrator counted as every permission by `has` / `any` /
 * `missing` unless you pass `checkAdmin = false`.
 *
 * Strafe sends and accepts permissions as JSON numbers; `toJSON()` returns one, and the REST
 * client converts bigints in bodies for you.
 *
 * @example
 * ```ts
 * const perms = new PermissionsBitField([PermissionFlagsBits.SendMessages, 'EmbedLinks']);
 * perms.has(PermissionFlagsBits.SendMessages); // true
 * perms.toArray(); // ['SendMessages', 'EmbedLinks']
 * ```
 */
export class PermissionsBitField extends BitField<PermissionsString, bigint> {
  /** Flag name to bit ({@link PermissionFlagsBits}). */
  public static override Flags: Readonly<Record<PermissionsString, bigint>> = PermissionFlagsBits;

  /** Every permission. */
  public static All: bigint = ALL_SPACE;

  /** Every room-scoped permission: what the owner and Administrators hold in a room. */
  public static AllRoom: bigint = ALL_ROOM;

  /** Every thread permission. */
  public static AllThreads: bigint = ALL_THREADS;

  /** Every voice permission. */
  public static AllVoice: bigint = ALL_VOICE;

  /** What `@everyone` gets in a new space (the server's `DefaultEveryone`, 1436786719). */
  public static Default: bigint = DEFAULT_EVERYONE;

  /** `0n`: permissions are bigints. */
  public static override DefaultBit = 0n;

  /**
   * @param bits - Initial permissions: flag names, bigints, wire numbers, or arrays of those.
   */
  public constructor(bits?: PermissionResolvable) {
    super(bits as BitFieldResolvable<PermissionsString, bigint> | undefined);
  }

  /**
   * Whether every permission in `permission` is held.
   *
   * @param permission - Permissions to check.
   * @param checkAdmin - Count Administrator as every permission (default true).
   */
  public override has(permission: PermissionResolvable, checkAdmin = true): boolean {
    return (checkAdmin && super.has(PermissionFlagsBits.Administrator)) || super.has(permission as BitFieldResolvable<PermissionsString, bigint>);
  }

  /**
   * Whether any permission in `permission` is held.
   *
   * @param permission - Permissions to check.
   * @param checkAdmin - Count Administrator as every permission (default true).
   */
  public override any(permission: PermissionResolvable, checkAdmin = true): boolean {
    return (checkAdmin && super.has(PermissionFlagsBits.Administrator)) || super.any(permission as BitFieldResolvable<PermissionsString, bigint>);
  }

  /**
   * The names of the permissions in `bits` that are not held.
   *
   * @param bits - Permissions that are needed.
   * @param checkAdmin - Count Administrator as every permission (default true).
   */
  public override missing(bits: PermissionResolvable, checkAdmin = true): PermissionsString[] {
    return checkAdmin && this.has(PermissionFlagsBits.Administrator) ? [] : super.missing(bits as BitFieldResolvable<PermissionsString, bigint>, false);
  }

  /**
   * Whether exactly these permissions are set.
   *
   * @param permission - Permissions to compare with (wire numbers allowed).
   */
  public override equals(permission: PermissionResolvable): boolean {
    return super.equals(permission as BitFieldResolvable<PermissionsString, bigint>);
  }

  /**
   * Adds permissions (on a frozen bitfield, returns a new one).
   *
   * @param permissions - Permissions to add (wire numbers allowed).
   */
  public override add(...permissions: PermissionResolvable[]): this {
    return super.add(...(permissions as BitFieldResolvable<PermissionsString, bigint>[]));
  }

  /**
   * Removes permissions (on a frozen bitfield, returns a new one).
   *
   * @param permissions - Permissions to remove (wire numbers allowed).
   */
  public override remove(...permissions: PermissionResolvable[]): this {
    return super.remove(...(permissions as BitFieldResolvable<PermissionsString, bigint>[]));
  }

  /** The names of the set permissions (Administrator is not expanded). */
  public override toArray(): PermissionsString[] {
    return super.toArray(false);
  }

  /**
   * Every permission name mapped to whether it is held.
   *
   * @param checkAdmin - Count Administrator as every permission (default true).
   */
  public override serialize(checkAdmin = true): Record<PermissionsString, boolean> {
    return super.serialize(checkAdmin);
  }

  /**
   * Turns a resolvable (names, bigints, wire numbers, numeric strings, arrays) into a bigint.
   *
   * @param permission - What to resolve.
   */
  public static override resolve(permission?: unknown): bigint {
    return super.resolve(permission) as bigint;
  }
}

/** One permission override on a room, as {@link computeRoomPermissions} needs it. */
export interface PermissionOverwriteData {
  /** The role or user id. */
  id: Snowflake;
  /** Bits granted. */
  allow: bigint | number;
  /** Bits refused. */
  deny: bigint | number;
}

/** The parts of a space {@link computeSpacePermissions} needs. */
export interface PermissionSpaceData {
  /** The owner's id. */
  ownerId: Snowflake;
  /** The `@everyone` role's id (NOT the space id on Strafe); null if unknown. */
  everyoneRoleId: Snowflake | null;
  /** Each role's permissions. */
  rolePermissions: ReadonlyMap<Snowflake, bigint | number>;
}

/** The parts of a member {@link computeSpacePermissions} needs. */
export interface PermissionMemberData {
  /** The user id. */
  id: Snowflake;
  /** Role ids the member holds (`@everyone` is implied and may be left out). */
  roleIds: readonly Snowflake[];
  /** For private threads: whether the member has joined the thread. */
  isThreadMember?: boolean;
}

/** The parts of a room {@link computeRoomPermissions} needs. */
export interface PermissionRoomData {
  /** Room type: 3 text, 4 voice, 5 section, 6 thread. */
  type: number;
  /** Whether the room uses its section's overrides. */
  permissionsSynced: boolean;
  /** The room's own role overrides. */
  roleOverwrites: readonly PermissionOverwriteData[];
  /** The room's own user overrides. */
  userOverwrites: readonly PermissionOverwriteData[];
  /** The section (or, for a thread, its room), when there is one. */
  parent: PermissionRoomData | null;
  /** For threads: whether the thread is private. */
  privateThread?: boolean;
}

const big = (value: bigint | number): bigint => (typeof value === 'bigint' ? value : BigInt(value));

/** `@everyone` plus every role the member holds, without the Administrator expansion. */
function basePermissions(space: PermissionSpaceData, member: PermissionMemberData): bigint {
  let base = space.everyoneRoleId === null ? 0n : big(space.rolePermissions.get(space.everyoneRoleId) ?? 0);
  for (const roleId of member.roleIds) {
    if (roleId === space.everyoneRoleId) continue;
    base |= big(space.rolePermissions.get(roleId) ?? 0);
  }
  return base;
}

/**
 * The overrides that apply to a room: a thread's room's, a synced room's section's, or its own.
 *
 * @param room - The room.
 */
export function effectiveOverwrites(room: PermissionRoomData): { roles: readonly PermissionOverwriteData[]; users: readonly PermissionOverwriteData[] } {
  if (room.parent) {
    if (room.type === 6) return effectiveOverwrites(room.parent);
    if (room.permissionsSynced) return { roles: room.parent.roleOverwrites, users: room.parent.userOverwrites };
  }
  return { roles: room.roleOverwrites, users: room.userOverwrites };
}

/**
 * A member's space-wide permissions, exactly as the server computes them for management checks:
 * the owner and Administrators hold everything; everyone else holds `@everyone` plus their roles.
 *
 * @param space - Owner, `@everyone` role id and role permissions.
 * @param member - The member's id and roles.
 */
export function computeSpacePermissions(space: PermissionSpaceData, member: PermissionMemberData): bigint {
  if (member.id === space.ownerId) return ALL_SPACE;
  const base = basePermissions(space, member);
  if ((base & F.Administrator) !== 0n) return ALL_SPACE;
  return base;
}

/**
 * A member's permissions in a room, exactly as the server computes them (spaces/snapshot.go):
 *
 * 1. The owner and Administrators hold every room permission ({@link PermissionsBitField.AllRoom}).
 * 2. Otherwise start from `@everyone` plus the member's roles, then apply the effective overrides
 *    (a thread uses its room's, a synced room its section's): the `@everyone` override, then all of
 *    the member's role overrides together (deny, then allow), then the member's own override.
 * 3. Without View Room nothing is held; without Send Messages, Attach Files, Embed Links and
 *    Mention Everyone are dropped.
 * 4. A private thread is invisible to anyone who has not joined it and lacks Manage Threads.
 *
 * @param space - Owner, `@everyone` role id and role permissions.
 * @param room - The room with its overrides and parent chain.
 * @param member - The member's id, roles and (for private threads) thread membership.
 */
export function computeRoomPermissions(space: PermissionSpaceData, room: PermissionRoomData, member: PermissionMemberData): bigint {
  const base = basePermissions(space, member);
  if (member.id === space.ownerId || (base & F.Administrator) !== 0n) return ALL_ROOM;

  const overwrites = effectiveOverwrites(room);
  let perms = base;

  const everyone = overwrites.roles.find((o) => o.id === space.everyoneRoleId);
  if (everyone) perms = (perms & ~big(everyone.deny)) | big(everyone.allow);

  const held = new Set(member.roleIds.filter((id) => id !== space.everyoneRoleId));
  let deny = 0n;
  let allow = 0n;
  for (const o of overwrites.roles) {
    if (!held.has(o.id)) continue;
    deny |= big(o.deny);
    allow |= big(o.allow);
  }
  perms = (perms & ~deny) | allow;

  const own = overwrites.users.find((o) => o.id === member.id);
  if (own) perms = (perms & ~big(own.deny)) | big(own.allow);

  if ((perms & F.ViewRoom) === 0n) perms = 0n;
  else if ((perms & F.SendMessages) === 0n) perms &= ~(F.AttachFiles | F.MentionEveryone | F.EmbedLinks);

  if (room.type === 6 && room.privateThread === true && (perms & F.ManageThreads) === 0n && member.isThreadMember !== true) {
    return 0n;
  }
  return perms;
}

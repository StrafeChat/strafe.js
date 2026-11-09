import type { Client } from '../../client/Client.js';
import { PermissionOverwriteManager } from '../../managers/PermissionOverwriteManager.js';
import type { SpaceRoomEditOptions, SetParentOptions } from '../../managers/SpaceRoomManager.js';
import type { RoomType } from '../../types/api/room.js';
import type { Collection } from '../../util/Collection.js';
import type { PermissionsBitField } from '../../util/PermissionsBitField.js';
import { PermissionFlagsBits } from '../../util/PermissionsBitField.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Space } from '../Space.js';
import type { SpaceMember } from '../SpaceMember.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseRoom } from './BaseRoom.js';
import type { PermissionsTarget } from './permissions.js';
import { permissionsIn } from './permissions.js';
import type { SectionRoom } from './SectionRoom.js';

/**
 * The base of the rooms that live directly in a space: text rooms, voice rooms and sections.
 * Threads are space rooms too but extend {@link BaseRoom}.
 */
export abstract class BaseSpaceRoom extends BaseRoom {
  declare public readonly type: RoomType.SpaceText | RoomType.SpaceVoice | RoomType.SpaceSection;
  /** The space. */
  declare public readonly space: Space;
  /** The name. */
  declare public name: string;
  /** Position within its group (sections among sections, rooms within their section). */
  declare public rawPosition: number;
  /** The section it sits in, if any. */
  declare public parentId: Snowflake | null;
  /** Whether it uses its section's permission overrides instead of its own. */
  declare public permissionsSynced: boolean;
  /** Its own permission overrides. */
  declare public readonly permissionOverwrites: PermissionOverwriteManager;
  /** @internal */
  declare public _updatedAt: string | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType }, space: Space) {
    super(client, data);
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    Object.defineProperty(this, 'permissionOverwrites', { value: new PermissionOverwriteManager(this), enumerable: false });
    this.name = '';
    this.rawPosition = 0;
    this.parentId = null;
    this.permissionsSynced = false;
    this._updatedAt = null;
  }

  /** @internal */
  public override _patch(data: APIRoomLike): void {
    super._patch(data);
    if (data.name !== undefined) this.name = data.name;
    if (data.position !== undefined) this.rawPosition = data.position;
    if (data.parent_id !== undefined) this.parentId = data.parent_id === '' ? null : data.parent_id;
    if (data.permissions_synced !== undefined) this.permissionsSynced = data.permissions_synced;
    if (data.updated_at !== undefined) this._updatedAt = data.updated_at;
    if (data.permission_overrides !== undefined || data.user_overrides !== undefined) {
      this.permissionOverwrites._setFrom(data.permission_overrides, data.user_overrides);
    }
  }

  /**
   * A copy whose permission overrides are a snapshot, so the "old" room of `roomUpdate` keeps the
   * overrides it had.
   *
   * @internal
   */
  public override _clone(): this {
    const descriptors: PropertyDescriptorMap = { ...Object.getOwnPropertyDescriptors(this) };
    Reflect.deleteProperty(descriptors, 'permissionOverwrites');
    const clone = Object.defineProperties(Object.create(Object.getPrototypeOf(this) as object) as this, descriptors);
    const overwrites = new PermissionOverwriteManager(clone);
    for (const [id, overwrite] of this.permissionOverwrites.cache) overwrites._cache.set(id, overwrite._clone());
    Object.defineProperty(clone, 'permissionOverwrites', { value: overwrites, enumerable: false });
    return clone;
  }

  /** The space id. */
  public get spaceId(): Snowflake {
    return this.space.id;
  }

  /** The position, as discord.js's `position` (Strafe positions are already per group). */
  public get position(): number {
    return this.rawPosition;
  }

  /** The section it sits in, when cached. */
  public get parent(): SectionRoom | null {
    if (this.parentId === null) return null;
    const parent = this.space.rooms.cache.get(this.parentId);
    return parent?.isSection() ? parent : null;
  }

  /**
   * Cached members who can see this room. The member list is not part of READY: call
   * `space.members.fetch()` once to fill it.
   */
  public get members(): Collection<Snowflake, SpaceMember> {
    return this.space.members.cache.filter((member) => this.permissionsFor(member)?.has(PermissionFlagsBits.ViewRoom) ?? false);
  }

  /** Whether the client can see this room (needs its member cached; see {@link SpaceMemberManager.fetchMe}). */
  public get viewable(): boolean {
    const me = this.space.members.me;
    return me ? (this.permissionsFor(me)?.has(PermissionFlagsBits.ViewRoom) ?? false) : false;
  }

  /** Whether the client can edit or delete this room (Manage Rooms). */
  public get manageable(): boolean {
    const me = this.space.members.me;
    return me ? (this.permissionsFor(me)?.has(PermissionFlagsBits.ManageRooms) ?? false) : false;
  }

  /** Whether the client can delete this room. */
  public get deletable(): boolean {
    return this.manageable;
  }

  /**
   * A member's or role's permissions here, computed like the server: owner and Administrator hold
   * everything, then `@everyone` and the member's roles, then the overrides (the section's for a
   * synced room), then the implicit rules (no View Room means nothing). `null` when the member is
   * not cached.
   *
   * @param memberOrRole - A member, user, role or id.
   */
  public permissionsFor(memberOrRole: PermissionsTarget): Readonly<PermissionsBitField> | null {
    return permissionsIn(this, memberOrRole);
  }

  /**
   * Edits the room (Manage Rooms).
   *
   * @param options - What to change.
   */
  public edit(options: SpaceRoomEditOptions): Promise<this> {
    return this.space.rooms.edit(this, options) as Promise<this>;
  }

  /**
   * Renames the room.
   *
   * @param name - The new name (at most 100 characters).
   * @param _reason - Ignored (Strafe records no reason).
   */
  public setName(name: string, _reason?: string): Promise<this> {
    return this.edit({ name });
  }

  /**
   * Moves the room into a section, or out of one with `null`.
   *
   * @param section - The section.
   * @param options - `lockPermissions` syncs it with the section afterwards (default true, as discord.js).
   */
  public async setParent(section: SectionRoom | Snowflake | null, options: SetParentOptions = {}): Promise<this> {
    await this.space.rooms.setParent(this, section, options);
    return this;
  }

  /**
   * Moves the room within its group.
   *
   * @param position - The index in its group (0 = first).
   */
  public async setPosition(position: number): Promise<this> {
    await this.space.rooms.setPosition(this, position);
    return this;
  }

  /** Makes the room use its section's overrides (Manage Roles). */
  public lockPermissions(): Promise<this> {
    return this.edit({ permissionsSynced: true });
  }

  /**
   * Deletes the room (Manage Rooms). Deleting a section moves its rooms out of it.
   *
   * @param _reason - Ignored.
   */
  public async delete(_reason?: string): Promise<this> {
    await this.space.rooms.delete(this);
    return this;
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), spaceId: this.spaceId, permissionOverwrites: this.permissionOverwrites.toJSON() };
  }
}

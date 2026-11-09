import type { PermissionOverwriteOptions } from '../structures/PermissionOverwrites.js';
import { OverwriteType, PermissionOverwrites } from '../structures/PermissionOverwrites.js';
import { Role } from '../structures/Role.js';
import type { BaseSpaceRoom } from '../structures/rooms/BaseSpaceRoom.js';
import type { SpaceMember } from '../structures/SpaceMember.js';
import type { User } from '../structures/User.js';
import type { APIRoleOverwrite, APIUserOverwrite } from '../types/api/room.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { Routes } from '../rest/Routes.js';
import { CachedManager } from './BaseManager.js';

/** A role or member an override is for. */
export type OverwriteTarget = Role | SpaceMember | User | Snowflake;

/** Options of override writes. */
export interface OverwriteWriteOptions {
  /** Role or member (guessed from the target when omitted: a cached role id is a role). */
  type?: OverwriteType;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/**
 * A room's permission overrides (Manage Roles; you can only allow or deny permissions you hold in
 * the room). A room synced with its section uses the section's overrides; editing the room's own
 * overrides does not unsync it on Strafe, so turn sync off first with `edit({ permissionsSynced: false })`.
 */
export class PermissionOverwriteManager extends CachedManager<Snowflake, PermissionOverwrites, PermissionOverwrites> {
  /** The room. */
  declare public readonly room: BaseSpaceRoom;

  /**
   * @param room - The room.
   */
  public constructor(room: BaseSpaceRoom) {
    super(room.client, 'PermissionOverwriteManager');
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
  }

  /** Replaces the cache from wire lists. @internal */
  public _setFrom(roles: readonly APIRoleOverwrite[] | undefined, users: readonly APIUserOverwrite[] | undefined): void {
    if (roles !== undefined) {
      for (const [id, overwrite] of [...this._cache]) if (overwrite.type === OverwriteType.Role && !roles.some((r) => r.role_id === id)) this._cache.delete(id);
      for (const role of roles) this._add(role);
    }
    if (users !== undefined) {
      for (const [id, overwrite] of [...this._cache]) if (overwrite.type === OverwriteType.Member && !users.some((u) => u.user_id === id)) this._cache.delete(id);
      for (const user of users) this._add(user);
    }
  }

  /** @internal */
  public _add(data: APIRoleOverwrite | APIUserOverwrite, cache = true): PermissionOverwrites {
    const id = 'role_id' in data ? data.role_id : data.user_id;
    return this._upsert(id, data, cache, () => new PermissionOverwrites(this.client, data, this.room));
  }

  private target(target: OverwriteTarget, type: OverwriteType | undefined): { id: Snowflake; type: OverwriteType } {
    if (typeof target !== 'string') return { id: target.id, type: type ?? (target instanceof Role ? OverwriteType.Role : OverwriteType.Member) };
    if (type !== undefined) return { id: target, type };
    const cached = this.cache.get(target);
    if (cached) return { id: target, type: cached.type };
    return { id: target, type: this.room.space.roles.cache.has(target) ? OverwriteType.Role : OverwriteType.Member };
  }

  private async write(id: Snowflake, type: OverwriteType, allow: bigint, deny: bigint): Promise<PermissionOverwrites> {
    const { space } = this.room;
    const route = type === OverwriteType.Role ? Routes.spaceRoomOverride(space.id, this.room.id, id) : Routes.spaceRoomUserOverride(space.id, this.room.id, id);
    await this.client.rest.put(route, { body: { allow, deny } });
    const now = new Date().toISOString();
    const data =
      type === OverwriteType.Role
        ? { role_id: id, allow: Number(allow), deny: Number(deny), created_at: now, updated_at: now }
        : { user_id: id, allow: Number(allow), deny: Number(deny), created_at: now, updated_at: now };
    return this._add(data);
  }

  /**
   * Sets an override from scratch (anything not named inherits), like discord.js's `create`.
   *
   * @param target - Role or member.
   * @param options - Permissions to allow (`true`) or deny (`false`).
   * @param write - Type and reason.
   */
  public create(target: OverwriteTarget, options: PermissionOverwriteOptions, write: OverwriteWriteOptions = {}): Promise<PermissionOverwrites> {
    const { id, type } = this.target(target, write.type);
    const { allow, deny } = PermissionOverwrites.resolveOverwriteOptions(options);
    return this.write(id, type, allow.bitfield, deny.bitfield);
  }

  /**
   * Changes some permissions of an override, keeping the rest (creates it if missing).
   *
   * @param target - Role or member.
   * @param options - Permissions to allow (`true`), deny (`false`) or reset (`null`).
   * @param write - Type and reason.
   * @example
   * ```ts
   * await room.permissionOverwrites.edit(space.everyoneRoleId!, { SendMessages: false });
   * ```
   */
  public edit(target: OverwriteTarget, options: PermissionOverwriteOptions, write: OverwriteWriteOptions = {}): Promise<PermissionOverwrites> {
    const { id, type } = this.target(target, write.type);
    const existing = this.cache.get(id);
    const { allow, deny } = PermissionOverwrites.resolveOverwriteOptions(options, existing ? { allow: existing.allow.bitfield, deny: existing.deny.bitfield } : {});
    return this.write(id, type, allow.bitfield, deny.bitfield);
  }

  /**
   * Replaces every override of the room.
   *
   * @param overwrites - The new overrides.
   */
  public async set(overwrites: readonly { id: OverwriteTarget; type?: OverwriteType; allow?: bigint | number; deny?: bigint | number }[]): Promise<Collection<Snowflake, PermissionOverwrites>> {
    const keep = new Set<Snowflake>();
    for (const overwrite of overwrites) {
      const { id, type } = this.target(overwrite.id, overwrite.type);
      keep.add(id);
      await this.write(id, type, BigInt(overwrite.allow ?? 0), BigInt(overwrite.deny ?? 0));
    }
    for (const [id, overwrite] of [...this.cache]) if (!keep.has(id)) await this.delete(id, { type: overwrite.type });
    return new Collection(this.cache);
  }

  /**
   * Deletes an override.
   *
   * @param target - Role or member.
   * @param write - Type and reason.
   */
  public async delete(target: OverwriteTarget, write: OverwriteWriteOptions = {}): Promise<void> {
    const { id, type } = this.target(target, write.type);
    const { space } = this.room;
    const route = type === OverwriteType.Role ? Routes.spaceRoomOverride(space.id, this.room.id, id) : Routes.spaceRoomUserOverride(space.id, this.room.id, id);
    await this.client.rest.delete(route);
    this._cache.delete(id);
  }
}

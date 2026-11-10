import type { Client } from '../client/Client.js';
import type { APIRoleOverwrite, APIUserOverwrite } from '../types/api/room.js';
import type { PermissionOverwriteData, PermissionsString } from '../util/PermissionsBitField.js';
import { PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { Base } from './Base.js';
import type { BaseSpaceRoom } from './rooms/BaseSpaceRoom.js';

/** Whether an override is for a role or a member. */
export enum OverwriteType {
  /** A role override. */
  Role = 0,
  /** A member (user) override. */
  Member = 1,
}

/**
 * Permissions to change in an override: `true` allows, `false` denies, `null` resets to "inherit",
 * leaving a permission out keeps its current state. Like discord.js's `PermissionOverwriteOptions`.
 *
 * @example
 * ```ts
 * { SendMessages: false, AddReactions: null }
 * ```
 */
export type PermissionOverwriteOptions = Partial<Record<PermissionsString, boolean | null>>;

/** Resolved allow and deny bits. */
export interface ResolvedOverwriteOptions {
  /** Bits allowed. */
  allow: PermissionsBitField;
  /** Bits denied. */
  deny: PermissionsBitField;
}

/**
 * A permission override on a room, for a role or a member. On a room synced with its section
 * (`permissionsSynced`), the section's overrides apply and the room's own list is empty.
 */
export class PermissionOverwrites extends Base {
  /** The room. */
  declare public readonly room: BaseSpaceRoom;
  /** The role or user id. */
  declare public readonly id: Snowflake;
  /** Role or member override. */
  declare public readonly type: OverwriteType;
  /** Bits allowed. */
  declare public allow: Readonly<PermissionsBitField>;
  /** Bits denied. */
  declare public deny: Readonly<PermissionsBitField>;

  /**
   * @param client - The client.
   * @param data - Wire data (a role or a user override).
   * @param room - The room.
   */
  public constructor(client: Client, data: APIRoleOverwrite | APIUserOverwrite, room: BaseSpaceRoom) {
    super(client);
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
    const isRole = 'role_id' in data;
    Object.defineProperty(this, 'id', { value: isRole ? data.role_id : data.user_id, enumerable: true });
    Object.defineProperty(this, 'type', { value: isRole ? OverwriteType.Role : OverwriteType.Member, enumerable: true });
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIRoleOverwrite>): void {
    this.allow = new PermissionsBitField(data.allow ?? 0).freeze();
    this.deny = new PermissionsBitField(data.deny ?? 0).freeze();
  }

  /**
   * Changes some permissions of this override, keeping the others.
   *
   * @param options - Permissions to allow (`true`), deny (`false`) or reset (`null`).
   */
  public async edit(options: PermissionOverwriteOptions): Promise<this> {
    await this.room.permissionOverwrites.edit(this.id, options, { type: this.type });
    return this;
  }

  /** Deletes the override. */
  public async delete(): Promise<this> {
    await this.room.permissionOverwrites.delete(this.id, { type: this.type });
    return this;
  }

  /** The form {@link computeRoomPermissions} uses. @internal */
  public _data(): PermissionOverwriteData {
    return { id: this.id, allow: this.allow.bitfield, deny: this.deny.bitfield };
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { id: this.id, type: this.type, allow: this.allow.bitfield.toString(), deny: this.deny.bitfield.toString() };
  }

  /**
   * Applies {@link PermissionOverwriteOptions} to existing bits.
   *
   * @param options - What to change.
   * @param initial - The current allow/deny bits.
   */
  public static resolveOverwriteOptions(
    options: PermissionOverwriteOptions,
    initial: { allow?: bigint | number | PermissionsBitField; deny?: bigint | number | PermissionsBitField } = {},
  ): ResolvedOverwriteOptions {
    const allow = new PermissionsBitField(initial.allow ?? 0n);
    const deny = new PermissionsBitField(initial.deny ?? 0n);
    for (const [name, value] of Object.entries(options) as [PermissionsString, boolean | null | undefined][]) {
      if (value === undefined) continue;
      const bit = PermissionsBitField.resolve(name);
      if (value === true) {
        allow.add(bit);
        deny.remove(bit);
      } else if (value === false) {
        allow.remove(bit);
        deny.add(bit);
      } else {
        allow.remove(bit);
        deny.remove(bit);
      }
    }
    return { allow, deny };
  }
}

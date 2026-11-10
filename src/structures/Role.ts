import type { Client } from '../client/Client.js';
import type { ColorResolvable } from '../builders/Colors.js';
import type { RoleEditOptions } from '../managers/RoleManager.js';
import type { APIRole } from '../types/api/space.js';
import type { Collection } from '../util/Collection.js';
import { roleMention } from '../util/Formatters.js';
import type { PermissionResolvable } from '../util/PermissionsBitField.js';
import { PermissionFlagsBits, PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { Base } from './Base.js';
import type { Space } from './Space.js';
import type { SpaceMember } from './SpaceMember.js';

/** Extra facts about a role. */
export interface RoleTags {
  /** For a bot's managed role: the bot's id. */
  botId: Snowflake | null;
}

/**
 * A space role. Positions follow Discord's rules: `@everyone` is 0, every other role has a unique
 * position of 1 or more, and higher means more powerful.
 */
export class Role extends Base {
  /** The space. */
  declare public readonly space: Space;
  /** The role id. On Strafe the `@everyone` role has its own id (not the space id). */
  declare public readonly id: Snowflake;
  /** Name. */
  declare public name: string;
  /** Color as an integer (0 = none). */
  declare public color: number;
  /** Whether members with this role are listed apart. */
  declare public hoist: boolean;
  /** Whether anyone may mention it. */
  declare public mentionable: boolean;
  /** Position (0 for `@everyone`). */
  declare public position: number;
  /** Permissions. */
  declare public permissions: Readonly<PermissionsBitField>;
  /** For a bot's managed role, the bot. */
  declare public tags: RoleTags | null;
  /** @internal */
  declare public _updatedAt: string | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRole, space: Space) {
    super(client);
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    this.name = '';
    this.color = 0;
    this.hoist = false;
    this.mentionable = false;
    this.position = 0;
    this.permissions = new PermissionsBitField().freeze();
    this.tags = null;
    this._updatedAt = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIRole>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.color !== undefined) this.color = data.color;
    if (data.hoist !== undefined) this.hoist = data.hoist;
    if (data.mentionable !== undefined) this.mentionable = data.mentionable;
    if (data.position !== undefined) this.position = data.position;
    if (data.permissions !== undefined) this.permissions = new PermissionsBitField(data.permissions).freeze();
    if (data.bot_id !== undefined) this.tags = data.bot_id === '' ? null : { botId: data.bot_id };
    if (data.updated_at !== undefined) this._updatedAt = data.updated_at;
  }

  /** The space id. */
  public get spaceId(): Snowflake {
    return this.space.id;
  }

  /** Whether a bot manages this role (it cannot be given, taken or deleted). */
  public get managed(): boolean {
    return this.tags !== null;
  }

  /** The color as `#rrggbb`. */
  public get hexColor(): string {
    return `#${this.color.toString(16).padStart(6, '0')}`;
  }

  /** When the role was created. */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /** When the role was created. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** Whether this is the space's `@everyone` role. */
  public get isEveryone(): boolean {
    return this.id === this.space.everyoneRoleId;
  }

  /** Cached members with this role (every cached member for `@everyone`). */
  public get members(): Collection<Snowflake, SpaceMember> {
    if (this.isEveryone) return this.space.members.cache.clone();
    return this.space.members.cache.filter((member) => member._roles.includes(this.id));
  }

  /**
   * Whether the client can edit this role: it needs Manage Roles and a highest role above this
   * one (the owner can edit any role). Requires the client's member to be cached.
   */
  public get editable(): boolean {
    const me = this.space.members.me;
    if (!me) return false;
    if (me.id === this.space.ownerId) return true;
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
    return me.roles.highest.comparePositionTo(this) > 0;
  }

  /**
   * Compares positions: positive when this role is higher, negative when lower. Ties (legacy data)
   * go to the older role.
   *
   * @param role - The other role.
   */
  public comparePositionTo(role: Role | Snowflake): number {
    return this.space.roles.comparePositions(this, role);
  }

  /**
   * Edits the role.
   *
   * @param options - What to change.
   */
  public edit(options: RoleEditOptions): Promise<Role> {
    return this.space.roles.edit(this, options);
  }

  /**
   * Renames the role.
   *
   * @param name - The new name.
   */
  public setName(name: string): Promise<Role> {
    return this.edit({ name });
  }

  /**
   * Sets the color.
   *
   * @param color - The color.
   */
  public setColor(color: ColorResolvable): Promise<Role> {
    return this.edit({ color });
  }

  /**
   * Sets whether the role is listed apart.
   *
   * @param hoist - Listed apart or not.
   */
  public setHoist(hoist = true): Promise<Role> {
    return this.edit({ hoist });
  }

  /**
   * Sets whether anyone may mention the role.
   *
   * @param mentionable - Mentionable or not.
   */
  public setMentionable(mentionable = true): Promise<Role> {
    return this.edit({ mentionable });
  }

  /**
   * Sets the permissions. You can only grant permissions you hold yourself.
   *
   * @param permissions - The permissions.
   */
  public setPermissions(permissions: PermissionResolvable): Promise<Role> {
    return this.edit({ permissions });
  }

  /**
   * Moves the role (it must stay below your highest role).
   *
   * @param position - The new position (1 or more).
   */
  public setPosition(position: number): Promise<Role> {
    return this.edit({ position });
  }

  /** Deletes the role. */
  public delete(): Promise<void> {
    return this.space.roles.delete(this);
  }

  /** A mention: `<@&id>`, or `@everyone` for the `@everyone` role. */
  public override toString(): string {
    return this.isEveryone ? '@everyone' : roleMention(this.id);
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), spaceId: this.spaceId, permissions: this.permissions.bitfield.toString() };
  }
}

/** A role or its id. */
export type RoleResolvable = Role | Snowflake;

/** Sorts roles highest first (the order clients list them). @internal */
export function byPositionDescending(a: Role, b: Role): number {
  return b.position - a.position || SnowflakeUtil.compare(a.id, b.id);
}

import type { ColorResolvable } from '../builders/Colors.js';
import { resolveColor } from '../builders/Colors.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import { Role } from '../structures/Role.js';
import type { Space } from '../structures/Space.js';
import type { User } from '../structures/User.js';
import type { RESTPatchAPISpaceRoleJSONBody, RESTPatchAPISpaceRolePositionsJSONBody, RESTPostAPISpaceRoleJSONBody } from '../types/api/rest.js';
import type { APIRole } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { PermissionResolvable } from '../util/PermissionsBitField.js';
import { PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';

/** What {@link RoleManager.create} takes. */
export interface RoleCreateOptions {
  /** Name (default `new role`). */
  name?: string;
  /** Permissions (only ones you hold). */
  permissions?: PermissionResolvable;
  /** Color. */
  color?: ColorResolvable;
  /** List members apart. */
  hoist?: boolean;
  /** Anyone may mention it. */
  mentionable?: boolean;
  /** Position (new roles start at 1, just above `@everyone`; moved afterwards if given). */
  position?: number;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** What {@link RoleManager.edit} takes. */
export type RoleEditOptions = RoleCreateOptions;

/** One entry of {@link RoleManager.setPositions}. */
export interface RolePosition {
  /** The role. */
  role: Role | Snowflake;
  /** Its new position (1 or more). */
  position: number;
}

/** Options of {@link RoleManager.fetch}. */
export interface FetchRolesOptions {
  /** Skip the cache. */
  force?: boolean;
}

/**
 * A space's roles (discord.js's `RoleManager`). Strafe's `@everyone` role has its own id
 * ({@link Space.everyoneRoleId}). Role edits follow Discord's hierarchy: only roles below your own
 * highest, and only permissions you hold.
 */
export class RoleManager extends CachedManager<Snowflake, Role, Role> {
  /** The space. */
  declare public readonly space: Space;

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client, 'RoleManager');
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** @internal */
  public _add(data: APIRole, cache = true): Role {
    return this._upsert(data.id, data, cache, () => new Role(this.client, data, this.space));
  }

  /** Replaces the cache with a full list. @internal */
  public _setAll(roles: readonly APIRole[]): void {
    const ids = new Set(roles.map((role) => role.id));
    for (const id of [...this._cache.keys()]) if (!ids.has(id)) this._cache.delete(id);
    for (const role of roles) this._add(role);
  }

  /** The `@everyone` role. */
  public get everyone(): Role | null {
    return this.space.everyoneRoleId === null ? null : (this.cache.get(this.space.everyoneRoleId) ?? null);
  }

  /** The highest role. */
  public get highest(): Role | null {
    return this.cache.reduce<Role | null>((top, role) => (top === null || this.comparePositions(role, top) > 0 ? role : top), null);
  }

  /**
   * A bot's managed role.
   *
   * @param user - The bot or its id.
   */
  public botRoleFor(user: User | Snowflake): Role | null {
    const id = typeof user === 'string' ? user : user.id;
    return this.cache.find((role) => role.tags?.botId === id) ?? null;
  }

  /**
   * Compares two roles' positions: positive when `a` is higher. Ties (legacy data) rank the older
   * role higher, like the server.
   *
   * @param a - A role or id.
   * @param b - A role or id.
   */
  public comparePositions(a: Role | Snowflake, b: Role | Snowflake): number {
    const roleA = this.resolve(a);
    const roleB = this.resolve(b);
    if (!roleA || !roleB) throw new StrafeError(ErrorCodes.NotFound, 'Role');
    if (roleA.position !== roleB.position) return roleA.position - roleB.position;
    return SnowflakeUtil.compare(roleB.id, roleA.id);
  }

  /**
   * Fetches every role (there is no single-role endpoint, so fetching one fetches all).
   *
   * @param id - A role id to return, or nothing for all of them.
   * @param options - `force` skips the cache.
   */
  public async fetch(id: Snowflake, options?: FetchRolesOptions): Promise<Role | null>;
  public async fetch(id?: null, options?: FetchRolesOptions): Promise<Collection<Snowflake, Role>>;
  public async fetch(id?: Snowflake | null, options: FetchRolesOptions = {}): Promise<Collection<Snowflake, Role> | Role | null> {
    if (id !== undefined && id !== null && options.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    const data = await this.client.rest.get<APIRole[]>(Routes.spaceRoles(this.space.id));
    this._setAll(data);
    if (id !== undefined && id !== null) return this.cache.get(id) ?? null;
    return new Collection(this.cache);
  }

  /**
   * Creates a role (Manage Roles). It starts at position 1; `position` moves it afterwards.
   *
   * @param options - Name, permissions, color...
   * @example
   * ```ts
   * const role = await space.roles.create({ name: 'Helpers', color: 'Blue', permissions: ['ManageMessages'] });
   * ```
   */
  public async create(options: RoleCreateOptions = {}): Promise<Role> {
    const body: RESTPostAPISpaceRoleJSONBody = { name: options.name ?? 'new role' };
    if (options.permissions !== undefined) body.permissions = Number(PermissionsBitField.resolve(options.permissions));
    if (options.color !== undefined) body.color = resolveColor(options.color);
    if (options.hoist !== undefined) body.hoist = options.hoist;
    if (options.mentionable !== undefined) body.mentionable = options.mentionable;
    const data = await this.client.rest.post<APIRole>(Routes.spaceRoles(this.space.id), { body });
    const role = this._add(data);
    if (options.position !== undefined && options.position !== role.position) return this.edit(role, { position: options.position });
    return role;
  }

  /**
   * Edits a role (Manage Roles, below your highest role).
   *
   * @param role - The role or id.
   * @param options - What to change.
   */
  public async edit(role: Role | Snowflake, options: RoleEditOptions): Promise<Role> {
    const id = this.resolveId(role) ?? '';
    const body: RESTPatchAPISpaceRoleJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.permissions !== undefined) body.permissions = Number(PermissionsBitField.resolve(options.permissions));
    if (options.color !== undefined) body.color = resolveColor(options.color);
    if (options.hoist !== undefined) body.hoist = options.hoist;
    if (options.mentionable !== undefined) body.mentionable = options.mentionable;
    if (options.position !== undefined) body.position = options.position;
    const data = await this.client.rest.patch<APIRole>(Routes.spaceRole(this.space.id, id), { body });
    return this._add(data);
  }

  /**
   * Deletes a role (Manage Roles; not `@everyone`, not a bot's role).
   *
   * @param role - The role or id.
   * @param _reason - Ignored.
   */
  public async delete(role: Role | Snowflake, _reason?: string): Promise<void> {
    const id = this.resolveId(role) ?? '';
    await this.client.rest.delete(Routes.spaceRole(this.space.id, id));
    this._cache.delete(id);
  }

  /**
   * Moves several roles at once.
   *
   * @param positions - Roles and their new positions.
   */
  public async setPositions(positions: readonly RolePosition[]): Promise<Collection<Snowflake, Role>> {
    const body: RESTPatchAPISpaceRolePositionsJSONBody = positions.map((p) => ({ id: this.resolveId(p.role) ?? '', position: p.position }));
    const data = await this.client.rest.patch<APIRole[]>(Routes.spaceRoles(this.space.id), { body });
    for (const role of data) this._add(role);
    return new Collection(this.cache);
  }
}

import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { Role } from '../structures/Role.js';
import type { Space } from '../structures/Space.js';
import type { SpaceMember } from '../structures/SpaceMember.js';
import { Collection } from '../util/Collection.js';
import type { PermissionsBitField } from '../util/PermissionsBitField.js';
import type { Snowflake } from '../util/Snowflake.js';
import { DataManager } from './BaseManager.js';

/** A role, its id, or several. */
export type RoleResolvables = Role | Snowflake | readonly (Role | Snowflake)[] | Collection<Snowflake, Role>;

/**
 * A member's roles. Giving and taking roles follows
 * Discord's rules: you may hand out or take away any role below your own highest, on anyone; a
 * bot's managed role cannot be given or taken.
 */
export class SpaceMemberRoleManager extends DataManager<Snowflake, Role, Role> {
  /** The member. */
  declare public readonly member: SpaceMember;

  /**
   * @param member - The member.
   */
  public constructor(member: SpaceMember) {
    super(member.client);
    Object.defineProperty(this, 'member', { value: member, enumerable: false });
  }

  /** The space. */
  public get space(): Space {
    return this.member.space;
  }

  /** The member's roles, `@everyone` included. */
  public get cache(): Collection<Snowflake, Role> {
    const out = new Collection<Snowflake, Role>();
    const everyone = this.space.roles.everyone;
    if (everyone) out.set(everyone.id, everyone);
    for (const id of this.member._roles) {
      const role = this.space.roles.cache.get(id);
      if (role) out.set(id, role);
    }
    return out;
  }

  /** The highest role (`@everyone` when none). */
  public get highest(): Role {
    let top: Role | null = null;
    for (const role of this.cache.values()) if (top === null || this.space.roles.comparePositions(role, top) > 0) top = role;
    if (top === null) throw new StrafeError(ErrorCodes.NotFound, 'The @everyone role');
    return top;
  }

  /** The highest role that lists members apart. */
  public get hoist(): Role | null {
    return this.pick((role) => role.hoist);
  }

  /** The highest role with a color. */
  public get color(): Role | null {
    return this.pick((role) => role.color !== 0);
  }

  /** The member's managed bot role, for a bot. */
  public get botRole(): Role | null {
    return this.cache.find((role) => role.tags?.botId === this.member.id) ?? null;
  }

  /** The `@everyone` role. */
  public get everyone(): Role | null {
    return this.space.roles.everyone;
  }

  /** The member's space-wide permissions. */
  public get permissions(): Readonly<PermissionsBitField> {
    return this.member.permissions;
  }

  private pick(predicate: (role: Role) => boolean): Role | null {
    let top: Role | null = null;
    for (const role of this.cache.values()) {
      if (!predicate(role)) continue;
      if (top === null || this.space.roles.comparePositions(role, top) > 0) top = role;
    }
    return top;
  }

  private ids(roles: RoleResolvables): Snowflake[] {
    const list = roles instanceof Collection ? [...roles.values()] : Array.isArray(roles) ? (roles as readonly (Role | Snowflake)[]) : [roles as Role | Snowflake];
    return list.map((role) => (typeof role === 'string' ? role : role.id));
  }

  /**
   * Gives roles (Manage Roles; each below your highest role).
   *
   * @param roles - A role, an id, or several.
   * @param _reason - Ignored (Strafe records no reason).
   * @example
   * ```ts
   * await member.roles.add(space.roles.cache.find((r) => r.name === 'Helpers')!);
   * ```
   */
  public async add(roles: RoleResolvables, _reason?: string): Promise<SpaceMember> {
    const ids = this.ids(roles);
    const [only] = ids;
    if (ids.length === 1 && only !== undefined) {
      await this.client.rest.put(Routes.spaceMemberRole(this.space.id, this.member.id, only));
      if (!this.member._roles.includes(only)) this.member._roles = [...this.member._roles, only];
      return this.member;
    }
    return this.set([...new Set([...this.member._roles, ...ids])]);
  }

  /**
   * Takes roles away (Manage Roles; each below your highest role).
   *
   * @param roles - A role, an id, or several.
   * @param _reason - Ignored.
   */
  public async remove(roles: RoleResolvables, _reason?: string): Promise<SpaceMember> {
    const ids = this.ids(roles);
    const [only] = ids;
    if (ids.length === 1 && only !== undefined) {
      await this.client.rest.delete(Routes.spaceMemberRole(this.space.id, this.member.id, only));
      this.member._roles = this.member._roles.filter((id) => id !== only);
      return this.member;
    }
    const drop = new Set(ids);
    return this.set(this.member._roles.filter((id) => !drop.has(id)));
  }

  /**
   * Replaces the member's roles. Roles at or above your highest that the member holds are kept by
   * the server whatever you send.
   *
   * @param roles - The full list.
   * @param _reason - Ignored.
   */
  public async set(roles: RoleResolvables, _reason?: string): Promise<SpaceMember> {
    const ids = this.ids(roles).filter((id) => id !== this.space.everyoneRoleId);
    await this.client.rest.put(Routes.spaceMemberRoles(this.space.id, this.member.id), { body: { role_ids: ids } });
    this.member._roles = ids;
    return this.member;
  }
}

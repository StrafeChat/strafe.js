import type { Client } from '../client/Client.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { APIInvite, APIInvitePreview, APISpace } from '../types/api/space.js';
import type { Snowflake } from '../util/Snowflake.js';
import { parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { Space } from './Space.js';
import type { User } from './User.js';

/**
 * A space invite. Invites admit to a whole space (Strafe invites do not point at a room). The link
 * is `<web origin>/invite/<code>`; an invite to a space on another instance is written `code@domain`.
 */
export class Invite extends Base {
  /** The code (`code@domain` for an invite fetched from another instance). */
  declare public readonly code: string;
  /** The space id. */
  declare public spaceId: Snowflake | null;
  /** Who created it. */
  declare public inviterId: Snowflake | null;
  /** The creator's display name (invite previews give only that). */
  declare public inviterDisplayName: string | null;
  /** Uses so far. */
  declare public uses: number | null;
  /** Most uses (0 = unlimited). */
  declare public maxUses: number | null;
  /** When it was created (Unix ms). */
  declare public createdTimestamp: number | null;
  /** When it expires (Unix ms), or `null` for never. */
  declare public expiresTimestamp: number | null;
  /** Members of the space (previews only). */
  declare public memberCount: number | null;
  /** @internal */
  declare public _spaceData: APISpace | null;

  /**
   * @param client - The client.
   * @param data - An invite, or a preview (`GET /spaces/invites/:code`) with its code.
   */
  public constructor(client: Client, data: APIInvite | (APIInvitePreview & { code: string })) {
    super(client);
    Object.defineProperty(this, 'code', { value: data.code, enumerable: true });
    this.spaceId = null;
    this.inviterId = null;
    this.inviterDisplayName = null;
    this.uses = null;
    this.maxUses = null;
    this.createdTimestamp = null;
    this.expiresTimestamp = null;
    this.memberCount = null;
    this._spaceData = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<Omit<APIInvite, 'inviter'>> & Partial<Omit<APIInvitePreview, 'inviter'>> & { inviter?: unknown }): void {
    if (data.space_id !== undefined) this.spaceId = data.space_id;
    if (data.inviter_id !== undefined) this.inviterId = data.inviter_id;
    if (data.current_uses !== undefined) this.uses = data.current_uses;
    if (data.max_uses !== undefined) this.maxUses = data.max_uses;
    if (data.created_at !== undefined) this.createdTimestamp = parseTimestamp(data.created_at);
    if ('expires_at' in data || data.created_at !== undefined) this.expiresTimestamp = parseTimestamp(data.expires_at);
    if (data.inviter) {
      const inviter = data.inviter as { display_name?: string; id?: Snowflake };
      if (inviter.display_name !== undefined) this.inviterDisplayName = inviter.display_name;
      if (inviter.id !== undefined) this.client.users._add({ ...inviter, id: inviter.id });
    }
    if (data.member_count !== undefined) this.memberCount = data.member_count;
    if (data.space !== undefined) {
      this._spaceData = data.space;
      this.spaceId = data.space.id;
    }
  }

  /** The code (invites are keyed by code). */
  public get id(): string {
    return this.code;
  }

  /** The space, when the client is in it. */
  public get space(): Space | null {
    return this.spaceId === null ? null : (this.client.spaces.cache.get(this.spaceId) ?? null);
  }

  /** The space's name (from the cache or the preview). */
  public get spaceName(): string | null {
    return this.space?.name ?? this._spaceData?.name ?? null;
  }

  /** Who created it, when cached. */
  public get inviter(): User | null {
    return this.inviterId === null ? null : (this.client.users.cache.get(this.inviterId) ?? null);
  }

  /** Seconds it lasts in total (0 = forever), when known. */
  public get maxAge(): number | null {
    if (this.createdTimestamp === null) return null;
    if (this.expiresTimestamp === null) return 0;
    return Math.round((this.expiresTimestamp - this.createdTimestamp) / 1000);
  }

  /** When it was created. */
  public get createdAt(): Date | null {
    return this.createdTimestamp === null ? null : new Date(this.createdTimestamp);
  }

  /** When it expires, or `null` for never. */
  public get expiresAt(): Date | null {
    return this.expiresTimestamp === null ? null : new Date(this.expiresTimestamp);
  }

  /** The link people open: `<web origin>/invite/<code>`. */
  public get url(): string {
    return `${this.client.urls.web}/invite/${encodeURIComponent(this.code)}`;
  }

  /**
   * Deletes the invite (Manage Space, or its creator).
   *
   * @param _reason - Ignored (Strafe records no reason for this).
   */
  public async delete(_reason?: string): Promise<this> {
    if (this.spaceId === null) throw new StrafeError(ErrorCodes.InvalidArgument, 'This invite has no known space');
    await this.client.rest.delete(Routes.spaceInvite(this.spaceId, this.code));
    this.space?.invites.cache.delete(this.code);
    return this;
  }

  /** The link. */
  public override toString(): string {
    return this.url;
  }

  /** Plain JSON. */
  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), url: this.url };
  }
}

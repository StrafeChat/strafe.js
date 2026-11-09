import { Routes } from '../rest/Routes.js';
import { Invite } from '../structures/Invite.js';
import type { Space } from '../structures/Space.js';
import type { RESTPostAPISpaceInviteJSONBody } from '../types/api/rest.js';
import type { APIInvite } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import { CachedManager } from './BaseManager.js';

/** What {@link SpaceInviteManager.create} takes. */
export interface InviteCreateOptions {
  /** Seconds it lasts (0 = forever, at most 30 days). */
  maxAge?: number;
  /** Most uses (0 = unlimited, at most 1000). */
  maxUses?: number;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** A space's invites, keyed by code. Listing them needs Manage Space; creating needs Create Invite. */
export class SpaceInviteManager extends CachedManager<string, Invite, Invite> {
  /** The space. */
  declare public readonly space: Space;

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client, 'SpaceInviteManager');
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** @internal */
  public _add(data: APIInvite, cache = true): Invite {
    return this._upsert(data.code, data, cache, () => new Invite(this.client, data));
  }

  /**
   * The code of an invite or code.
   *
   * @param resolvable - What to resolve.
   */
  public override resolveId(resolvable: Invite | string): string {
    return typeof resolvable === 'string' ? resolvable : resolvable.code;
  }

  /**
   * Fetches the space's invites (Manage Space).
   *
   * @param options - `cache` (default true).
   */
  public async fetch(options: { cache?: boolean } = {}): Promise<Collection<string, Invite>> {
    const data = await this.client.rest.get<APIInvite[]>(Routes.spaceInvites(this.space.id));
    const out = new Collection<string, Invite>();
    for (const invite of data) out.set(invite.code, this._add(invite, options.cache ?? true));
    return out;
  }

  /**
   * Creates an invite (Create Invite). Strafe invites admit to the whole space.
   *
   * @param options - Lifetime and uses.
   * @example
   * ```ts
   * const invite = await space.invites.create({ maxAge: 86400, maxUses: 10 });
   * console.log(invite.url);
   * ```
   */
  public async create(options: InviteCreateOptions = {}): Promise<Invite> {
    const body: RESTPostAPISpaceInviteJSONBody = {};
    if (options.maxAge !== undefined) body.max_age_seconds = options.maxAge;
    if (options.maxUses !== undefined) body.max_uses = options.maxUses;
    const data = await this.client.rest.post<APIInvite>(Routes.spaceInvites(this.space.id), { body });
    return this._add(data);
  }

  /**
   * Deletes an invite (Manage Space, or its creator).
   *
   * @param invite - The invite or code.
   * @param _reason - Ignored.
   */
  public async delete(invite: Invite | string, _reason?: string): Promise<void> {
    const code = this.resolveId(invite);
    await this.client.rest.delete(Routes.spaceInvite(this.space.id, code));
    this._cache.delete(code);
  }
}

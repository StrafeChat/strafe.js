import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { Message } from '../structures/Message.js';
import type { BaseRoom } from '../structures/rooms/BaseRoom.js';
import type { Space } from '../structures/Space.js';
import type { APIMemberLike } from '../structures/SpaceMember.js';
import { SpaceMember } from '../structures/SpaceMember.js';
import type { ThreadMember } from '../structures/ThreadMember.js';
import { User } from '../structures/User.js';
import type { RESTPatchAPISpaceMemberJSONBody, RESTPatchAPISpaceMemberVoiceJSONBody } from '../types/api/rest.js';
import type { APIMember } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { OAuth2Tokens } from '../oauth2/structures.js';
import { OAuth2User } from '../oauth2/structures.js';
import { CachedManager } from './BaseManager.js';
import type { RoleResolvables } from './SpaceMemberRoleManager.js';

/** Something that names a user: a user, member, message (its author), thread member, or id. */
export type UserResolvable = User | SpaceMember | Message | ThreadMember | Snowflake;

/** Options of {@link SpaceMemberManager.ban}. */
export interface BanOptions {
  /** Why (stored with the ban and in the audit log). */
  reason?: string;
}

/** What {@link SpaceMemberManager.edit} changes. */
export interface SpaceMemberEditOptions {
  /** Nickname; `null` or `''` clears it. Set on someone else with Manage Nicknames. */
  nick?: string | null;
  /** Space bio. Set only for yourself; on someone else it can only be cleared (`null`), which needs Manage Nicknames. */
  bio?: string | null;
  /** Space "about me". Set only for yourself; on someone else it can only be cleared (`null`), which needs Manage Nicknames. */
  aboutMe?: string | null;
  /** Space pronouns. Set only for yourself; on someone else it can only be cleared (`null`), which needs Manage Nicknames. */
  pronouns?: string | null;
  /** `null` removes the space avatar (setting one is only possible for yourself, by upload). */
  avatar?: null;
  /** `null` removes the space banner (setting one is only possible for yourself, by upload). */
  banner?: null;
  /** Replace the roles. */
  roles?: RoleResolvables;
  /** Server-mute in voice. */
  mute?: boolean;
  /** Server-deafen in voice. */
  deaf?: boolean;
  /** Move to a voice room. */
  room?: BaseRoom | Snowflake;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** Options to fetch one member. */
export interface FetchMemberOptions {
  /** The user. */
  user: UserResolvable;
  /** Skip the cache. */
  force?: boolean;
  /** Cache the result (default true). */
  cache?: boolean;
}

/** Options to fetch every member. */
export interface FetchMembersOptions {
  /** Cache the results (default true). */
  cache?: boolean;
}

/** Options of {@link SpaceMemberManager.add}. */
export interface AddSpaceMemberOptions {
  /** The user's OAuth2 access token with the `spaces.join` scope (or their {@link OAuth2Tokens}). */
  accessToken: string | Pick<OAuth2Tokens, 'accessToken'>;
  /** Skip the cache when fetching the new member. */
  force?: boolean;
}

/** Whether options ask for the whole list. @internal */
export function isListOptions(options: unknown): options is { cache?: boolean } {
  return typeof options === 'object' && options !== null && !('user' in options) && !('id' in options) && !('authorId' in options);
}

/** Whether options are `{ user, ... }`. @internal */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- a type guard for the caller's option type
export function isFetchOne<T extends { user: unknown }>(options: unknown): options is T {
  return typeof options === 'object' && options !== null && 'user' in options && !('id' in options);
}

/**
 * A space's members. The member list is not in READY: call
 * `fetch()` once (one request returns everyone) and member events keep it current.
 */
export class SpaceMemberManager extends CachedManager<Snowflake, SpaceMember, UserResolvable> {
  /** The space. */
  declare public readonly space: Space;

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client, 'SpaceMemberManager');
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** @internal */
  public _add(data: APIMemberLike, cache = true): SpaceMember {
    const id = data.id ?? data.user_id ?? '';
    return this._upsert(id, data, cache, () => new SpaceMember(this.client, data, this.space));
  }

  /** The client's own member, when cached ({@link SpaceMemberManager.fetchMe} fetches it). */
  public get me(): SpaceMember | null {
    const id = this.client._userId;
    return id === null ? null : (this.cache.get(id) ?? null);
  }

  /**
   * The id of a user, member, message author or thread member.
   *
   * @param resolvable - What to resolve.
   */
  public override resolveId(resolvable: UserResolvable): Snowflake | null {
    if (typeof resolvable === 'string') return resolvable;
    if (resolvable instanceof User || resolvable instanceof SpaceMember) return resolvable.id;
    if ('authorId' in resolvable) return resolvable.authorId;
    return resolvable.id;
  }

  /**
   * Fetches one member (`fetch(user)` or `fetch({ user, force })`), or every member (`fetch()`).
   *
   * @param options - A user, options for one, or nothing for all.
   * @example
   * ```ts
   * await space.members.fetch(); // everyone, cached
   * const member = await space.members.fetch(userId);
   * ```
   */
  public fetch(options: UserResolvable | FetchMemberOptions): Promise<SpaceMember>;
  public fetch(options?: FetchMembersOptions): Promise<Collection<Snowflake, SpaceMember>>;
  public async fetch(options?: UserResolvable | FetchMemberOptions | FetchMembersOptions): Promise<SpaceMember | Collection<Snowflake, SpaceMember>> {
    if (options === undefined || isListOptions(options)) {
      const cache = options?.cache ?? true;
      const data = await this.client.rest.get<APIMember[]>(Routes.spaceMembers(this.space.id));
      const out = new Collection<Snowflake, SpaceMember>();
      for (const member of data) out.set(member.id, this._add(member, cache));
      return out;
    }
    const one: FetchMemberOptions = isFetchOne<FetchMemberOptions>(options) ? options : { user: options };
    const id = this.resolveId(one.user);
    if (id === null) throw new StrafeError(ErrorCodes.InvalidArgument, 'Could not resolve the user to fetch');
    if (one.force !== true) {
      const cached = this.cache.get(id);
      if (cached && !cached.partial) return cached;
    }
    const data = await this.client.rest.get<APIMember>(Routes.spaceMember(this.space.id, id));
    return this._add(data, one.cache ?? true);
  }

  /** Fetches the client's own member. */
  public async fetchMe(): Promise<SpaceMember> {
    const data = await this.client.rest.get<APIMember>(Routes.spaceMember(this.space.id, '@me'));
    return this._add(data);
  }

  /**
   * Edits a member: profile fields with one `PATCH`, then roles and voice if asked.
   *
   * @param user - The member.
   * @param options - What to change.
   */
  public async edit(user: UserResolvable, options: SpaceMemberEditOptions): Promise<SpaceMember> {
    const id = this.resolveId(user) ?? '';
    const isMe = id === this.client._userId;
    const body: RESTPatchAPISpaceMemberJSONBody = {};
    if (options.nick !== undefined) body.nick = options.nick === '' ? null : options.nick;
    if (options.bio !== undefined) body.bio = options.bio;
    if (options.aboutMe !== undefined) body.about_me = options.aboutMe;
    if (options.pronouns !== undefined) body.pronouns = options.pronouns;
    if (options.avatar === null) body.avatar = null;
    if (options.banner === null) body.banner = null;
    let member = this.cache.get(id) ?? null;
    if (Object.keys(body).length > 0) {
      const data = await this.client.rest.patch<APIMember>(Routes.spaceMember(this.space.id, isMe ? '@me' : id), { body });
      member = this._add(data);
    }
    member ??= await this.fetch(id);
    if (options.roles !== undefined) await member.roles.set(options.roles);
    const voice: RESTPatchAPISpaceMemberVoiceJSONBody = {};
    if (options.mute !== undefined) voice.mute = options.mute;
    if (options.deaf !== undefined) voice.deaf = options.deaf;
    if (options.room !== undefined) voice.room_id = typeof options.room === 'string' ? options.room : options.room.id;
    if (Object.keys(voice).length > 0) await this.client.rest.patch(Routes.spaceMemberVoice(this.space.id, id), { body: voice });
    return member;
  }

  /**
   * Kicks a member (Kick Members; they must be below you; never the owner).
   *
   * @param user - The member.
   * @param _reason - Ignored: Strafe records no reason for kicks.
   */
  public async kick(user: UserResolvable, _reason?: string): Promise<Snowflake> {
    const id = this.resolveId(user) ?? '';
    await this.client.rest.delete(Routes.spaceMember(this.space.id, id));
    this._cache.delete(id);
    return id;
  }

  /**
   * Bans a user (Ban Members; members must be below you). Works for non-members too.
   *
   * @param user - The user.
   * @param options - The reason.
   */
  public async ban(user: UserResolvable, options: BanOptions = {}): Promise<Snowflake> {
    const id = this.resolveId(user) ?? '';
    await this.space.bans.create(id, options);
    this._cache.delete(id);
    return id;
  }

  /**
   * Lifts a ban.
   *
   * @param user - The user.
   * @param _reason - Ignored.
   */
  public async unban(user: UserResolvable, _reason?: string): Promise<Snowflake> {
    const id = this.resolveId(user) ?? '';
    await this.space.bans.remove(id);
    return id;
  }

  /**
   * Adds a user to the space with their OAuth2 access token (`spaces.join` scope; the bot needs
   * Create Invite). Returns the member (fetched). The token must be the user's own: a website
   * that logged them in with {@link OAuth2Client} hands it to the bot. The token shows as
   * `[redacted]` in an error's `requestBody` and in the REST `response` event, so logging either is safe.
   *
   * @param user - The user (an {@link OAuth2User} from {@link OAuth2Client.fetchUser} works too).
   * @param options - The access token.
   * @example
   * ```ts
   * const user = await oauth.fetchUser(tokens);
   * await space.members.add(user, { accessToken: tokens });
   * ```
   */
  public async add(user: UserResolvable | OAuth2User, options: AddSpaceMemberOptions): Promise<SpaceMember> {
    const id = user instanceof OAuth2User ? user.id : (this.resolveId(user) ?? '');
    const accessToken = typeof options.accessToken === 'string' ? options.accessToken : options.accessToken.accessToken;
    await this.client.rest.put(Routes.spaceMember(this.space.id, id), { body: { access_token: accessToken }, redact: ['access_token'] });
    return this.fetch({ user: id, force: options.force ?? true });
  }
}

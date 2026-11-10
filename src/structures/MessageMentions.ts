import type { APIMessage } from '../types/api/message.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Message } from './Message.js';
import type { Role } from './Role.js';
import type { AnyRoom } from './rooms/index.js';
import type { SpaceMember } from './SpaceMember.js';
import type { User } from './User.js';

/** Options of {@link MessageMentions.has}. */
export interface MessageMentionsHasOptions {
  /** Do not count `@everyone`/`@here`. */
  ignoreEveryone?: boolean;
  /** Do not count role mentions. */
  ignoreRoles?: boolean;
  /** Do not count being the author of the replied-to message. */
  ignoreRepliedUser?: boolean;
  /** Only count direct mentions (same as all three above). */
  ignoreDirect?: boolean;
}

/**
 * Who and what a message mentions. The server finds mentions in the text (`<@id>`, `<@&id>`,
 * `@everyone`/`@here`), so this reflects what actually notified.
 */
export class MessageMentions {
  /** `<@id>` / `<@!id>`. */
  public static readonly UsersPattern = /<@!?(\d{1,20})>/g;
  /** `<@&id>`. */
  public static readonly RolesPattern = /<@&(\d{1,20})>/g;
  /** `<#id>`. */
  public static readonly RoomsPattern = /<#(\d{1,20})>/g;
  /** `@everyone` or `@here`. */
  public static readonly EveryonePattern = /@(everyone|here)/;

  /** The message. */
  declare public readonly message: Message;
  /** Whether `@everyone`/`@here` notified. */
  public readonly everyone: boolean;
  /** Mentioned user ids. */
  public readonly userIds: readonly Snowflake[];
  /** Mentioned role ids. */
  public readonly roleIds: readonly Snowflake[];

  /**
   * @param message - The message.
   * @param data - Wire data.
   */
  public constructor(message: Message, data: Pick<APIMessage, 'mentions' | 'mention_roles' | 'mention_everyone' | 'mention_users'>) {
    Object.defineProperty(this, 'message', { value: message, enumerable: false });
    this.everyone = data.mention_everyone === true;
    const users = new Set(data.mentions ?? []);
    for (const user of data.mention_users ?? []) {
      message.client.users._add(user);
      users.add(user.id);
    }
    this.userIds = [...users];
    this.roleIds = [...(data.mention_roles ?? [])];
  }

  /** Mentioned users (those the cache knows). */
  public get users(): Collection<Snowflake, User> {
    const out = new Collection<Snowflake, User>();
    for (const id of this.userIds) {
      const user = this.message.client.users.cache.get(id);
      if (user) out.set(id, user);
    }
    return out;
  }

  /** Mentioned members (cached members of the message's space). */
  public get members(): Collection<Snowflake, SpaceMember> {
    const out = new Collection<Snowflake, SpaceMember>();
    const space = this.message.space;
    if (!space) return out;
    for (const id of this.userIds) {
      const member = space.members.cache.get(id);
      if (member) out.set(id, member);
    }
    return out;
  }

  /** Mentioned roles. */
  public get roles(): Collection<Snowflake, Role> {
    const out = new Collection<Snowflake, Role>();
    const space = this.message.space;
    if (!space) return out;
    for (const id of this.roleIds) {
      const role = space.roles.cache.get(id);
      if (role) out.set(id, role);
    }
    return out;
  }

  /** Rooms written as `<#id>` in the text (those the cache knows). */
  public get rooms(): Collection<Snowflake, AnyRoom> {
    const out = new Collection<Snowflake, AnyRoom>();
    for (const match of (this.message.content ?? '').matchAll(MessageMentions.RoomsPattern)) {
      const id = match[1] ?? '';
      const room = this.message.client.rooms.cache.get(id);
      if (room) out.set(id, room);
    }
    return out;
  }

  /** The author of the message this one replies to, when known. */
  public get repliedUser(): User | null {
    const reference = this.message.reference;
    if (!reference) return null;
    const replied = this.message.room.messages.cache.get(reference.messageId);
    return replied?.author ?? null;
  }

  /**
   * Whether the message mentions a user, member, role or room: directly, through a role the member
   * holds, through `@everyone`, or by replying to them.
   *
   * @param data - Who or what.
   * @param options - What to ignore.
   */
  public has(data: User | SpaceMember | Role | AnyRoom | Snowflake, options: MessageMentionsHasOptions = {}): boolean {
    const id = typeof data === 'string' ? data : data.id;
    const ignoreDirect = options.ignoreDirect === true;
    if (!ignoreDirect && options.ignoreEveryone !== true && this.everyone) return true;
    if (!ignoreDirect && options.ignoreRepliedUser !== true && this.repliedUser?.id === id) return true;
    if (this.userIds.includes(id) || this.roleIds.includes(id)) return true;
    if (this.rooms.has(id)) return true;
    if (!ignoreDirect && options.ignoreRoles !== true) {
      const member = this.message.space?.members.cache.get(id);
      if (member?._roles.some((role) => this.roleIds.includes(role))) return true;
    }
    return false;
  }

  /** Plain JSON. */
  public toJSON(): Record<string, unknown> {
    return { everyone: this.everyone, users: this.userIds, roles: this.roleIds };
  }
}

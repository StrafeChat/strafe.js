import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { User } from '../structures/User.js';
import type { APIReactionUser } from '../types/api/user.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { DataManager } from './BaseManager.js';
import type { UserResolvable } from './SpaceMemberManager.js';

/** Who reacted with one emoji. */
export class ReactionUserManager extends DataManager<Snowflake, User, UserResolvable> {
  /** The reaction. */
  declare public readonly reaction: MessageReaction;
  /** @internal */
  public readonly _cache: Collection<Snowflake, User>;

  /**
   * @param reaction - The reaction.
   */
  public constructor(reaction: MessageReaction) {
    super(reaction.client);
    Object.defineProperty(this, 'reaction', { value: reaction, enumerable: false });
    // Limited like every other cache (`makeCache`'s `ReactionUserManager`).
    this._cache = reaction.client.options.makeCache('ReactionUserManager') as unknown as Collection<Snowflake, User>;
  }

  /** Users known to have reacted. */
  public get cache(): Collection<Snowflake, User> {
    return this._cache;
  }

  /** Fetches everyone who reacted (the list has no paging). The result is complete even when the cache is limited. */
  public async fetch(): Promise<Collection<Snowflake, User>> {
    const { message } = this.reaction;
    const data = await this.client.rest.get<APIReactionUser[]>(Routes.roomMessageReaction(message.roomId, message.id, this.reaction.identifier));
    const users = new Collection<Snowflake, User>();
    for (const entry of data) users.set(entry.id, this.client.users._add(entry));
    this._cache.clear();
    for (const [id, user] of users) this._cache.set(id, user);
    this.reaction.count = data.length;
    this.reaction.me = users.has(this.client._userId ?? '');
    return users;
  }

  /**
   * Removes the client's own reaction. Strafe cannot remove someone else's.
   *
   * @param user - The client user (default).
   */
  public async remove(user: UserResolvable = this.client._userId ?? ''): Promise<MessageReaction> {
    const id = this.client.users.resolveId(user);
    if (id === null || id !== this.client._userId) {
      throw new StrafeError(ErrorCodes.Unsupported, "Removing someone else's reaction", 'the API only removes your own');
    }
    await this.reaction.remove();
    this._cache.delete(id);
    return this.reaction;
  }
}

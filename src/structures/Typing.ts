import type { Client } from '../client/Client.js';
import type { GatewayTypingStartData } from '../types/api/gateway.js';
import type { Snowflake } from '../util/Snowflake.js';
import { Base } from './Base.js';
import type { TextBasedRoom } from './rooms/index.js';
import type { Space } from './Space.js';
import type { SpaceMember } from './SpaceMember.js';
import type { User } from './User.js';

/** Someone started typing (the `typingStart` event). The server sends at most one per user per room every 5 s. */
export class Typing extends Base {
  /** The room. */
  declare public readonly room: TextBasedRoom;
  /** Who is typing. */
  declare public readonly user: User;
  /** When they started (Unix ms). */
  declare public startedTimestamp: number;

  /**
   * @param client - The client.
   * @param room - The room.
   * @param user - Who is typing.
   * @param data - Wire data.
   */
  public constructor(client: Client, room: TextBasedRoom, user: User, data: Pick<GatewayTypingStartData, 'timestamp'>) {
    super(client);
    Object.defineProperty(this, 'room', { value: room, enumerable: false });
    Object.defineProperty(this, 'user', { value: user, enumerable: false });
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Pick<GatewayTypingStartData, 'timestamp'>): void {
    this.startedTimestamp = data.timestamp * 1000;
  }

  /** When they started. */
  public get startedAt(): Date {
    return new Date(this.startedTimestamp);
  }

  /** The space, for a space room. */
  public get space(): Space | null {
    return 'space' in this.room ? this.room.space : null;
  }

  /** The member, when cached. */
  public get member(): SpaceMember | null {
    return this.space?.members.cache.get(this.user.id) ?? null;
  }

  /** Whether it happened in a space room. */
  public inSpace(): this is Typing & { space: Space } {
    return this.space !== null;
  }

  /** The user id. */
  public get userId(): Snowflake {
    return this.user.id;
  }
}

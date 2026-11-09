import type { Client } from '../../client/Client.js';
import type { SpaceRoomCreateOptions } from '../../managers/SpaceRoomManager.js';
import type { RoomType } from '../../types/api/room.js';
import type { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Space } from '../Space.js';
import type { APIRoomLike } from './BaseRoom.js';
import { BaseSpaceRoom } from './BaseSpaceRoom.js';
import type { SpaceBasedRoom } from './index.js';

/**
 * A section: a named group of rooms in a space (`RoomType.SpaceSection`). Rooms in a section can sync their permission overrides with it.
 */
export class SectionRoom extends BaseSpaceRoom {
  declare public readonly type: RoomType.SpaceSection;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType.SpaceSection }, space: Space) {
    super(client, data, space);
    this._patch(data);
  }

  /** The cached rooms in this section. */
  public get children(): Collection<Snowflake, SpaceBasedRoom> {
    return this.space.rooms.cache.filter((room) => !room.isThread() && room.parentId === this.id);
  }

  /**
   * Creates a room in this section (it starts synced with the section's overrides).
   *
   * @param options - Name, type and settings.
   */
  public createRoom(options: Omit<SpaceRoomCreateOptions, 'parent'>): ReturnType<Space['rooms']['create']> {
    return this.space.rooms.create({ ...options, parent: this.id });
  }
}

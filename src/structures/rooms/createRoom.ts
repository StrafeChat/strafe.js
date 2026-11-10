import type { Client } from '../../client/Client.js';
import { RoomType } from '../../types/api/room.js';
import type { Space } from '../Space.js';
import type { APIRoomLike } from './BaseRoom.js';
import { GroupPMRoom } from './GroupPMRoom.js';
import type { AnyRoom } from './index.js';
import { PMRoom } from './PMRoom.js';
import { SectionRoom } from './SectionRoom.js';
import { TextRoom } from './TextRoom.js';
import { ThreadRoom } from './ThreadRoom.js';
import { VoiceRoom } from './VoiceRoom.js';

/**
 * Builds the room class for a wire room. A space room needs its space; one without (an unknown
 * space) cannot be built and gives `null`.
 *
 * @internal
 */
export function createRoom(client: Client, data: APIRoomLike & { type: RoomType }, space: Space | null): AnyRoom | null {
  switch (data.type) {
    case RoomType.PM:
      return new PMRoom(client, { ...data, type: RoomType.PM });
    case RoomType.GroupPM:
      return new GroupPMRoom(client, { ...data, type: RoomType.GroupPM });
    case RoomType.SpaceText:
      return space ? new TextRoom(client, { ...data, type: RoomType.SpaceText }, space) : null;
    case RoomType.SpaceVoice:
      return space ? new VoiceRoom(client, { ...data, type: RoomType.SpaceVoice }, space) : null;
    case RoomType.SpaceSection:
      return space ? new SectionRoom(client, { ...data, type: RoomType.SpaceSection }, space) : null;
    case RoomType.Thread:
      return space ? new ThreadRoom(client, { ...data, type: RoomType.Thread }, space) : null;
    default:
      return null;
  }
}

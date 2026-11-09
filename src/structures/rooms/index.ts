// Room classes and the unions used to narrow them.
import type { GroupPMRoom } from './GroupPMRoom.js';
import type { PMRoom } from './PMRoom.js';
import type { SectionRoom } from './SectionRoom.js';
import type { TextRoom } from './TextRoom.js';
import type { ThreadRoom } from './ThreadRoom.js';
import type { VoiceRoom } from './VoiceRoom.js';

export { BaseRoom, type FederationRef, type APIRoomLike } from './BaseRoom.js';
export { BaseSpaceRoom } from './BaseSpaceRoom.js';
export { TextRoom } from './TextRoom.js';
export { VoiceRoom } from './VoiceRoom.js';
export { SectionRoom } from './SectionRoom.js';
export { ThreadRoom, type ThreadAutoArchiveDuration, type ThreadEditOptions } from './ThreadRoom.js';
export { PMRoom } from './PMRoom.js';
export { GroupPMRoom } from './GroupPMRoom.js';
export type { PermissionsTarget } from './permissions.js';

/** Every room class; `switch (room.type)` narrows it. */
export type AnyRoom = TextRoom | VoiceRoom | SectionRoom | ThreadRoom | PMRoom | GroupPMRoom;

/** Rooms that hold messages. */
export type TextBasedRoom = TextRoom | VoiceRoom | ThreadRoom | PMRoom | GroupPMRoom;

/** Rooms with a `send` method (sending still fails in an encrypted room). */
export type SendableRoom = TextBasedRoom;

/** Rooms of a space (threads included). */
export type SpaceBasedRoom = TextRoom | VoiceRoom | SectionRoom | ThreadRoom;

/** Text-based rooms of a space. */
export type SpaceTextBasedRoom = TextRoom | VoiceRoom | ThreadRoom;

/** PMs and group PMs. */
export type PMBasedRoom = PMRoom | GroupPMRoom;

/** A room or its id. */
export type RoomResolvable = AnyRoom | string;

import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeTypeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { PermissionOverwriteOptions } from '../structures/PermissionOverwrites.js';
import type { OverwriteType } from '../structures/PermissionOverwrites.js';
import type { BaseSpaceRoom } from '../structures/rooms/BaseSpaceRoom.js';
import type { SectionRoom } from '../structures/rooms/SectionRoom.js';
import type { SpaceBasedRoom } from '../structures/rooms/index.js';
import type { TextRoom } from '../structures/rooms/TextRoom.js';
import type { ThreadRoom } from '../structures/rooms/ThreadRoom.js';
import type { VoiceRoom } from '../structures/rooms/VoiceRoom.js';
import type { Role } from '../structures/Role.js';
import type { Space } from '../structures/Space.js';
import type { SpaceMember } from '../structures/SpaceMember.js';
import type { User } from '../structures/User.js';
import type {
  RESTGetAPIActiveThreadsResult,
  RESTPatchAPISpaceRoomJSONBody,
  RESTPostAPISpaceRoomJSONBody,
  RESTPostAPISpaceRoomsMoveJSONBody,
  RESTPostAPISpaceRoomsReorderJSONBody,
} from '../types/api/rest.js';
import type { APISpaceRoom } from '../types/api/room.js';
import { RoomType } from '../types/api/room.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { DataManager } from './BaseManager.js';

/** An override to set on a new room. */
export interface OverwriteData {
  /** The role or member (a bare id is looked up in the role cache, else taken as a member). */
  id: Role | SpaceMember | User | Snowflake;
  /** Role or member override (guessed when omitted). */
  type?: OverwriteType;
  /** Permissions to allow (`true`), deny (`false`); see {@link PermissionOverwriteOptions}. */
  permissions: PermissionOverwriteOptions;
}

/** What {@link SpaceRoomManager.create} takes. */
export interface SpaceRoomCreateOptions {
  /** Name (at most 100 characters). */
  name: string;
  /** Text (default), voice or section. */
  type?: RoomType.SpaceText | RoomType.SpaceVoice | RoomType.SpaceSection;
  /** The section to put it in (it then starts synced with the section). */
  parent?: SectionRoom | Snowflake | null;
  /** Turn on end-to-end encryption (text rooms only). A bot cannot use an encrypted room. */
  e2eeEnabled?: boolean;
  /** Voice: most people at once (0-99). */
  userLimit?: number;
  /** Voice: bitrate (8000-384000, 0 = default). */
  bitrate?: number;
  /** Topic (set with a second request). */
  topic?: string;
  /** Slowmode in seconds (set with a second request). */
  rateLimitPerUser?: number;
  /** Overrides to set right after creating it. */
  permissionOverwrites?: readonly OverwriteData[];
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** What {@link SpaceRoomManager.edit} takes. */
export interface SpaceRoomEditOptions {
  /** Name. */
  name?: string;
  /** Topic (at most 1024 characters). */
  topic?: string;
  /** Slowmode in seconds. */
  rateLimitPerUser?: number;
  /** End-to-end encryption on or off (text rooms). */
  e2eeEnabled?: boolean;
  /** Voice: user limit (0-99). */
  userLimit?: number;
  /** Voice: bitrate. */
  bitrate?: number;
  /** Use the section's overrides (Manage Roles). */
  permissionsSynced?: boolean;
  /** Move into a section (`null` to move out). */
  parent?: SectionRoom | Snowflake | null;
  /** With `parent`: sync with the new section (default true). */
  lockPermissions?: boolean;
  /** Move within its group. */
  position?: number;
  /** Ignored (Strafe records no reason). */
  reason?: string;
}

/** Options of {@link SpaceRoomManager.setParent}. */
export interface SetParentOptions {
  /** Sync the room with its new section afterwards (default true, like discord.js). */
  lockPermissions?: boolean;
  /** Put it before this room (default: last). */
  before?: BaseSpaceRoom | Snowflake | null;
}

/** The room type a create call returns. */
export type CreatedRoom<T> = T extends RoomType.SpaceVoice ? VoiceRoom : T extends RoomType.SpaceSection ? SectionRoom : TextRoom;

/**
 * A space's rooms: text and voice rooms, sections, and the
 * active threads. The cache shares its room objects with `client.rooms`.
 */
export class SpaceRoomManager extends DataManager<Snowflake, SpaceBasedRoom, SpaceBasedRoom> {
  /** The space. */
  declare public readonly space: Space;
  /** @internal */
  public readonly _cache = new Collection<Snowflake, SpaceBasedRoom>();

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client);
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** The cached rooms, threads included. */
  public get cache(): Collection<Snowflake, SpaceBasedRoom> {
    return this._cache;
  }

  /** Rooms (not threads) sorted the way clients list them: sections by position, rooms by position within them. */
  public get sorted(): BaseSpaceRoom[] {
    const rooms = [...this.cache.values()].filter((room): room is TextRoom | VoiceRoom | SectionRoom => !room.isThread());
    const sectionPosition = (room: BaseSpaceRoom): number => {
      if (room.isSection()) return room.rawPosition;
      const parent = room.parent;
      return parent ? parent.rawPosition : -1;
    };
    return rooms.sort(
      (a, b) =>
        sectionPosition(a) - sectionPosition(b) ||
        Number(b.isSection()) - Number(a.isSection()) ||
        a.rawPosition - b.rawPosition ||
        SnowflakeUtil.compare(a.id, b.id),
    );
  }

  /**
   * Fetches the room list (every room the client can see, with overrides, plus active threads), or
   * returns one room from it.
   *
   * @param id - A room id, or nothing for all.
   * @param options - `force` skips the cache for one room.
   */
  public fetch(id: Snowflake, options?: { force?: boolean }): Promise<SpaceBasedRoom | null>;
  public fetch(id?: null, options?: { force?: boolean }): Promise<Collection<Snowflake, SpaceBasedRoom>>;
  public async fetch(id?: Snowflake | null, options: { force?: boolean } = {}): Promise<SpaceBasedRoom | null | Collection<Snowflake, SpaceBasedRoom>> {
    if (id !== undefined && id !== null && options.force !== true) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }
    const data = await this.client.rest.get<APISpaceRoom[]>(Routes.spaceRooms(this.space.id));
    const seen = new Set<Snowflake>();
    for (const room of data) {
      const added = this.client.rooms._add(room, this.space);
      if (added) seen.add(added.id);
    }
    for (const room of [...this.cache.values()]) {
      // Archived threads are not in the list; keep them. Rooms that vanished are gone (or no longer visible).
      if (!seen.has(room.id) && !room.isThread()) this.client.rooms._remove(room.id);
    }
    if (id !== undefined && id !== null) return this.cache.get(id) ?? null;
    return new Collection(this.cache);
  }

  /**
   * Creates a room (Manage Rooms). Topic, slowmode and overrides are applied with follow-up requests.
   *
   * @param options - Name, type, section, settings.
   * @example
   * ```ts
   * const room = await space.rooms.create({ name: 'announcements', topic: 'News' });
   * const voice = await space.rooms.create({ name: 'Lounge', type: RoomType.SpaceVoice, userLimit: 10 });
   * ```
   */
  public async create<T extends SpaceRoomCreateOptions>(options: T): Promise<CreatedRoom<T['type']>> {
    const body: RESTPostAPISpaceRoomJSONBody = { name: options.name, type: options.type ?? RoomType.SpaceText };
    if (options.parent !== undefined && options.parent !== null) body.parent_id = typeof options.parent === 'string' ? options.parent : options.parent.id;
    if (options.e2eeEnabled !== undefined) body.e2ee_enabled = options.e2eeEnabled;
    if (options.userLimit !== undefined) body.user_limit = options.userLimit;
    if (options.bitrate !== undefined) body.bitrate = options.bitrate;
    const data = await this.client.rest.post<APISpaceRoom>(Routes.spaceRooms(this.space.id), { body });
    const room = this.client.rooms._add(data, this.space) as BaseSpaceRoom | null;
    if (!room) throw new StrafeTypeError(ErrorCodes.InvalidType, 'The created room', 'a space room');
    if (options.topic !== undefined || options.rateLimitPerUser !== undefined) {
      await this.edit(room, {
        ...(options.topic === undefined ? {} : { topic: options.topic }),
        ...(options.rateLimitPerUser === undefined ? {} : { rateLimitPerUser: options.rateLimitPerUser }),
      });
    }
    for (const overwrite of options.permissionOverwrites ?? []) {
      await room.permissionOverwrites.create(overwrite.id, overwrite.permissions, overwrite.type === undefined ? {} : { type: overwrite.type });
    }
    return room as CreatedRoom<T['type']>;
  }

  /**
   * Edits a room (Manage Rooms). The server answers with no body, so the cache is patched with what
   * was sent (and the gateway's room update confirms it).
   *
   * @param room - The room or id.
   * @param options - What to change.
   */
  public async edit(room: BaseSpaceRoom | Snowflake, options: SpaceRoomEditOptions): Promise<BaseSpaceRoom> {
    const resolved = this.resolveRoom(room);
    const body: RESTPatchAPISpaceRoomJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.topic !== undefined) body.topic = options.topic;
    if (options.rateLimitPerUser !== undefined) body.slowmode_seconds = options.rateLimitPerUser;
    if (options.e2eeEnabled !== undefined) body.e2ee_enabled = options.e2eeEnabled;
    if (options.userLimit !== undefined) body.user_limit = options.userLimit;
    if (options.bitrate !== undefined) body.bitrate = options.bitrate;
    if (options.permissionsSynced !== undefined) body.permissions_synced = options.permissionsSynced;
    if (Object.keys(body).length > 0) {
      await this.client.rest.patch(Routes.spaceRoom(this.space.id, resolved.id), { body });
      resolved._patch({ id: resolved.id, ...body });
    }
    if (options.parent !== undefined) {
      await this.setParent(resolved, options.parent, options.lockPermissions === undefined ? {} : { lockPermissions: options.lockPermissions });
    }
    if (options.position !== undefined) await this.setPosition(resolved, options.position);
    return resolved;
  }

  /**
   * Deletes a room (Manage Rooms). Deleting a section moves its rooms out of it.
   *
   * @param room - The room or id.
   * @param _reason - Ignored.
   */
  public async delete(room: BaseSpaceRoom | ThreadRoom | Snowflake, _reason?: string): Promise<void> {
    const id = typeof room === 'string' ? room : room.id;
    const cached = this.cache.get(id);
    if (cached?.isThread()) {
      await cached.delete();
      return;
    }
    await this.client.rest.delete(Routes.spaceRoom(this.space.id, id));
    this.client.rooms._remove(id);
  }

  /**
   * Moves a room into a section (or out with `null`), last in it unless `before` says otherwise.
   *
   * @param room - The room.
   * @param section - The section, or `null`.
   * @param options - Sync afterwards, and where to put it.
   */
  public async setParent(room: BaseSpaceRoom | Snowflake, section: SectionRoom | Snowflake | null, options: SetParentOptions = {}): Promise<BaseSpaceRoom> {
    const resolved = this.resolveRoom(room);
    if (resolved.isSection()) throw new StrafeError(ErrorCodes.InvalidArgument, 'A section cannot be put in a section');
    const parentId = section === null ? null : typeof section === 'string' ? section : section.id;
    const body: RESTPostAPISpaceRoomsMoveJSONBody = { channel_id: resolved.id, parent_section_id: parentId };
    if (options.before !== undefined && options.before !== null) body.before_room_id = typeof options.before === 'string' ? options.before : options.before.id;
    await this.client.rest.post(Routes.spaceRoomsMove(this.space.id), { body });
    resolved._patch({ id: resolved.id, parent_id: parentId });
    if (parentId !== null && (options.lockPermissions ?? true) && !resolved.permissionsSynced) {
      await this.edit(resolved, { permissionsSynced: true });
    }
    return resolved;
  }

  /**
   * Moves a room within its group (sections among sections, rooms within their section).
   *
   * @param room - The room.
   * @param position - Its index in the group (0 = first; past the end = last).
   */
  public async setPosition(room: BaseSpaceRoom | Snowflake, position: number): Promise<BaseSpaceRoom> {
    const resolved = this.resolveRoom(room);
    const group = this.group(resolved).filter((other) => other.id !== resolved.id);
    group.splice(Math.max(0, Math.min(position, group.length)), 0, resolved);
    await this.reorder(resolved.isSection() ? 'sections' : 'channels', resolved.isSection() ? null : resolved.parentId, group); // terms-ok: wire value
    group.forEach((other, index) => {
      other.rawPosition = index;
    });
    return resolved;
  }

  /**
   * Sets the order of several rooms at once. Rooms are grouped (sections; rooms per section) and
   * each group is reordered with one request.
   *
   * @param positions - Rooms and their index in their group.
   */
  public async setPositions(positions: readonly { room: BaseSpaceRoom | Snowflake; position: number }[]): Promise<this> {
    const byGroup = new Map<string, { anchor: BaseSpaceRoom; moves: { room: BaseSpaceRoom; position: number }[] }>();
    for (const { room, position } of positions) {
      const resolved = this.resolveRoom(room);
      const key = resolved.isSection() ? 'sections' : `rooms:${resolved.parentId ?? ''}`;
      const entry = byGroup.get(key) ?? { anchor: resolved, moves: [] };
      entry.moves.push({ room: resolved, position });
      byGroup.set(key, entry);
    }
    for (const { anchor, moves } of byGroup.values()) {
      const moving = new Set(moves.map((m) => m.room.id));
      const group = this.group(anchor).filter((room) => !moving.has(room.id));
      for (const move of [...moves].sort((a, b) => a.position - b.position)) {
        group.splice(Math.max(0, Math.min(move.position, group.length)), 0, move.room);
      }
      await this.reorder(anchor.isSection() ? 'sections' : 'channels', anchor.isSection() ? null : anchor.parentId, group); // terms-ok: wire value
      group.forEach((room, index) => {
        room.rawPosition = index;
      });
    }
    return this;
  }

  /** Fetches the space's active threads (all rooms). */
  public async fetchActiveThreads(): Promise<Collection<Snowflake, ThreadRoom>> {
    const data = await this.client.rest.get<RESTGetAPIActiveThreadsResult>(Routes.spaceActiveThreads(this.space.id));
    const out = new Collection<Snowflake, ThreadRoom>();
    for (const thread of data.threads) {
      const room = this.client.rooms._add(thread, this.space);
      if (room?.isThread()) out.set(room.id, room);
    }
    return out;
  }

  private async reorder(scope: RESTPostAPISpaceRoomsReorderJSONBody['scope'], parentId: Snowflake | null, group: readonly BaseSpaceRoom[]): Promise<void> {
    const body: RESTPostAPISpaceRoomsReorderJSONBody = { scope, room_ids: group.map((room) => room.id) };
    if (scope !== 'sections') body.parent_section_id = parentId;
    await this.client.rest.post(Routes.spaceRoomsReorder(this.space.id), { body });
  }

  private group(room: BaseSpaceRoom): BaseSpaceRoom[] {
    const all = this.sorted;
    return room.isSection() ? all.filter((other) => other.isSection()) : all.filter((other) => !other.isSection() && other.parentId === room.parentId);
  }

  private resolveRoom(room: BaseSpaceRoom | Snowflake): BaseSpaceRoom {
    const resolved = typeof room === 'string' ? this.cache.get(room) : room;
    if (!resolved || resolved.isThread()) throw new StrafeError(ErrorCodes.NotFound, `Room ${typeof room === 'string' ? room : room.id}`);
    return resolved;
  }
}

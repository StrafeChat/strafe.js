import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import type { PermissionOverwriteManager } from '../../managers/PermissionOverwriteManager.js';
import type { APIRoomLike } from '../../structures/rooms/BaseRoom.js';
import type { AnyRoom } from '../../structures/rooms/index.js';
import type { ThreadMember } from '../../structures/ThreadMember.js';
import type {
  GatewayEnvelope,
  GatewayRoleOverrideDeleteData,
  GatewayRoleOverrideUpdateData,
  GatewayRoomLeaveData,
  GatewaySpaceRoomDeleteData,
  GatewaySpaceRoomUpdateData,
  GatewayThreadDeleteData,
  GatewayThreadMembersUpdateData,
  GatewayThreadMemberUpdateData,
  GatewayUserOverrideDeleteData,
  GatewayUserOverrideUpdateData,
} from '../../types/api/gateway.js';
import type { APIPMRoom, APISpaceRoom } from '../../types/api/room.js';
import { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import { debug, emitRoomCreate, emitRoomDelete, emitRoomUpdate, spaceOf } from './util.js';

/**
 * `SPACE_ROOM_CREATE`: an upsert. Emits `roomCreate` (or `threadCreate`) for a room that was not
 * cached, else `roomUpdate`.
 *
 * @internal
 */
export function spaceRoomCreate(client: Client, data: APISpaceRoom & { room_id?: Snowflake }, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) {
    debug(client, `SPACE_ROOM_CREATE for an unknown space (${data.space_id})`);
    return;
  }
  const id = data.room_id ?? data.id;
  const existing = client.rooms.cache.get(id);
  const old = existing?._clone();
  const room = client.rooms._add({ ...data, id }, space);
  if (!room) return;
  if (old) emitRoomUpdate(client, old, room);
  else emitRoomCreate(client, room, false);
}

/** `SPACE_ROOM_UPDATE`: a partial room keyed by `room_id`, merged into the cached one. @internal */
export function spaceRoomUpdate(client: Client, data: GatewaySpaceRoomUpdateData): void {
  const room = client.rooms.cache.get(data.room_id);
  if (!room) {
    debug(client, `SPACE_ROOM_UPDATE for an uncached room (${data.room_id})`);
    return;
  }
  const old = room._update({ ...data, id: data.room_id } satisfies APIRoomLike);
  emitRoomUpdate(client, old, room);
}

/** `SPACE_ROOM_DELETE` (deleted, or the client lost View Room). @internal */
export function spaceRoomDelete(client: Client, data: GatewaySpaceRoomDeleteData): void {
  const room = client.rooms._remove(data.room_id);
  if (room) emitRoomDelete(client, room);
}

function overwriteChange(client: Client, data: { room_id: Snowflake }, apply: (manager: PermissionOverwriteManager) => void): void {
  const room = client.rooms.cache.get(data.room_id);
  const manager = room ? overwritesOf(room) : null;
  if (!room || !manager) return;
  const old = room._clone();
  apply(manager);
  emitRoomUpdate(client, old, room);
}

function overwritesOf(room: AnyRoom): PermissionOverwriteManager | null {
  return room.isPMBased() || room.isThread() ? null : room.permissionOverwrites;
}

/** `SPACE_ROOM_OVERRIDE_UPDATE`: emits `roomUpdate` with the room before and after. @internal */
export function roleOverrideUpdate(client: Client, data: GatewayRoleOverrideUpdateData): void {
  overwriteChange(client, data, (manager) => {
    manager._add({ role_id: data.role_id, allow: data.allow, deny: data.deny, created_at: data.created_at, updated_at: data.updated_at });
  });
}

/** `SPACE_ROOM_OVERRIDE_DELETE`. @internal */
export function roleOverrideDelete(client: Client, data: GatewayRoleOverrideDeleteData): void {
  overwriteChange(client, data, (manager) => {
    manager._cache.delete(data.role_id);
  });
}

/** `SPACE_ROOM_USER_OVERRIDE_UPDATE`. @internal */
export function userOverrideUpdate(client: Client, data: GatewayUserOverrideUpdateData): void {
  overwriteChange(client, data, (manager) => {
    manager._add({ user_id: data.user_id, allow: data.allow, deny: data.deny, created_at: data.created_at, updated_at: data.updated_at });
  });
}

/** `SPACE_ROOM_USER_OVERRIDE_DELETE`. @internal */
export function userOverrideDelete(client: Client, data: GatewayUserOverrideDeleteData): void {
  overwriteChange(client, data, (manager) => {
    manager._cache.delete(data.user_id);
  });
}

/** `ROOM_CREATE` / `ROOM_UPDATE` (PMs and group PMs). @internal */
export function pmRoomUpsert(client: Client, data: APIPMRoom): void {
  const existing = client.rooms.cache.get(data.id);
  const old = existing?._clone();
  const room = client.rooms._add(data);
  if (!room) return;
  if (old) emitRoomUpdate(client, old, room);
  else emitRoomCreate(client, room);
}

/** `ROOM_LEAVE`: the client left or was removed from a PM or group PM. @internal */
export function roomLeave(client: Client, data: GatewayRoomLeaveData): void {
  const room = client.rooms._remove(data.room_id);
  if (room) emitRoomDelete(client, room);
}

/**
 * A thread event without its `joined`. THREAD_CREATE and THREAD_UPDATE are one payload for every
 * recipient, built for someone else: the creator (`joined: true` on a new thread), the person who
 * edited it, or nobody (the auto-archive sends `joined: false`). The client's own membership comes
 * from THREAD_MEMBER(S)_UPDATE, READY and REST answers only.
 */
function withoutJoined<T extends APISpaceRoom>(data: T): T {
  if (data.thread?.joined === undefined) return data;
  const { joined: _joined, ...thread } = data.thread;
  return { ...data, thread };
}

/**
 * `THREAD_CREATE`: emits `threadCreate` for a thread that was not cached (like discord.js). The
 * client counts as joined only when it created the thread (`newly_created` and it is the owner).
 *
 * @internal
 */
export function threadCreate(client: Client, data: APISpaceRoom & { room_id?: Snowflake; newly_created?: boolean }, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const id = data.room_id ?? data.id;
  const existed = client.rooms.cache.has(id);
  const room = client.rooms._add({ ...withoutJoined(data), id }, space);
  if (room?.isThread() && data.newly_created === true && client._userId !== null && room.ownerId === client._userId) room.joined = true;
  if (!existed && room) emitRoomCreate(client, room, data.newly_created === true);
}

/** `THREAD_UPDATE`: old and new thread; a thread that was not cached is emitted as `threadCreate`. @internal */
export function threadUpdate(client: Client, data: APISpaceRoom & { room_id?: Snowflake }, envelope: GatewayEnvelope): void {
  const id = data.room_id ?? data.id;
  const existing = client.rooms.cache.get(id);
  if (existing) {
    const old = existing._update({ ...withoutJoined(data), id });
    emitRoomUpdate(client, old, existing);
    return;
  }
  threadCreate(client, data, envelope);
}

/** `THREAD_DELETE`. @internal */
export function threadDelete(client: Client, data: GatewayThreadDeleteData): void {
  const room = client.rooms._remove(data.room_id);
  if (room) emitRoomDelete(client, room);
}

/** `THREAD_MEMBERS_UPDATE`: emits the members who joined and left. @internal */
export function threadMembersUpdate(client: Client, data: GatewayThreadMembersUpdateData): void {
  const thread = client.rooms.cache.get(data.room_id);
  if (!thread?.isThread()) return;
  thread.memberCount = data.member_count;
  const self = client._userId;
  const added = new Collection<Snowflake, ThreadMember>();
  for (const entry of data.added_members) {
    added.set(entry.user_id, thread.members._add({ user_id: entry.user_id, joined_at: entry.joined_at }));
    if (entry.user_id === self) thread.joined = true;
  }
  const removed = new Collection<Snowflake, ThreadMember>();
  for (const id of data.removed_member_ids) {
    removed.set(id, thread.members.cache.get(id) ?? thread.members._add({ user_id: id }, false));
    thread.members._cache.delete(id);
    if (id === self) thread.joined = false;
  }
  client.emit(Events.ThreadMembersUpdate, added, removed, thread);
}

/**
 * `THREAD_MEMBER_UPDATE` (the client joined or left a thread). A private thread the client was
 * added to and did not know is fetched and emitted as `threadCreate`.
 *
 * @internal
 */
export async function threadMemberUpdate(client: Client, data: GatewayThreadMemberUpdateData): Promise<void> {
  const cached = client.rooms.cache.get(data.room_id);
  if (cached?.isThread()) {
    cached.joined = data.joined;
    return;
  }
  if (cached || !data.joined) return;
  try {
    const room = await client.rooms.fetch(data.room_id);
    if (room.isThread()) {
      room.joined = true;
      emitRoomCreate(client, room, false);
    }
  } catch (error) {
    debug(client, `Could not fetch thread ${data.room_id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import type { AnyRoom } from '../../structures/rooms/index.js';
import type { Space } from '../../structures/Space.js';
import type { GatewayReadyData } from '../../types/api/gateway.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { WebSocketManager } from '../WebSocketManager.js';
import { emitRoomCreate, emitRoomDelete, nonEmpty } from './util.js';

/**
 * READY (op 4), the first frame of every connection. There is no resume, so every READY replaces
 * the caches: spaces (with roles and the rooms the client can view), PMs, voice states and the
 * client's own user. On a reconnect, spaces and rooms that appeared or vanished while the client
 * was offline are emitted as create and delete events, then `gatewayReady` and `reconnected`. A
 * cached thread READY leaves out is marked archived rather than deleted, since READY only lists
 * active threads and the archived ones the client joined. The
 * first READY emits `gatewayReady`, then `clientReady` and its alias `ready`.
 *
 * Members are not part of READY: a member list fetched earlier is kept, and may have missed changes
 * made while the client was offline.
 *
 * @internal
 */
export function handleReady(client: Client, data: GatewayReadyData, ws: WebSocketManager): void {
  const first = client.readyTimestamp === null;
  client._setClientUser(data.user);

  const createdSpaces: Space[] = [];
  const deletedSpaces: Space[] = [];
  const createdRooms: AnyRoom[] = [];
  const deletedRooms: AnyRoom[] = [];

  // READY's `rooms` also lists space rooms (a lighter form) and archived threads the client joined;
  // those belong to their space.
  const extraSpaceRooms = new Map<Snowflake, Set<Snowflake>>();
  for (const room of data.rooms ?? []) {
    const spaceId = nonEmpty(room.space_id);
    if (spaceId === undefined) continue;
    const ids = extraSpaceRooms.get(spaceId) ?? new Set<Snowflake>();
    ids.add(room.id);
    extraSpaceRooms.set(spaceId, ids);
  }

  const seenSpaces = new Set<Snowflake>();
  for (const raw of data.spaces ?? []) {
    seenSpaces.add(raw.id);
    const rooms = data.space_rooms?.[raw.id] ?? [];
    const existing = client.spaces.cache.get(raw.id);
    const before = existing ? new Set(existing.rooms.cache.keys()) : null;
    const space = client.spaces._add({ ...raw, rooms });
    space.voiceStates._cache.clear();
    if (!existing || !before) {
      createdSpaces.push(space);
      continue;
    }
    const keep = new Set<Snowflake>(rooms.map((room) => room.id));
    for (const id of extraSpaceRooms.get(raw.id) ?? []) keep.add(id);
    // Collect first, then remove: removing a room also removes its threads, which must still be
    // reported as deleted.
    const gone: AnyRoom[] = [];
    for (const id of before) {
      if (keep.has(id)) continue;
      const room = client.rooms.cache.get(id);
      if (!room) continue;
      if (room.isThread() && room.parentId !== null && keep.has(room.parentId)) {
        // READY lists active threads and the archived threads the client joined, so a cached
        // thread missing from both is archived (and not joined), not deleted. It stays cached
        // until THREAD_DELETE or its parent's removal.
        room.archived = true;
        room.joined = false;
        continue;
      }
      gone.push(room);
    }
    for (const room of gone) {
      client.rooms._remove(room.id);
      deletedRooms.push(room);
    }
    for (const room of rooms) {
      if (before.has(room.id)) continue;
      const added = client.rooms.cache.get(room.id);
      if (added) createdRooms.push(added);
    }
  }
  for (const space of [...client.spaces.cache.values()]) {
    if (seenSpaces.has(space.id)) continue;
    client.spaces._remove(space.id);
    deletedSpaces.push(space);
  }

  const seenPMs = new Set<Snowflake>();
  for (const room of data.rooms ?? []) {
    const existed = client.rooms.cache.has(room.id);
    const added = client.rooms._add(room);
    if (!added) continue;
    if (added.isPMBased()) seenPMs.add(added.id);
    if (!existed && !first) createdRooms.push(added);
  }
  for (const room of [...client.rooms.cache.values()]) {
    if (!room.isPMBased() || seenPMs.has(room.id)) continue;
    client.rooms._remove(room.id);
    deletedRooms.push(room);
  }

  for (const state of data.voice_states ?? []) {
    const spaceId = nonEmpty(state.space_id);
    if (spaceId !== undefined) client.spaces.cache.get(spaceId)?.voiceStates._add(state);
  }

  if (first) client.readyTimestamp = Date.now();
  ws._markReady();
  client.emit(Events.Debug, `[gateway] READY: ${client.spaces.cache.size} spaces, ${client.rooms.cache.size} rooms`);

  if (!first) {
    for (const space of createdSpaces) client.emit(Events.SpaceCreate, space);
    for (const space of deletedSpaces) client.emit(Events.SpaceDelete, space);
    for (const room of createdRooms) emitRoomCreate(client, room, false);
    for (const room of deletedRooms) emitRoomDelete(client, room);
  }
  client.emit(Events.GatewayReady);
  if (first) {
    const ready = client as Client<true>;
    client.emit(Events.ClientReady, ready);
    client.emit('ready', ready);
    client._applyInitialPresence();
  } else {
    client.emit(Events.Reconnected);
  }
  ws._resolveLogin();
}

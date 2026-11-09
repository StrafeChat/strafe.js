import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import type { AnyRoom, TextBasedRoom } from '../../structures/rooms/index.js';
import type { Space } from '../../structures/Space.js';
import type { GatewayEnvelope } from '../../types/api/gateway.js';
import type { Snowflake } from '../../util/Snowflake.js';

/** A handler for one dispatch event. @internal */
export type DispatchHandler<D> = (client: Client, data: D, envelope: GatewayEnvelope) => void | Promise<void>;

/** Emits a gateway debug line. @internal */
export function debug(client: Client, message: string): void {
  client.emit(Events.Debug, `[gateway] ${message}`);
}

/**
 * The space an event is about: the payload's `space_id` first (older servers put the id of the
 * subscription that routed it in the envelope), then the envelope's.
 *
 * @internal
 */
export function spaceOf(client: Client, data: { space_id?: Snowflake | undefined }, envelope: GatewayEnvelope): Space | null {
  const id = nonEmpty(data.space_id) ?? nonEmpty(envelope.space_id);
  return id === undefined ? null : (client.spaces.cache.get(id) ?? null);
}

/**
 * The text-based room an event is about, fetched (`GET /rooms/:id`) when it is not cached. `null`
 * when the room is unknown, cannot be fetched or holds no messages.
 *
 * @internal
 */
export async function textRoomOf(client: Client, data: { room_id?: Snowflake | undefined }, envelope: GatewayEnvelope): Promise<TextBasedRoom | null> {
  const id = nonEmpty(data.room_id) ?? nonEmpty(envelope.room_id);
  if (id === undefined) return null;
  const cached = client.rooms.cache.get(id);
  if (cached) return cached.isTextBased() ? cached : null;
  try {
    const room = await client.rooms.fetch(id);
    return room.isTextBased() ? room : null;
  } catch (error) {
    debug(client, `Dropped an event for room ${id}, which is not cached and could not be fetched: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Emits `roomCreate`, or `threadCreate` for a thread. @internal */
export function emitRoomCreate(client: Client, room: AnyRoom, newlyCreated = false): void {
  if (room.isThread()) client.emit(Events.ThreadCreate, room, newlyCreated);
  else client.emit(Events.RoomCreate, room);
}

/** Emits `roomUpdate`, or `threadUpdate` for a thread. @internal */
export function emitRoomUpdate(client: Client, old: AnyRoom, room: AnyRoom): void {
  if (room.isThread() && old.isThread()) client.emit(Events.ThreadUpdate, old, room);
  else client.emit(Events.RoomUpdate, old, room);
}

/** Emits `roomDelete`, or `threadDelete` for a thread. @internal */
export function emitRoomDelete(client: Client, room: AnyRoom): void {
  if (room.isThread()) client.emit(Events.ThreadDelete, room);
  else client.emit(Events.RoomDelete, room);
}

/** `undefined` for `undefined`, `null` and `''`. @internal */
export function nonEmpty(value: string | null | undefined): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : value;
}

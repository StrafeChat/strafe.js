import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import type { Message, PartialMessage } from '../../structures/Message.js';
import type { TextBasedRoom } from '../../structures/rooms/index.js';
import { Typing } from '../../structures/Typing.js';
import type {
  GatewayDispatchDataMap,
  GatewayEnvelope,
  GatewayMessageDeleteData,
  GatewayMessageReactionData,
  GatewayRoomPinsUpdateData,
  GatewayTypingStartData,
} from '../../types/api/gateway.js';
import type { APIMessage } from '../../types/api/message.js';
import type { Snowflake } from '../../util/Snowflake.js';
import { parseTimestamp } from '../../util/Util.js';
import { textRoomOf } from './util.js';

type MessageData = Partial<APIMessage> & { id: Snowflake };

function setLastMessage(room: TextBasedRoom, id: Snowflake | null): void {
  if ('lastMessageId' in room) room.lastMessageId = id;
}

/** `MESSAGE_CREATE`: caches the message and emits `messageCreate` (system notices and encrypted messages included). @internal */
export async function messageCreate(client: Client, data: GatewayDispatchDataMap['MESSAGE_CREATE'], envelope: GatewayEnvelope): Promise<void> {
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const message = room.messages._add(data as MessageData) as Message;
  setLastMessage(room, message.id);
  if (room.isThread() && room.messageCount !== null) room.messageCount++;
  client.emit(Events.MessageCreate, message);
}

/** `MESSAGE_UPDATE`: patches the cached message; the old copy is a partial message when it was not cached. @internal */
export async function messageUpdate(client: Client, data: GatewayDispatchDataMap['MESSAGE_UPDATE'], envelope: GatewayEnvelope): Promise<void> {
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const existing = room.messages.cache.get(data.id) as Message | undefined;
  let old: Message | PartialMessage;
  let message: Message;
  if (existing) {
    old = existing._update(data);
    message = existing;
  } else {
    old = room.messages._add({ id: data.id, room_id: room.id }, false);
    message = room.messages._add(data);
  }
  client.emit(Events.MessageUpdate, old, message);
}

/** `MESSAGE_DELETE`: uncaches the message (a partial message when it was not cached) and emits `messageDelete`. @internal */
export async function messageDelete(client: Client, data: GatewayMessageDeleteData, envelope: GatewayEnvelope): Promise<void> {
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const message = (room.messages.cache.get(data.message_id) ?? room.messages._add({ id: data.message_id, room_id: room.id }, false)) as Message;
  room.messages._cache.delete(data.message_id);
  if (data.last_message_id !== undefined) setLastMessage(room, data.last_message_id);
  if (room.isThread() && room.messageCount !== null && room.messageCount > 0) room.messageCount--;
  client.emit(Events.MessageDelete, message);
}

async function reaction(client: Client, data: GatewayMessageReactionData, envelope: GatewayEnvelope, added: boolean): Promise<void> {
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const message = (room.messages.cache.get(data.message_id) ?? room.messages._add({ id: data.message_id, room_id: room.id }, false)) as Message;
  const key = message.reactions.resolveId(data.emoji) ?? data.emoji;
  // A reaction the message's summary did not have starts at zero; on a partial message the
  // count is unknown (null) until fetched.
  const entry =
    message.reactions.cache.get(key) ?? message.reactions._add(message.partial ? { emoji: data.emoji } : { emoji: data.emoji, count: 0, me: false }, added);
  const user = client.users.cache.get(data.user_id) ?? client.users._add({ id: data.user_id });
  if (added) {
    entry._add(user.id);
    client.emit(Events.MessageReactionAdd, entry, user);
  } else {
    entry._remove(user.id);
    if (entry.count === 0) message.reactions._cache.delete(key);
    client.emit(Events.MessageReactionRemove, entry, user);
  }
}

/** `MESSAGE_REACTION_ADD`. @internal */
export function messageReactionAdd(client: Client, data: GatewayMessageReactionData, envelope: GatewayEnvelope): Promise<void> {
  return reaction(client, data, envelope, true);
}

/** `MESSAGE_REACTION_REMOVE`. @internal */
export function messageReactionRemove(client: Client, data: GatewayMessageReactionData, envelope: GatewayEnvelope): Promise<void> {
  return reaction(client, data, envelope, false);
}

/** `ROOM_PINS_UPDATE`: updates the cached message's pin and emits `roomPinsUpdate`. @internal */
export async function roomPinsUpdate(client: Client, data: GatewayRoomPinsUpdateData, envelope: GatewayEnvelope): Promise<void> {
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const message = room.messages.cache.get(data.message_id) as Message | undefined;
  if (message) {
    message.pinned = data.pinned;
    message.pinnedTimestamp = data.pinned ? (parseTimestamp(data.pinned_at) ?? Date.now()) : null;
    message.pinnedById = data.pinned ? data.user_id : null;
  }
  const last = parseTimestamp(data.last_pin_timestamp);
  client.emit(Events.RoomPinsUpdate, room, last === null ? null : new Date(last), { messageId: data.message_id, pinned: data.pinned, userId: data.user_id });
}

/** `TYPING_START`. @internal */
export async function typingStart(client: Client, data: GatewayTypingStartData, envelope: GatewayEnvelope): Promise<void> {
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const user = client.users.cache.get(data.user_id) ?? client.users._add({ id: data.user_id });
  client.emit(Events.TypingStart, new Typing(client, room, user, data));
}

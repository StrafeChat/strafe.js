import type { Client } from '../../client/Client.js';
import type { GatewayDispatchDataMap, GatewayEnvelope, GatewayReceivePayload } from '../../types/api/gateway.js';
import { GatewayOpcodes } from '../../types/api/gateway.js';
import type { WebSocketManager } from '../WebSocketManager.js';
import { messageCreate, messageDelete, messageReactionAdd, messageReactionRemove, messageUpdate, roomPinsUpdate, typingStart } from './messages.js';
import { handleReady } from './ready.js';
import {
  pmRoomUpsert,
  roleOverrideDelete,
  roleOverrideUpdate,
  roomLeave,
  spaceRoomCreate,
  spaceRoomDelete,
  spaceRoomUpdate,
  threadCreate,
  threadDelete,
  threadMembersUpdate,
  threadMemberUpdate,
  threadUpdate,
  userOverrideDelete,
  userOverrideUpdate,
} from './rooms.js';
import {
  emojiCreate,
  emojiDelete,
  emojiUpdate,
  roleCreate,
  roleDelete,
  roleUpdate,
  spaceCreate,
  spaceDelete,
  spaceMemberAdd,
  spaceMemberRemove,
  spaceMemberUpdate,
  spaceUpdate,
} from './spaces.js';
import { presenceUpdate, sessionRevoked, userUpdate, voiceStateUpdate } from './users.js';
import type { DispatchHandler } from './util.js';

/**
 * What each dispatch event does to the caches and which client event it emits. Events left out
 * (`MESSAGE`, `MESSAGE_ACK`, `MESSAGE_MENTION_UPDATE`, `ROOM_NOTIFY_SETTINGS_UPDATE`,
 * `SESSION_ROTATE`, `CALL_*`, end-to-end encryption device traffic) are only emitted as `raw`.
 *
 * @internal
 */
export const DispatchHandlers: { [T in keyof GatewayDispatchDataMap]?: DispatchHandler<GatewayDispatchDataMap[T]> } = {
  MESSAGE_CREATE: messageCreate,
  MESSAGE_UPDATE: messageUpdate,
  MESSAGE_DELETE: messageDelete,
  MESSAGE_REACTION_ADD: messageReactionAdd,
  MESSAGE_REACTION_REMOVE: messageReactionRemove,
  ROOM_PINS_UPDATE: roomPinsUpdate,
  TYPING_START: typingStart,
  SPACE_ROOM_CREATE: spaceRoomCreate,
  SPACE_ROOM_UPDATE: spaceRoomUpdate,
  SPACE_ROOM_DELETE: spaceRoomDelete,
  SPACE_ROOM_OVERRIDE_UPDATE: roleOverrideUpdate,
  SPACE_ROOM_OVERRIDE_DELETE: roleOverrideDelete,
  SPACE_ROOM_USER_OVERRIDE_UPDATE: userOverrideUpdate,
  SPACE_ROOM_USER_OVERRIDE_DELETE: userOverrideDelete,
  ROOM_CREATE: pmRoomUpsert,
  ROOM_UPDATE: pmRoomUpsert,
  ROOM_LEAVE: roomLeave,
  THREAD_CREATE: threadCreate,
  THREAD_UPDATE: threadUpdate,
  THREAD_DELETE: threadDelete,
  THREAD_MEMBERS_UPDATE: threadMembersUpdate,
  THREAD_MEMBER_UPDATE: threadMemberUpdate,
  SPACE_CREATE: spaceCreate,
  SPACE_UPDATE: spaceUpdate,
  SPACE_DELETE: spaceDelete,
  SPACE_LEAVE: spaceDelete,
  SPACE_MEMBER_ADD: spaceMemberAdd,
  SPACE_MEMBER_UPDATE: spaceMemberUpdate,
  SPACE_MEMBER_REMOVE: spaceMemberRemove,
  SPACE_ROLE_CREATE: roleCreate,
  SPACE_ROLE_UPDATE: roleUpdate,
  SPACE_ROLE_DELETE: roleDelete,
  SPACE_EMOJI_CREATE: emojiCreate,
  SPACE_EMOJI_UPDATE: emojiUpdate,
  SPACE_EMOJI_DELETE: emojiDelete,
  PRESENCE_UPDATE: presenceUpdate,
  USER_UPDATE: userUpdate,
  SESSION_REVOKED: sessionRevoked,
  VOICE_STATE_UPDATE: voiceStateUpdate,
};

/**
 * Applies one READY or dispatch frame. Returns a promise when the handler had to fetch something
 * (an uncached room), so the caller can keep events in order.
 *
 * @internal
 */
export function handlePacket(client: Client, packet: GatewayReceivePayload, ws: WebSocketManager): void | Promise<void> {
  if (packet.op === GatewayOpcodes.Ready) {
    handleReady(client, packet.d, ws);
    return;
  }
  if (packet.op !== GatewayOpcodes.Dispatch) return;
  // The frame repeats `t` at its top level; the envelope's copy is the documented one.
  const envelope = packet.d as GatewayEnvelope | undefined;
  const t = (packet.t as string | undefined) ?? envelope?.t;
  if (!envelope || typeof t !== 'string' || envelope.d === undefined || envelope.d === null) return;
  const handler = (DispatchHandlers as Record<string, DispatchHandler<unknown> | undefined>)[t];
  return handler?.(client, envelope.d, envelope);
}

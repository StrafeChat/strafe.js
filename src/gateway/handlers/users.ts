import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import { VoiceState } from '../../structures/VoiceState.js';
import type {
  GatewayEnvelope,
  GatewayPresenceUpdateData,
  GatewaySessionRevokedData,
  GatewayUserUpdateData,
} from '../../types/api/gateway.js';
import type { APIVoiceState } from '../../types/api/voice.js';
import { spaceOf } from './util.js';

/**
 * `PRESENCE_UPDATE`: replaces the user's presence. The server sends one copy per shared space;
 * copies that change nothing are not emitted again.
 *
 * @internal
 */
export function presenceUpdate(client: Client, data: GatewayPresenceUpdateData): void {
  const old = client.users.cache.get(data.user_id)?.presence?._clone() ?? null;
  const presence = client.users._add({ id: data.user_id, presence: data.presence }).presence;
  if (!presence || old?.equals(presence) === true) return;
  client.emit(Events.PresenceUpdate, old, presence);
}

/**
 * `USER_UPDATE`: patches a cached user (`userUpdate` with the old and new copy). The server sends
 * one copy per room the user is seen in; copies that change nothing are not emitted again.
 *
 * @internal
 */
export function userUpdate(client: Client, data: GatewayUserUpdateData): void {
  const { user_id: id, room_id: _room, space_id: _space, ...fields } = data;
  const user = client.users.cache.get(id);
  if (!user) {
    client.users._add({ ...fields, id });
    return;
  }
  const before = JSON.stringify(user.toJSON());
  const old = user._update({ ...fields, id });
  if (JSON.stringify(user.toJSON()) === before) return;
  client.emit(Events.UserUpdate, old, user);
}

/** `SESSION_REVOKED`: the token is dead; the client stops and emits `invalidated`. @internal */
export function sessionRevoked(client: Client, data: GatewaySessionRevokedData): void {
  client._invalidated(data.reason);
}

/** `VOICE_STATE_UPDATE` in a space (PM calls are not surfaced). @internal */
export function voiceStateUpdate(client: Client, data: APIVoiceState, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const existing = space.voiceStates.cache.get(data.user_id);
  const old = existing ? existing._clone() : new VoiceState(client, { user_id: data.user_id }, space);
  const state = space.voiceStates._add(data);
  if (data.left === true) space.voiceStates._cache.delete(data.user_id);
  client.emit(Events.VoiceStateUpdate, old, state);
}

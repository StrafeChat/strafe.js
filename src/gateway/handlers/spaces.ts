import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import type {
  GatewayEnvelope,
  GatewaySpaceCreateData,
  GatewaySpaceDeleteData,
  GatewaySpaceEmojiDeleteData,
  GatewaySpaceMemberAddData,
  GatewaySpaceMemberRemoveData,
  GatewaySpaceMemberUpdateData,
  GatewaySpaceRoleData,
  GatewaySpaceRoleDeleteData,
  GatewaySpaceUpdateData,
} from '../../types/api/gateway.js';
import type { APIEmoji } from '../../types/api/space.js';
import { debug, spaceOf } from './util.js';

/** `SPACE_CREATE`: a space the client joined, created or was installed into (with roles and rooms). @internal */
export function spaceCreate(client: Client, data: GatewaySpaceCreateData): void {
  const existed = client.spaces.cache.has(data.id);
  const space = client.spaces._add(data);
  if (!existed) client.emit(Events.SpaceCreate, space);
}

/** `SPACE_UPDATE` (carries the full role list after a reorder or a bot install). @internal */
export function spaceUpdate(client: Client, data: GatewaySpaceUpdateData): void {
  const space = client.spaces.cache.get(data.id);
  if (!space) {
    client.spaces._add(data);
    return;
  }
  const old = space._update(data);
  client.emit(Events.SpaceUpdate, old, space);
}

/** `SPACE_DELETE` and `SPACE_LEAVE` (left, kicked, banned or deleted): emits `spaceDelete` once. @internal */
export function spaceDelete(client: Client, data: GatewaySpaceDeleteData): void {
  const space = client.spaces._remove(data.space_id);
  if (space) client.emit(Events.SpaceDelete, space);
}

/** `SPACE_MEMBER_ADD`. @internal */
export function spaceMemberAdd(client: Client, data: GatewaySpaceMemberAddData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const member = space.members._add(data);
  client.emit(Events.SpaceMemberAdd, member);
}

/** `SPACE_MEMBER_UPDATE`: the old member is partial when it was not cached. @internal */
export function spaceMemberUpdate(client: Client, data: GatewaySpaceMemberUpdateData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const existing = space.members.cache.get(data.user_id);
  if (existing) {
    const old = existing._update(data);
    client.emit(Events.SpaceMemberUpdate, old, existing);
    return;
  }
  const old = space.members._add({ user_id: data.user_id }, false);
  const member = space.members._add(data);
  client.emit(Events.SpaceMemberUpdate, old, member);
}

/** `SPACE_MEMBER_REMOVE`: the member is partial when it was not cached. @internal */
export function spaceMemberRemove(client: Client, data: GatewaySpaceMemberRemoveData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const member = space.members.cache.get(data.user_id) ?? space.members._add({ user_id: data.user_id }, false);
  space.members._cache.delete(data.user_id);
  client.emit(Events.SpaceMemberRemove, member);
}

/** `SPACE_ROLE_CREATE`. @internal */
export function roleCreate(client: Client, data: GatewaySpaceRoleData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const existed = space.roles.cache.has(data.id);
  const role = space.roles._add(data);
  if (!existed) client.emit(Events.RoleCreate, role);
}

/** `SPACE_ROLE_UPDATE`. @internal */
export function roleUpdate(client: Client, data: GatewaySpaceRoleData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const role = space.roles.cache.get(data.id);
  if (!role) {
    client.emit(Events.RoleCreate, space.roles._add(data));
    return;
  }
  const old = role._update(data);
  client.emit(Events.RoleUpdate, old, role);
}

/** `SPACE_ROLE_DELETE`. @internal */
export function roleDelete(client: Client, data: GatewaySpaceRoleDeleteData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  const role = space?.roles.cache.get(data.role_id);
  if (!space || !role) return;
  space.roles._cache.delete(data.role_id);
  client.emit(Events.RoleDelete, role);
}

/** `SPACE_EMOJI_CREATE`. @internal */
export function emojiCreate(client: Client, data: APIEmoji, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const existed = space.emojis.cache.has(data.id);
  const emoji = space.emojis._add(data);
  if (!existed) client.emit(Events.EmojiCreate, emoji);
}

/** `SPACE_EMOJI_UPDATE`. @internal */
export function emojiUpdate(client: Client, data: APIEmoji, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  if (!space) return;
  const emoji = space.emojis.cache.get(data.id);
  if (!emoji) {
    debug(client, `SPACE_EMOJI_UPDATE for an uncached emoji (${data.id}); caching it`);
    space.emojis._add(data);
    return;
  }
  const old = emoji._update(data);
  client.emit(Events.EmojiUpdate, old, emoji);
}

/** `SPACE_EMOJI_DELETE`. @internal */
export function emojiDelete(client: Client, data: GatewaySpaceEmojiDeleteData, envelope: GatewayEnvelope): void {
  const space = spaceOf(client, data, envelope);
  const emoji = space?.emojis.cache.get(data.emoji_id);
  if (!space || !emoji) return;
  space.emojis._cache.delete(data.emoji_id);
  client.emit(Events.EmojiDelete, emoji);
}

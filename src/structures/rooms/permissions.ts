import type { PermissionMemberData, PermissionOverwriteData, PermissionRoomData } from '../../util/PermissionsBitField.js';
import { PermissionsBitField, computeRoomPermissions } from '../../util/PermissionsBitField.js';
import type { Snowflake } from '../../util/Snowflake.js';
import { OverwriteType } from '../PermissionOverwrites.js';
import { Role } from '../Role.js';
import { SpaceMember } from '../SpaceMember.js';
import { User } from '../User.js';
import type { BaseSpaceRoom } from './BaseSpaceRoom.js';
import type { ThreadRoom } from './ThreadRoom.js';

/** Something {@link BaseSpaceRoom.permissionsFor} accepts: a member, a user, a role, or an id of one. */
export type PermissionsTarget = SpaceMember | User | Role | Snowflake;

/**
 * The permission view of a room for the resolver: its own overrides, sync flag and parent chain.
 *
 * @internal
 */
export function permissionRoomData(room: BaseSpaceRoom | ThreadRoom): PermissionRoomData {
  if (room.isThread()) {
    const parent = room.parent;
    return {
      type: room.type,
      permissionsSynced: false,
      roleOverwrites: [],
      userOverwrites: [],
      parent: parent ? permissionRoomData(parent) : null,
      privateThread: room.isPrivate,
    };
  }
  const roleOverwrites: PermissionOverwriteData[] = [];
  const userOverwrites: PermissionOverwriteData[] = [];
  for (const overwrite of room.permissionOverwrites.cache.values()) {
    (overwrite.type === OverwriteType.Role ? roleOverwrites : userOverwrites).push(overwrite._data());
  }
  const parent = room.parent;
  return {
    type: room.type,
    permissionsSynced: room.permissionsSynced,
    roleOverwrites,
    userOverwrites,
    parent: parent ? permissionRoomData(parent) : null,
  };
}

/**
 * A member's (or a role's) permissions in a room, resolved like the server does. `null` when the
 * member is not cached.
 *
 * @internal
 */
export function permissionsIn(room: BaseSpaceRoom | ThreadRoom, target: PermissionsTarget): Readonly<PermissionsBitField> | null {
  const space = room.space;
  let member: PermissionMemberData;
  if (target instanceof Role || (typeof target === 'string' && space.roles.cache.has(target))) {
    const role = target instanceof Role ? target : space.roles.cache.get(target);
    if (!role) return null;
    member = { id: '', roleIds: [role.id] };
  } else {
    const id = target instanceof SpaceMember || target instanceof User ? target.id : target;
    const cached = target instanceof SpaceMember ? target : space.members.cache.get(id);
    if (!cached) {
      // The owner holds everything whether or not their member is cached.
      if (id === space.ownerId) member = { id, roleIds: [] };
      else return null;
    } else {
      member = { id, roleIds: cached._roles };
    }
    if (room.isThread()) member.isThreadMember = room.members.cache.has(id) || (id === room.client._userId && room.joined);
  }
  return new PermissionsBitField(computeRoomPermissions(space._permissionSpaceData(), permissionRoomData(room), member)).freeze();
}

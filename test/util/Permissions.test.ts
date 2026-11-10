import { describe, expect, it } from 'vitest';
import { StrafeRangeError } from '../../src/errors/StrafeError.js';
import { BitField } from '../../src/util/BitField.js';
import {
  PermissionFlagsBits as P,
  PermissionsBitField,
  computeRoomPermissions,
  computeSpacePermissions,
  type PermissionRoomData,
  type PermissionSpaceData,
} from '../../src/util/PermissionsBitField.js';

describe('PermissionFlagsBits', () => {
  it('matches the server (bits.go)', () => {
    expect(Object.keys(P)).toHaveLength(31);
    expect(P.ViewRoom).toBe(1n);
    expect(P.SendMessages).toBe(2n);
    expect(P.Administrator).toBe(2048n);
    expect(P.ManageSpace).toBe(4096n);
    expect(P.AttachFiles).toBe(8388608n);
    expect(P.EmbedLinks).toBe(1073741824n);
    const values = Object.values(P);
    expect(new Set(values).size).toBe(31);
    values.forEach((value, index) => expect(value).toBe(1n << BigInt(index)));
  });

  it('has the server masks', () => {
    expect(PermissionsBitField.Default).toBe(1436786719n);
    expect(PermissionsBitField.AllRoom).toBe(1342144639n);
    expect(PermissionsBitField.All).toBe(2147483647n);
    expect(PermissionsBitField.AllVoice).toBe(8355840n);
    expect(PermissionsBitField.AllThreads).toBe(251658240n);
  });
});

describe('PermissionsBitField', () => {
  it('resolves names, bigints, wire numbers, numeric strings and arrays', () => {
    expect(PermissionsBitField.resolve('SendMessages')).toBe(2n);
    expect(PermissionsBitField.resolve(6n)).toBe(6n);
    expect(PermissionsBitField.resolve(6)).toBe(6n);
    expect(PermissionsBitField.resolve('1436786719')).toBe(1436786719n);
    expect(PermissionsBitField.resolve(['ViewRoom', P.SendMessages, ['EmbedLinks']])).toBe(1n | 2n | P.EmbedLinks);
    expect(PermissionsBitField.resolve(new PermissionsBitField(['ManageRoles']))).toBe(P.ManageRoles);
    expect(PermissionsBitField.resolve()).toBe(0n);
  });

  it('rejects unknown flags and negative numbers', () => {
    expect(() => PermissionsBitField.resolve('ViewChannel')).toThrow(StrafeRangeError); // terms-ok: d.js name must fail
    expect(() => PermissionsBitField.resolve(-1)).toThrow(StrafeRangeError);
    expect(() => PermissionsBitField.resolve(1.5)).toThrow(StrafeRangeError);
  });

  it('has/any/missing count Administrator unless checkAdmin is false', () => {
    const admin = new PermissionsBitField(P.Administrator);
    expect(admin.has(P.BanMembers)).toBe(true);
    expect(admin.has(P.BanMembers, false)).toBe(false);
    expect(admin.any([P.BanMembers, P.KickMembers])).toBe(true);
    expect(admin.any([P.BanMembers], false)).toBe(false);
    expect(admin.missing([P.BanMembers])).toEqual([]);
    expect(admin.missing([P.BanMembers], false)).toEqual(['BanMembers']);

    const mod = new PermissionsBitField([P.KickMembers, P.ViewRoom]);
    expect(mod.has([P.KickMembers, P.ViewRoom])).toBe(true);
    expect(mod.has([P.KickMembers, P.BanMembers])).toBe(false);
    expect(mod.any([P.KickMembers, P.BanMembers])).toBe(true);
    expect(mod.missing([P.KickMembers, P.BanMembers, P.ManageRoles])).toEqual(['ManageRoles', 'BanMembers']);
  });

  it('add/remove/freeze/equals', () => {
    const perms = new PermissionsBitField();
    perms.add('ViewRoom', P.SendMessages);
    expect(perms.bitfield).toBe(3n);
    perms.remove('ViewRoom');
    expect(perms.bitfield).toBe(2n);
    expect(perms.equals(2)).toBe(true);
    const frozen = perms.freeze();
    const added = frozen.add('ViewRoom');
    expect(added).not.toBe(frozen);
    expect(added.bitfield).toBe(3n);
    expect(frozen.bitfield).toBe(2n);
    expect(frozen.remove('SendMessages').bitfield).toBe(0n);
  });

  it('toArray, serialize, iteration, toJSON, valueOf', () => {
    const perms = new PermissionsBitField([P.ViewRoom, P.Administrator]);
    expect(perms.toArray()).toEqual(['ViewRoom', 'Administrator']);
    expect([...perms]).toEqual(['ViewRoom', 'Administrator']);
    const serialized = perms.serialize();
    expect(serialized.BanMembers).toBe(true);
    expect(perms.serialize(false).BanMembers).toBe(false);
    expect(perms.toJSON()).toBe(2049);
    expect(JSON.stringify({ permissions: perms })).toBe('{"permissions":2049}');
    expect(perms.valueOf()).toBe(2049n);
    expect(new PermissionsBitField(PermissionsBitField.Default).has('EmbedLinks')).toBe(true);
  });
});

describe('BitField with numbers', () => {
  class Flags extends BitField<'A' | 'B'> {
    public static override Flags = { A: 1, B: 2 };
    public static override DefaultBit = 0;
  }
  it('works with number bitfields', () => {
    const flags = new Flags(['A', 'B']);
    expect(flags.bitfield).toBe(3);
    expect(flags.toArray()).toEqual(['A', 'B']);
    expect(flags.toJSON()).toBe(3);
    expect(Flags.resolve(2n)).toBe(2);
    expect(new Flags('A').missing(['A', 'B'])).toEqual(['B']);
  });
});

// Shared vectors: the same cases the server's snapshot.go resolution must give.
describe('computeSpacePermissions / computeRoomPermissions', () => {
  const EVERYONE = '100';
  const MOD = '101';
  const MUTED = '102';
  const ADMIN = '103';
  const space: PermissionSpaceData = {
    ownerId: '1',
    everyoneRoleId: EVERYONE,
    rolePermissions: new Map<string, bigint | number>([
      [EVERYONE, Number(PermissionsBitField.Default)],
      [MOD, P.KickMembers | P.ManageMessages],
      [MUTED, 0],
      [ADMIN, P.Administrator],
    ]),
  };
  const plainRoom = (over: Partial<PermissionRoomData> = {}): PermissionRoomData => ({
    type: 3,
    permissionsSynced: false,
    roleOverwrites: [],
    userOverwrites: [],
    parent: null,
    ...over,
  });

  it('owner and Administrator', () => {
    expect(computeSpacePermissions(space, { id: '1', roleIds: [] })).toBe(PermissionsBitField.All);
    expect(computeSpacePermissions(space, { id: '2', roleIds: [ADMIN] })).toBe(PermissionsBitField.All);
    expect(computeRoomPermissions(space, plainRoom(), { id: '1', roleIds: [] })).toBe(PermissionsBitField.AllRoom);
    const hidden = plainRoom({ roleOverwrites: [{ id: EVERYONE, allow: 0, deny: Number(P.ViewRoom) }] });
    expect(computeRoomPermissions(space, hidden, { id: '2', roleIds: [ADMIN] })).toBe(PermissionsBitField.AllRoom);
  });

  it('base = @everyone | roles, without the admin expansion', () => {
    expect(computeSpacePermissions(space, { id: '2', roleIds: [MOD] })).toBe(PermissionsBitField.Default | P.KickMembers | P.ManageMessages);
    expect(computeSpacePermissions(space, { id: '2', roleIds: [EVERYONE] })).toBe(PermissionsBitField.Default);
    expect(computeSpacePermissions({ ...space, everyoneRoleId: null }, { id: '2', roleIds: [] })).toBe(0n);
  });

  it('applies @everyone, then all role overrides together, then the user override', () => {
    const room = plainRoom({
      roleOverwrites: [
        { id: EVERYONE, allow: 0, deny: Number(P.SendMessages) },
        { id: MOD, allow: Number(P.SendMessages), deny: 0 },
        { id: MUTED, allow: 0, deny: Number(P.SendMessages | P.AddReactions) },
      ],
      userOverwrites: [{ id: '5', allow: Number(P.AddReactions), deny: 0 }],
    });
    const everyone = computeRoomPermissions(space, room, { id: '3', roleIds: [] });
    expect(everyone & P.SendMessages).toBe(0n);
    // Role allows win over role denies of the same level (deny first, then allow).
    const modAndMuted = computeRoomPermissions(space, room, { id: '4', roleIds: [MOD, MUTED] });
    expect(modAndMuted & P.SendMessages).toBe(P.SendMessages);
    expect(modAndMuted & P.AddReactions).toBe(0n);
    const userOverride = computeRoomPermissions(space, room, { id: '5', roleIds: [MUTED] });
    expect(userOverride & P.AddReactions).toBe(P.AddReactions);
  });

  it('implicit rules: no View = nothing; no Send drops Attach/Embed/Mention Everyone', () => {
    const hidden = plainRoom({ roleOverwrites: [{ id: EVERYONE, allow: 0, deny: Number(P.ViewRoom) }] });
    expect(computeRoomPermissions(space, hidden, { id: '3', roleIds: [MOD] })).toBe(0n);
    const readOnly = plainRoom({
      roleOverwrites: [{ id: EVERYONE, allow: Number(P.MentionEveryone), deny: Number(P.SendMessages) }],
    });
    const perms = computeRoomPermissions(space, readOnly, { id: '3', roleIds: [] });
    expect(perms & (P.AttachFiles | P.EmbedLinks | P.MentionEveryone)).toBe(0n);
    expect(perms & P.ViewRoom).toBe(P.ViewRoom);
  });

  it('synced rooms use the section overrides; threads use their room', () => {
    const section = plainRoom({ type: 5, roleOverwrites: [{ id: EVERYONE, allow: 0, deny: Number(P.ViewRoom) }] });
    const synced = plainRoom({ parent: section, permissionsSynced: true, roleOverwrites: [{ id: EVERYONE, allow: Number(P.ViewRoom), deny: 0 }] });
    const unsynced = plainRoom({ parent: section, permissionsSynced: false });
    expect(computeRoomPermissions(space, synced, { id: '3', roleIds: [] })).toBe(0n);
    expect(computeRoomPermissions(space, unsynced, { id: '3', roleIds: [] })).not.toBe(0n);
    const thread = plainRoom({ type: 6, parent: synced, roleOverwrites: [{ id: EVERYONE, allow: Number(P.ViewRoom), deny: 0 }] });
    expect(computeRoomPermissions(space, thread, { id: '3', roleIds: [] })).toBe(0n);
  });

  it('private threads need membership or Manage Threads', () => {
    const parent = plainRoom();
    const thread = plainRoom({ type: 6, parent, privateThread: true });
    expect(computeRoomPermissions(space, thread, { id: '3', roleIds: [] })).toBe(0n);
    expect(computeRoomPermissions(space, thread, { id: '3', roleIds: [], isThreadMember: true })).not.toBe(0n);
    const managers: PermissionSpaceData = { ...space, rolePermissions: new Map([...space.rolePermissions, ['200', P.ManageThreads]]) };
    expect(computeRoomPermissions(managers, thread, { id: '3', roleIds: ['200'] })).not.toBe(0n);
  });
});

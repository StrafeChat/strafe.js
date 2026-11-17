import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '../../src/errors/ErrorCodes.js';
import { StrafeRangeError } from '../../src/errors/StrafeError.js';
import { OAuth2User } from '../../src/oauth2/structures.js';
import { DefaultAvatarCount, buildDefaultAvatarURL, calculateUserDefaultAvatarIndex } from '../../src/util/avatar.js';
import { setup } from '../helpers.js';

/** An id whose default avatar index is `index` (the bits below 22 are noise). */
function idWithIndex(index: number, noise = 12345n): string {
  const timestamp = BigInt(Date.UTC(2026, 0, 1) - 1288834974657);
  return (((timestamp >> 3n) << 25n) | (BigInt(index) << 22n) | noise).toString();
}

describe('calculateUserDefaultAvatarIndex', () => {
  it('is (id >> 22) % 8, for strings and bigints', () => {
    expect(DefaultAvatarCount).toBe(8);
    for (let index = 0; index < 8; index++) {
      const id = idWithIndex(index);
      expect(calculateUserDefaultAvatarIndex(id)).toBe(index);
      expect(calculateUserDefaultAvatarIndex(BigInt(id))).toBe(index);
    }
    expect(calculateUserDefaultAvatarIndex('0')).toBe(0);
    expect(calculateUserDefaultAvatarIndex('4194303')).toBe(0);
    expect(calculateUserDefaultAvatarIndex('4194304')).toBe(1);
    expect(calculateUserDefaultAvatarIndex(7n << 22n)).toBe(7);
    expect(calculateUserDefaultAvatarIndex(8n << 22n)).toBe(0);
  });

  it('uses bigint math where a Number would lose precision', () => {
    const id = '2122539805655957503';
    expect(Math.floor(Number(id) / 2 ** 22) % 8).toBe(7);
    expect(calculateUserDefaultAvatarIndex(id)).toBe(6);
    expect(calculateUserDefaultAvatarIndex('1310000000000000000')).toBe(7);
  });

  it('gives 0 for input that is not a snowflake instead of throwing', () => {
    expect(calculateUserDefaultAvatarIndex('')).toBe(0);
    expect(calculateUserDefaultAvatarIndex('abc')).toBe(0);
    expect(calculateUserDefaultAvatarIndex('-4194304')).toBe(0);
    expect(calculateUserDefaultAvatarIndex(-1n)).toBe(0);
  });
});

describe('buildDefaultAvatarURL', () => {
  it('builds <web>/avatars/default/<index>.png', () => {
    expect(buildDefaultAvatarURL('https://app.strafe.chat', 4)).toBe('https://app.strafe.chat/avatars/default/4.png');
    expect(buildDefaultAvatarURL('https://app.strafe.chat/', 0)).toBe('https://app.strafe.chat/avatars/default/0.png');
    expect(buildDefaultAvatarURL('https://example.org/strafe', 7)).toBe('https://example.org/strafe/avatars/default/7.png');
  });

  it('refuses an index outside 0..7', () => {
    for (const index of [-1, 8, 1.5, Number.NaN]) {
      expect(() => buildDefaultAvatarURL('https://app.strafe.chat', index)).toThrow(StrafeRangeError);
    }
    expect(() => buildDefaultAvatarURL('https://app.strafe.chat', 8)).toThrow(expect.objectContaining({ code: ErrorCodes.InvalidArgument }));
  });
});

describe('User#defaultAvatarURL', () => {
  it('uses the client web origin and the local id for local users', () => {
    const { client } = setup();
    const id = idWithIndex(3);
    const user = client.users._add({ id, username: 'ana', display_name: '', avatar: '' });
    expect(user.defaultAvatarIndex).toBe(3);
    expect(user.defaultAvatarURL).toBe('https://chat.example/avatars/default/3.png');
    expect(user.avatarURL()).toBeNull();
    expect(user.displayAvatarURL()).toBe(user.defaultAvatarURL);
    expect(user.displayAvatarURL({ size: 64, extension: 'webp' })).toBe(user.defaultAvatarURL);
  });

  it('keeps the uploaded avatar first and still exposes the default', () => {
    const { client } = setup();
    const user = client.users._add({ id: idWithIndex(5), username: 'bea', display_name: '', avatar: 'https://cdn/b.png' });
    expect(user.displayAvatarURL()).toBe('https://cdn/b.png');
    expect(user.defaultAvatarURL).toBe('https://chat.example/avatars/default/5.png');
    client.users._add({ id: user.id, avatar: '' });
    expect(user.displayAvatarURL()).toBe('https://chat.example/avatars/default/5.png');
  });

  it('computes remote users from their home id, on the local web origin', () => {
    const { client } = setup();
    client.federationDomain = 'chat.example';
    const remote = client.users._add({
      id: idWithIndex(1),
      username: 'bo',
      display_name: 'Bo',
      home_domain: 'other.example',
      origin_id: idWithIndex(6),
    });
    expect(remote.isRemote).toBe(true);
    expect(remote.defaultAvatarIndex).toBe(6);
    expect(remote.defaultAvatarURL).toBe('https://chat.example/avatars/default/6.png');
  });

  it('falls back to the local id when the payload has no origin id', () => {
    const { client } = setup();
    client.federationDomain = 'chat.example';
    const remote = client.users._add({ id: idWithIndex(2), username: 'cy', display_name: '', home_domain: 'other.example' });
    expect(remote.originId).toBeNull();
    expect(remote.defaultAvatarIndex).toBe(2);
    client.users._add({ id: remote.id, origin_id: idWithIndex(4) });
    expect(remote.defaultAvatarIndex).toBe(4);
  });

  it('follows the web override, not the API or CDN host', () => {
    const { client } = setup({ instance: 'https://example.org/strafe/api', web: 'https://web.example/' });
    const user = client.users._add({ id: idWithIndex(7), username: 'dee', display_name: '' });
    expect(user.defaultAvatarURL).toBe('https://web.example/avatars/default/7.png');
    const prefixed = setup({ instance: 'https://example.org/strafe/api' }).client.users._add({ id: idWithIndex(7) });
    expect(prefixed.defaultAvatarURL).toBe('https://example.org/strafe/avatars/default/7.png');
  });
});

describe('SpaceMember#displayAvatarURL', () => {
  it('prefers the space avatar, then the account avatar, then the default', () => {
    const { space } = setup();
    const id = idWithIndex(3);
    const member = space.members._add({ id, username: 'eve', display_name: '', roles: [], joined_at: '2026-01-01T00:00:00Z', nick: null, avatar: '', space_avatar: '' });
    expect(member.avatarURL()).toBeNull();
    expect(member.displayAvatarURL()).toBe('https://chat.example/avatars/default/3.png');
    space.members._add({ id, username: 'eve', display_name: '', roles: [], joined_at: '2026-01-01T00:00:00Z', nick: null, avatar: 'https://cdn/e.png', space_avatar: '' });
    expect(member.displayAvatarURL()).toBe('https://cdn/e.png');
    space.members._add({ id, username: 'eve', display_name: '', roles: [], joined_at: '2026-01-01T00:00:00Z', nick: null, avatar: 'https://cdn/e.png', space_avatar: 'https://cdn/se.png' });
    expect(member.displayAvatarURL()).toBe('https://cdn/se.png');
  });
});

describe('OAuth2User#defaultAvatarURL', () => {
  it('uses the web origin it was given', () => {
    const id = idWithIndex(5);
    const user = new OAuth2User({ id, username: 'ada', avatar: '' }, 'https://app.strafe.chat');
    expect(user.defaultAvatarIndex).toBe(5);
    expect(user.defaultAvatarURL).toBe('https://app.strafe.chat/avatars/default/5.png');
    expect(user.displayAvatarURL()).toBe(user.defaultAvatarURL);
    expect(new OAuth2User({ id, username: 'ada', avatar: 'https://cdn/a.png' }, 'https://app.strafe.chat').displayAvatarURL()).toBe('https://cdn/a.png');
  });

  it('is null without a web origin', () => {
    const user = new OAuth2User({ id: idWithIndex(5), username: 'ada' });
    expect(user.defaultAvatarURL).toBeNull();
    expect(user.displayAvatarURL()).toBeNull();
  });
});

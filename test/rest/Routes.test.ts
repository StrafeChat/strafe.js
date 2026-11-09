import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '../../src/errors/ErrorCodes.js';
import { StrafeTypeError } from '../../src/errors/StrafeError.js';
import { bigintReplacer, buildFormData, toBlob } from '../../src/rest/multipart.js';
import { Routes, majorParameter, reactionEmojiSegment, routeTemplate } from '../../src/rest/Routes.js';

describe('Routes', () => {
  it('builds paths', () => {
    expect(Routes.user()).toBe('/users/@me');
    expect(Routes.roomMessages('1')).toBe('/rooms/1/messages');
    expect(Routes.roomMessage('1', '2')).toBe('/rooms/1/messages/2');
    expect(Routes.roomMessagePin('1', '2')).toBe('/rooms/1/messages/2/pin');
    expect(Routes.spaceMemberRole('1', '2', '3')).toBe('/spaces/1/members/2/roles/3');
    expect(Routes.spaceMember('1', '@me')).toBe('/spaces/1/members/@me');
    expect(Routes.spaceRoomUserOverride('1', '2', '3')).toBe('/spaces/1/rooms/2/overrides/users/3');
    expect(Routes.threadMember('9')).toBe('/rooms/9/thread-members/@me');
    expect(Routes.instance()).toBe('/');
  });

  it('encodes invite codes (federated code@domain)', () => {
    expect(Routes.invite('abc@chat.example.org')).toBe('/spaces/invites/abc%40chat.example.org');
    expect(Routes.inviteJoin('abc')).toBe('/spaces/invites/abc/join');
  });

  it('turns reaction emoji into custom:<id> or a percent-encoded unicode emoji', () => {
    expect(reactionEmojiSegment('👋')).toBe('%F0%9F%91%8B');
    expect(reactionEmojiSegment('1️⃣')).toBe(encodeURIComponent('1️⃣'));
    expect(reactionEmojiSegment('<:blob:2102226824774811648>')).toBe('custom:2102226824774811648');
    expect(reactionEmojiSegment('<a:blob:2102226824774811648>')).toBe('custom:2102226824774811648');
    expect(reactionEmojiSegment('blob:2102226824774811648')).toBe('custom:2102226824774811648');
    expect(reactionEmojiSegment('custom:2102226824774811648')).toBe('custom:2102226824774811648');
    expect(reactionEmojiSegment('2102226824774811648')).toBe('custom:2102226824774811648');
    expect(Routes.roomMessageReaction('1', '2', '👋')).toBe('/rooms/1/messages/2/reactions/%F0%9F%91%8B');
  });

  it('refuses ids that are not snowflakes or @me, so input cannot walk to another endpoint', () => {
    const invalid = expect.objectContaining({ code: ErrorCodes.IdInvalid });
    for (const bad of ['../rooms/1', '..', '.', '1/../2', '1\\..\\2', '%2e%2e', '1?x=1', '1#x', '', ' 1', 'abc', '@you', '1'.repeat(21)]) {
      expect(() => Routes.spaceMember('1', bad), bad).toThrow(invalid);
    }
    expect(() => Routes.spaceMember('1', '../leave')).toThrow(StrafeTypeError);
    expect(() => Routes.spaceBan('1', '../leave')).toThrow(invalid);
    expect(() => Routes.room('../spaces/1')).toThrow(invalid);
    expect(() => Routes.spaceRoom('../1', '2')).toThrow(invalid);
    expect(() => Routes.roomMessage('1', '../../spaces/2')).toThrow(invalid);
    expect(() => Routes.user(42 as unknown as string)).toThrow(invalid);
    expect(() => Routes.user({ id: '1' } as unknown as string)).toThrow(invalid);
    expect(Routes.spaceMember('1', '@me')).toBe('/spaces/1/members/@me');
    expect(Routes.spaceMember('1', '18446744073709551615')).toBe('/spaces/1/members/18446744073709551615');
  });

  it('refuses . and .. as a reaction emoji or an invite code (they survive percent-encoding)', () => {
    for (const bad of ['.', '..', ' .. ', '']) {
      expect(() => reactionEmojiSegment(bad), bad).toThrow(expect.objectContaining({ code: ErrorCodes.EmojiInvalid }));
      expect(() => Routes.roomMessageReaction('1', '2', bad), bad).toThrow(expect.objectContaining({ code: ErrorCodes.EmojiInvalid }));
    }
    for (const bad of ['.', '..', '']) {
      expect(() => Routes.spaceInvite('1', bad), bad).toThrow(expect.objectContaining({ code: ErrorCodes.InviteInvalid }));
      expect(() => Routes.inviteJoin(bad), bad).toThrow(expect.objectContaining({ code: ErrorCodes.InviteInvalid }));
    }
    expect(reactionEmojiSegment('...')).toBe('...');
    expect(Routes.spaceInvite('1', '../x')).toBe('/spaces/1/invites/..%2Fx');
  });

  it('computes bucket templates and major parameters', () => {
    expect(routeTemplate('/rooms/123/messages')).toBe('/rooms/:id/messages');
    expect(routeTemplate('/rooms/123/messages?limit=5')).toBe('/rooms/:id/messages');
    expect(routeTemplate('/rooms/1/messages/2/reactions/custom:3')).toBe('/rooms/:id/messages/:id/reactions/:emoji');
    expect(routeTemplate('/spaces/invites/abc/join')).toBe('/spaces/invites/:code/join');
    expect(routeTemplate('/spaces/1/invites/xyz')).toBe('/spaces/:id/invites/:code');
    expect(routeTemplate('/users/@me')).toBe('/users/@me');
    expect(majorParameter('/rooms/123/messages/4')).toBe('123');
    expect(majorParameter('/spaces/77/members')).toBe('77');
    expect(majorParameter('/users/@me')).toBe('global');
  });
});

describe('multipart', () => {
  it('turns data into blobs', async () => {
    expect(await (await toBlob('hello')).text()).toBe('hello');
    expect((await toBlob(new Uint8Array([1, 2, 3]))).size).toBe(3);
    expect((await toBlob(new Uint8Array([1, 2, 3, 4]).subarray(1, 3))).size).toBe(2);
    expect((await toBlob(new ArrayBuffer(4), 'image/png')).type).toBe('image/png');
    const blob = new Blob(['x']);
    expect(await toBlob(blob)).toBe(blob);
    const stream = new Blob(['streamed']).stream();
    expect(await (await toBlob(stream)).text()).toBe('streamed');
  });

  it('builds form data with a file field and text fields', async () => {
    const form = await buildFormData([{ name: 'cat.png', data: new Uint8Array([1]), contentType: 'image/png' }], {
      width: 10,
      height: 20,
      skip: undefined,
      nested: { a: 1n },
    });
    const file = form.get('file') as File;
    expect(file.name).toBe('cat.png');
    expect(file.type).toBe('image/png');
    expect(form.get('width')).toBe('10');
    expect(form.has('skip')).toBe(false);
    expect(form.get('nested')).toBe('{"a":1}');
    const many = await buildFormData([
      { name: 'a.txt', data: 'a' },
      { name: 'b.txt', data: 'b', key: 'other' },
    ]);
    expect(many.has('files[0]')).toBe(true);
    expect(many.has('other')).toBe(true);
    await expect(buildFormData([], 'nope')).rejects.toThrow(TypeError);
  });

  it('serializes bigints as JSON numbers', () => {
    expect(JSON.stringify({ allow: 2049n }, bigintReplacer)).toBe('{"allow":2049}');
    expect(() => JSON.stringify({ x: 1n << 60n }, bigintReplacer)).toThrow(RangeError);
  });
});

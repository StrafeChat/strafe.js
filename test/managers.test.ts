import { describe, expect, it, vi } from 'vitest';
import { AttachmentBuilder } from '../src/builders/AttachmentBuilder.js';
import { EmbedBuilder } from '../src/builders/EmbedBuilder.js';
import { Client } from '../src/client/Client.js';
import { BulkDeleteError } from '../src/errors/BulkDeleteError.js';
import { ErrorCodes } from '../src/errors/ErrorCodes.js';
import { StrafeError } from '../src/errors/StrafeError.js';
import type { GroupPMRoom } from '../src/structures/rooms/GroupPMRoom.js';
import type { PMRoom } from '../src/structures/rooms/PMRoom.js';
import type { TextRoom } from '../src/structures/rooms/TextRoom.js';
import type { VoiceRoom } from '../src/structures/rooms/VoiceRoom.js';
import { RoomType } from '../src/types/api/room.js';
import { PermissionFlagsBits as P } from '../src/util/PermissionsBitField.js';
import {
  BOT_ID,
  ENCRYPTED_ID,
  EVERYONE_ID,
  GROUP_ID,
  MOD_ROLE_ID,
  OWNER_ID,
  PM_ID,
  SECTION_ID,
  SPACE_ID,
  TEXT_ID,
  VOICE_ID,
  message,
  role,
  setup,
  spaceRoom,
} from './helpers.js';

const now = '2026-11-09T10:00:00Z';

describe('sending', () => {
  it('sends text, replies, and caches the result', async () => {
    const { api, client } = setup();
    api.on('POST /rooms/:id/messages', (call: { body: { plaintext?: string } }) => message('100', { plaintext: call.body.plaintext ?? '', sender_id: BOT_ID }));
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const sent = await room.send('hello');
    expect(api.last().body).toEqual({ plaintext: 'hello' });
    expect(room.messages.cache.get('100')).toBe(sent);
    await sent.reply({ content: 'again' });
    expect(api.last().body).toEqual({ plaintext: 'again', reply_to_id: '100' });
    await (client.rooms.cache.get(GROUP_ID) as GroupPMRoom).send({ content: 'group' });
    expect(api.last().path).toBe(`/rooms/${GROUP_ID}/messages`);
  });

  it('refuses encrypted rooms, PMs, empty and oversized messages without a request', async () => {
    const { api, client } = setup();
    const encrypted = client.rooms.cache.get(ENCRYPTED_ID) as TextRoom;
    await expect(encrypted.send('hi')).rejects.toMatchObject({ code: ErrorCodes.RoomEncrypted });
    await expect((client.rooms.cache.get(PM_ID) as PMRoom).send('hi')).rejects.toMatchObject({ code: ErrorCodes.PMsEncrypted });
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    await expect(room.send({})).rejects.toMatchObject({ code: ErrorCodes.MessageEmpty });
    await expect(room.send('😀'.repeat(4001))).rejects.toMatchObject({ code: ErrorCodes.MessageTooLarge });
    await expect(room.send({ embeds: [{ title: 'x'.repeat(300) }] })).rejects.toMatchObject({ code: ErrorCodes.EmbedInvalid, path: 'embeds[0].title' });
    expect(api.calls).toHaveLength(0);
    await expect(room.send('😀'.repeat(4000)).catch((e: unknown) => e)).resolves.toBeInstanceOf(Error); // 404 from the fake API: it was sent
    expect(api.calls).toHaveLength(1);
  });

  it('uploads files first, then links them and rewrites attachment:// to their ids', async () => {
    const { api, client } = setup();
    let next = 0;
    api.on('POST /rooms/:id/attachments', (call: { form: FormData | null }) => {
      const file = call.form?.get('file') as File;
      next += 1;
      return { id: `90${next}`, filename: file.name.replace(/[^A-Za-z0-9._-]/g, '_'), size: file.size, url: `https://cdn/${file.name}` };
    });
    api.on('POST /rooms/:id/messages', (call: { body: unknown }) => message('101', { ...(call.body as object), sender_id: BOT_ID }));
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const embed = new EmbedBuilder().setTitle('chart').setImage('attachment://my chart.png');
    await room.send({
      content: 'files',
      embeds: [embed],
      files: [new AttachmentBuilder(new Uint8Array([1, 2, 3]), { name: 'my chart.png', width: 10, height: 20 }), { attachment: new Blob(['x']), name: 'b.txt' }],
    });
    const uploads = api.calls.filter((c) => c.path.endsWith('/attachments'));
    expect(uploads).toHaveLength(2);
    expect(uploads[0]!.form?.get('width')).toBe('10');
    expect((uploads[0]!.form?.get('file') as File).type).toBe('image/png');
    const body = api.last('POST').body as { attachments: string[]; embeds: { image: { url: string } }[] };
    expect(body.attachments).toEqual(['901', '902']);
    expect(body.embeds[0]!.image.url).toBe('attachment://901');
    expect(embed.data.image?.url).toBe('attachment://my chart.png'); // the builder itself is untouched
  });

  it('warns once about allowedMentions', async () => {
    const { api, client } = setup();
    api.on('POST /rooms/:id/messages', message('102'));
    const warn = vi.fn();
    client.on('warn', warn);
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    await room.send({ content: 'x', allowedMentions: { parse: [] } } as never);
    await room.send({ content: 'y', allowedMentions: { parse: [] } } as never);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/escapeMentions/);
  });

  it('edits text and embeds only', async () => {
    const { api, client } = setup();
    api.on('PATCH /rooms/:id/messages/:id', (call: { body: unknown }) => message('103', { sender_id: BOT_ID, plaintext: 'new', ...(call.body as object) }));
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const msg = room.messages._add(message('103', { sender_id: BOT_ID }));
    await msg.edit({ content: 'new', embeds: null });
    expect(api.last().body).toEqual({ plaintext: 'new', embeds: [] });
    expect(msg.content).toBe('new');
    await expect(msg.edit({ files: [] } as never)).rejects.toMatchObject({ code: ErrorCodes.Unsupported });
  });
});

describe('message manager', () => {
  it('fetches pages newest first whatever the cursor', async () => {
    const { api, client } = setup();
    api.on('GET /rooms/:id/messages', [message('201'), message('202'), message('203')]);
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const page = await room.messages.fetch({ after: '200', limit: 3 });
    expect([...page.keys()]).toEqual(['203', '202', '201']);
    expect(api.last().query.get('after')).toBe('200');
    expect(api.last().query.get('limit')).toBe('3');
  });

  it('fetches one message from the cache unless forced', async () => {
    const { api, client } = setup();
    api.on('GET /rooms/:id/messages/:id', message('204', { plaintext: 'fresh' }));
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    room.messages._add(message('204'));
    expect((await room.messages.fetch('204')).content).toBe('hello');
    expect(api.calls).toHaveLength(0);
    expect((await room.messages.fetch({ message: '204', force: true })).content).toBe('fresh');
  });

  it('fetches pins and reacts with custom emoji', async () => {
    const { api, client } = setup();
    api.on('GET /rooms/:id/pins', { items: [{ pinned_at: now, pinned_by: OWNER_ID, message: message('205') }], has_more: false });
    api.on('PUT /rooms/:id/messages/:id/reactions/:emoji', { reactions: [{ emoji: 'custom:555', count: 1, me: true }] });
    api.on('DELETE /rooms/:id/messages/:id/reactions/:emoji', { reactions: [] });
    api.on('PUT /rooms/:id/messages/:id/pin', undefined);
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const pins = await room.messages.fetchPins();
    const pinned = pins.get('205')!;
    expect(pinned.pinned).toBe(true);
    expect(pinned.pinnedById).toBe(OWNER_ID);
    const reaction = await pinned.react('<:party:555>');
    expect(api.last().path).toBe(`/rooms/${TEXT_ID}/messages/205/reactions/custom:555`);
    expect(reaction.me).toBe(true);
    await pinned.react('👍').catch(() => undefined);
    expect(api.last().path).toBe(`/rooms/${TEXT_ID}/messages/205/reactions/${encodeURIComponent('👍')}`);
    await reaction.remove();
    expect(pinned.reactions.cache.size).toBe(0);
    await pinned.pin();
    expect(api.last().method).toBe('PUT');
    await expect(reaction.users.remove(OWNER_ID)).rejects.toMatchObject({ code: ErrorCodes.Unsupported });
    await expect(pinned.reactions.removeAll()).rejects.toBeInstanceOf(StrafeError);
  });

  it('bulk-deletes one message at a time and reports failures', async () => {
    const { api, client } = setup();
    api.on('GET /rooms/:id/messages', [message('301'), message('302')]);
    api.on('DELETE /rooms/:id/messages/:id', (call: { path: string }) =>
      call.path.endsWith('/302') ? new Response(JSON.stringify({ error: 'cannot delete this message' }), { status: 403, headers: { 'content-type': 'application/json' } }) : undefined,
    );
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const error = await room.bulkDelete(2, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BulkDeleteError);
    expect([...(error as BulkDeleteError).deleted.keys()]).toEqual(['301']);
    expect([...(error as BulkDeleteError).failed.keys()]).toEqual(['302']);
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(2);
    const ok = await room.bulkDelete(['301']);
    expect([...ok.keys()]).toEqual(['301']);
    await expect(room.bulkDelete(101)).rejects.toMatchObject({ code: ErrorCodes.BulkDeleteLimit });
  });
});

describe('space managers', () => {
  it('fetches all members and edits roles', async () => {
    const { api, space } = setup();
    api.on('GET /spaces/:id/members', [
      { id: '600', username: 'a', display_name: '', avatar: '', banner: '', bio: '', about_me: '', pronouns: '', bot: false, public_flags: 0, joined_at: now, roles: [], nick: null, space_avatar: null, space_banner: null, space_about_me: null, space_bio: null, space_pronouns: null },
    ]);
    api.on('PUT /spaces/:id/members/:id/roles/:id', undefined);
    api.on('DELETE /spaces/:id/members/:id/roles/:id', undefined);
    api.on('PUT /spaces/:id/members/:id/roles', undefined);
    const members = await space.members.fetch();
    const member = members.get('600')!;
    expect(space.members.cache.get('600')).toBe(member);
    await member.roles.add(MOD_ROLE_ID);
    expect(api.last().path).toBe(`/spaces/${SPACE_ID}/members/600/roles/${MOD_ROLE_ID}`);
    expect(member.roles.cache.has(MOD_ROLE_ID)).toBe(true);
    await member.roles.remove(space.roles.cache.get(MOD_ROLE_ID)!);
    expect(api.last().method).toBe('DELETE');
    await member.roles.add([MOD_ROLE_ID, EVERYONE_ID, '3000000000000000009']);
    expect(api.last().body).toEqual({ role_ids: [MOD_ROLE_ID, '3000000000000000009'] });
    await member.roles.set([]);
    expect(api.last().body).toEqual({ role_ids: [] });
  });

  it('kicks, bans with a reason, and unbans', async () => {
    const { api, space } = setup();
    api.on('DELETE /spaces/:id/members/:id', undefined);
    api.on('POST /spaces/:id/bans/:id', undefined);
    api.on('DELETE /spaces/:id/bans/:id', undefined);
    api.on('GET /spaces/:id/bans', [{ user_id: '700', reason: 'spam', banned_by: OWNER_ID, created_at: now, user: { id: '700', username: 'x', display_name: '', avatar: '', public_flags: 0, bot: false } }]);
    const member = space.members.cache.get(OWNER_ID)!;
    await member.kick('ignored');
    expect(api.last()).toMatchObject({ method: 'DELETE', path: `/spaces/${SPACE_ID}/members/${OWNER_ID}` });
    expect(space.members.cache.has(OWNER_ID)).toBe(false);
    await space.members.ban('700', { reason: 'spam' });
    expect(api.last()).toMatchObject({ method: 'POST', body: { reason: 'spam' } });
    const ban = await space.bans.fetch('700');
    expect(ban.reason).toBe('spam');
    expect(ban.user.username).toBe('x');
    await space.members.unban('700');
    expect(space.bans.cache.has('700')).toBe(false);
  });

  it('creates and edits roles with numeric permissions', async () => {
    const { api, space } = setup();
    api.on('POST /spaces/:id/roles', (call: { body: { name: string; permissions: number; color: number } }) => role('3000000000000000010', 1, call.body.permissions, { name: call.body.name, color: call.body.color }));
    api.on('PATCH /spaces/:id/roles/:id', (call: { body: { position: number } }) => role('3000000000000000010', call.body.position, 64));
    const created = await space.roles.create({ name: 'Helpers', color: 'Blue', permissions: [P.ManageMessages, 'AddReactions'], position: 2 });
    const post = api.calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ name: 'Helpers', permissions: 72, color: 0x3498db });
    expect(created.position).toBe(2);
    expect(space.roles.cache.get(created.id)).toBe(created);
  });

  it('creates rooms with follow-ups, edits, moves and reorders', async () => {
    const { api, space } = setup();
    api.on('POST /spaces/:id/rooms', spaceRoom('4000000000000000099', RoomType.SpaceText, { name: 'news', parent_id: SECTION_ID, permissions_synced: true }));
    api.on('PATCH /spaces/:id/rooms/:id', undefined);
    api.on('PUT /spaces/:id/rooms/:id/overrides/:id', undefined);
    api.on('POST /spaces/:id/rooms/reorder', undefined);
    api.on('POST /spaces/:id/rooms/move', undefined);
    const room = await space.rooms.create({
      name: 'news',
      parent: SECTION_ID,
      topic: 'Updates',
      permissionOverwrites: [{ id: EVERYONE_ID, permissions: { SendMessages: false } }],
    });
    expect(room.topic).toBe('Updates');
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `POST /spaces/${SPACE_ID}/rooms`,
      `PATCH /spaces/${SPACE_ID}/rooms/${room.id}`,
      `PUT /spaces/${SPACE_ID}/rooms/${room.id}/overrides/${EVERYONE_ID}`,
    ]);
    expect(api.calls[0]!.body).toEqual({ name: 'news', type: 3, parent_id: SECTION_ID });
    expect(api.calls[2]!.body).toEqual({ allow: 0, deny: 2 });
    await room.permissionOverwrites.edit(EVERYONE_ID, { AddReactions: false });
    expect(api.last().body).toEqual({ allow: 0, deny: 10 });

    await room.setPosition(0);
    expect(api.last().body).toEqual({ scope: 'channels', parent_section_id: SECTION_ID, room_ids: [room.id, TEXT_ID, VOICE_ID] }); // terms-ok: wire value
    await room.setParent(null);
    expect(api.last().body).toEqual({ channel_id: room.id, parent_section_id: null }); // terms-ok: wire field
    expect(room.parentId).toBeNull();

    await (space.rooms.cache.get(VOICE_ID) as VoiceRoom).setUserLimit(9);
    expect(api.last().body).toEqual({ user_limit: 9 });
    expect((space.rooms.cache.get(VOICE_ID) as VoiceRoom).userLimit).toBe(9);
  });

  it('creates threads from a message and on their own', async () => {
    const { api, client } = setup();
    const thread = (id: string, extra = {}) =>
      spaceRoom(id, RoomType.Thread, {
        parent_id: TEXT_ID,
        thread: { archived: false, locked: false, private: false, invitable: true, auto_archive_minutes: 60, owner_id: BOT_ID, archived_at: null, joined: true },
        ...extra,
      });
    api.on('POST /rooms/:id/messages/:id/threads', thread('205'));
    api.on('POST /rooms/:id/threads', thread('4000000000000000077'));
    api.on('PATCH /rooms/:id/thread', thread('205', { name: 'renamed', thread: { archived: true, locked: false, private: false, invitable: true, auto_archive_minutes: 60, owner_id: BOT_ID, archived_at: now } }));
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const msg = room.messages._add(message('205'));
    const fromMessage = await msg.startThread({ name: 'talk', autoArchiveDuration: 60 });
    expect(api.last().body).toEqual({ name: 'talk', auto_archive_minutes: 60 });
    expect(fromMessage.parent).toBe(room);
    expect(room.threads.cache.has('205')).toBe(true);
    expect(msg.thread).toBeNull(); // message.thread_id comes with the next message update
    const standalone = await room.threads.create({ name: 'mods', private: true });
    expect(api.last().body).toEqual({ name: 'mods', private: true });
    expect(standalone.joined).toBe(true);
    const archived = await fromMessage.setArchived(true);
    expect(archived.archived).toBe(true);
    expect(archived.archivedAt?.toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });

  it('creates invites and emojis, edits the space', async () => {
    const { api, client, space } = setup();
    api.on('POST /spaces/:id/invites', { code: 'abc123', space_id: SPACE_ID, inviter_id: BOT_ID, max_uses: 5, current_uses: 0, created_at: now, expires_at: '2026-11-10T10:00:00Z' });
    api.on('POST /spaces/:id/emojis', (call: { form: FormData | null }) => ({ id: '800', space_id: SPACE_ID, name: call.form?.get('name'), url: 'https://cdn/e.png', animated: false }));
    api.on('PATCH /spaces/:id', (call: { body: unknown }) => ({ ...(call.body as object), id: SPACE_ID }));
    const invite = await space.invites.create({ maxAge: 86400, maxUses: 5 });
    expect(api.last().body).toEqual({ max_age_seconds: 86400, max_uses: 5 });
    expect(invite.url).toBe('https://chat.example/invite/abc123');
    expect(invite.maxAge).toBe(86400);
    expect(space.invites.cache.get('abc123')).toBe(invite);
    const emoji = await space.emojis.create({ attachment: new Uint8Array([1]), name: 'party' });
    expect(emoji.toString()).toBe('<:party:800>');
    expect(client.emojis.cache.get('800')).toBe(emoji);
    await space.edit({ name: 'Renamed', inactiveRoom: VOICE_ID, systemRoom: null });
    expect(api.last().body).toEqual({ name: 'Renamed', afk_room_id: VOICE_ID, system_room_id: '' });
    expect(space.name).toBe('Renamed');
    expect(space.inactiveRoom?.id).toBe(VOICE_ID);
    expect(space.systemRoom).toBeNull();
  });
});

describe('ids in paths', () => {
  const invalid = { name: 'StrafeTypeError [IdInvalid]', code: ErrorCodes.IdInvalid };

  it('a ../ id given to kick, ban or a room route is refused before any request', async () => {
    const { api, space, client } = setup();
    api.on('DELETE /spaces/:id/rooms/:id', undefined);
    api.on('POST /spaces/:id/leave', undefined);
    // '!kick ../rooms/<id>' would be DELETE /spaces/S/rooms/<id>: the room deleted with the bot's Manage Rooms.
    await expect(space.members.kick(`../rooms/${TEXT_ID}`)).rejects.toMatchObject(invalid);
    // '!ban ../leave' would be POST /spaces/S/leave.
    await expect(space.members.ban('../leave')).rejects.toMatchObject(invalid);
    await expect(space.bans.create('../leave')).rejects.toMatchObject(invalid);
    await expect(space.bans.remove('../leave')).rejects.toMatchObject(invalid);
    await expect(space.rooms.delete(`../../rooms/${TEXT_ID}`)).rejects.toMatchObject(invalid);
    await expect(space.members.edit(`..\\${TEXT_ID}`, { nick: 'x' })).rejects.toMatchObject(invalid);
    await expect(client.rooms.fetch(`../spaces/${SPACE_ID}`)).rejects.toMatchObject(invalid);
    await expect(space.members.fetch({ user: '../bans', force: true })).rejects.toMatchObject(invalid);
    await expect(space.roles.delete('..')).rejects.toMatchObject(invalid);
    const room = space.rooms.cache.get(TEXT_ID) as TextRoom;
    await expect(room.messages.delete('../../../spaces/1')).rejects.toMatchObject(invalid);
    await expect(room.messages.react('1000', '..')).rejects.toMatchObject({ code: ErrorCodes.EmojiInvalid });
    await expect(space.invites.delete('..')).rejects.toMatchObject({ code: ErrorCodes.InviteInvalid });
    expect(api.calls).toEqual([]);
  });

  it('raw REST paths with . or .. segments or a backslash are refused too', async () => {
    const { api, client } = setup();
    for (const route of [`/spaces/${SPACE_ID}/members/../rooms/1`, '/rooms/1/./messages', '/rooms/%2E%2e', '/rooms/1\\..\\2', '/users/..']) {
      await expect(client.rest.delete(route as `/${string}`), route).rejects.toMatchObject({ code: ErrorCodes.RouteInvalid });
    }
    api.on('GET /rooms/:id/messages', []);
    await expect(client.rest.get(`/rooms/${TEXT_ID}/messages`, { query: { q: '../..' } })).resolves.toEqual([]);
    expect(api.calls).toHaveLength(1);
  });

  it('user input cannot grow the rate-limit buckets: bad ids never reach REST', async () => {
    const { api, space, client } = setup();
    const buckets = (client.rest as unknown as { buckets: Map<string, unknown> }).buckets;
    for (let i = 0; i < 50; i++) {
      await expect(space.members.fetch({ user: `a${i}`, force: true })).rejects.toMatchObject(invalid);
    }
    expect(buckets.size).toBe(0);
    expect(api.calls).toEqual([]);
  });
});

describe('client', () => {
  it('fetches invite previews from links and federated codes', async () => {
    const { api, client } = setup();
    api.on('GET /spaces/invites/:code', { space: { id: '2000000000000000005', name: 'Remote' }, inviter: { display_name: 'Ana' }, member_count: 12 });
    const invite = await client.fetchInvite('https://chat.example/invite/xyz789');
    expect(api.last().path).toBe('/spaces/invites/xyz789');
    expect(invite.spaceName).toBe('Remote');
    expect(invite.memberCount).toBe(12);
    expect(invite.inviterDisplayName).toBe('Ana');
    await client.fetchInvite('code@other.example');
    expect(decodeURIComponent(api.last().path)).toBe('/spaces/invites/code@other.example');
  });

  it('reads the instance index and the federation domain', async () => {
    const { api, client } = setup();
    api.on('GET /', { strafe: { version: '1.2.3' }, federation: { enabled: true, domain: 'chat.example' } });
    await client.fetchInstance();
    expect(client.federationDomain).toBe('chat.example');
    expect(client.isReady()).toBe(true);
    expect(client.token).toBe('test-token');
  });

  it('opens PMs and refreshes its own user', async () => {
    const { api, client } = setup();
    api.on('POST /rooms', { id: '5000000000000000009', type: 1, recipients: [BOT_ID, '900'], created_at: now, participants: [{ id: '900', username: 'pat', display_name: '', public_flags: 0 }] });
    api.on('GET /users/@me', { id: BOT_ID, username: 'helper', display_name: 'Renamed', bot: true });
    client.users._add({ id: '900', username: 'pat' });
    const pm = await client.users.cache.get('900')!.createPM();
    expect(api.last().body).toEqual({ recipient_id: '900' });
    expect(pm.recipient?.username).toBe('pat');
    expect(await client.users.cache.get('900')!.createPM()).toBe(pm);
    const me = await client.users.fetch(BOT_ID, { force: true });
    expect(me).toBe(client.user);
    expect(me.displayName).toBe('Renamed');
  });

  it('sets the presence and the activity', async () => {
    const { api, client } = setup();
    api.on('PATCH /users/@me', { id: BOT_ID, username: 'helper', presence: { status: 'idle' } });
    const seen: unknown[] = [];
    client._onActivityChange = (activity) => seen.push(activity);
    const presence = await client.user.setPresence({ status: 'idle', activities: [{ name: 'chess' }] });
    expect(api.last().body).toEqual({ presence: { status: 'idle' } });
    expect(presence?.status).toBe('idle');
    expect(seen).toEqual([{ type: 'playing', name: 'chess' }]);
    client.user.setActivity(null);
    expect(client._activity).toBeNull();
  });

  it('has client.application = { id } with the bot id (Strafe uses one id for both)', () => {
    const { client } = setup();
    expect(client.application).toEqual({ id: BOT_ID });
    expect(client.application).toBe(client.application);
    expect(Object.isFrozen(client.application)).toBe(true);
    expect(JSON.stringify(client)).not.toContain('application');
    const fresh = new Client({ instance: 'https://chat.example' });
    expect(fresh.application).toBeNull();
  });

  it('requires an instance', () => {
    const before = process.env.STRAFE_INSTANCE;
    delete process.env.STRAFE_INSTANCE;
    try {
      expect(() => new (setup().client.constructor as new (o: object) => unknown)({})).toThrow(/STRAFE_INSTANCE/);
    } finally {
      if (before !== undefined) process.env.STRAFE_INSTANCE = before;
    }
  });
});

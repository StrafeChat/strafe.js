import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Embed } from '../src/structures/Embed.js';
import { Emoji, ReactionEmoji } from '../src/structures/Emoji.js';
import type { GroupPMRoom } from '../src/structures/rooms/GroupPMRoom.js';
import type { TextRoom } from '../src/structures/rooms/TextRoom.js';
import type { VoiceRoom } from '../src/structures/rooms/VoiceRoom.js';
import { Typing } from '../src/structures/Typing.js';
import { contentTypeFor, resolveFile } from '../src/util/DataResolver.js';
import { BOT_ID, EVERYONE_ID, GROUP_ID, MOD_ROLE_ID, OWNER_ID, SPACE_ID, TEXT_ID, VOICE_ID, apiSpace, role, setup, spaceRoom } from './helpers.js';
import { RoomType } from '../src/types/api/room.js';

const now = '2026-11-09T10:00:00Z';

describe('voice states', () => {
  it('reads states and moderates through the API', async () => {
    const { api, space } = setup();
    api.on('GET /rooms/:id/voice/states', {
      states: [{ user_id: OWNER_ID, room_id: VOICE_ID, session_id: 's', self_mute: true, self_deaf: false, mute: false, deaf: false, self_video: false, self_stream: true, suppress: false, priority_speaker: false, connected: true, joined_at: now, token_issued_at: now }],
      call: null,
    });
    api.on('PATCH /spaces/:id/members/:id/voice', undefined);
    api.on('DELETE /spaces/:id/members/:id/voice', undefined);
    const states = await space.voiceStates.fetch(VOICE_ID);
    const state = states.get(OWNER_ID)!;
    expect(state.mute).toBe(true);
    expect(state.streaming).toBe(true);
    expect(state.member?.id).toBe(OWNER_ID);
    expect(state.room?.id).toBe(VOICE_ID);
    const voice = space.rooms.cache.get(VOICE_ID) as VoiceRoom;
    expect([...voice.members.keys()]).toEqual([OWNER_ID]);
    expect(voice.full).toBe(false);
    expect(space.members.cache.get(OWNER_ID)!.voice).toBe(state);
    await state.setMute(true);
    expect(api.last().body).toEqual({ mute: true });
    await state.setRoom(TEXT_ID);
    expect(api.last().body).toEqual({ room_id: TEXT_ID });
    await state.disconnect();
    expect(api.last().method).toBe('DELETE');
    state._patch({ left: true });
    expect(state.roomId).toBeNull();
  });
});

describe('small structures', () => {
  it('typing, presence and activities', () => {
    const { client, space } = setup();
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const typing = new Typing(client, room, client.users.cache.get(OWNER_ID)!, { timestamp: 1_700_000_000 });
    expect(typing.inSpace()).toBe(true);
    expect(typing.member?.id).toBe(OWNER_ID);
    expect(typing.startedAt.getTime()).toBe(1_700_000_000_000);
    const user = client.users._add({ id: OWNER_ID, presence: { status: 'dnd', custom_status: 'busy', activities: [{ type: 'playing', name: 'chess', started_at: 5 }] } });
    expect(user.presence?.status).toBe('dnd');
    expect(user.presence?.activities[0]?.startedAt?.getTime()).toBe(5);
    expect(user.presence?.activities[0]?.toJSON()).toEqual({ type: 'playing', name: 'chess', started_at: 5 });
    expect(space.members.cache.get(OWNER_ID)!.presence).toBe(user.presence);
    const before = user.presence!._clone();
    user._patch({ id: OWNER_ID, presence: { status: 'online' } });
    expect(before.equals(user.presence)).toBe(false);
    expect(user.presence?.activities).toEqual([]);
  });

  it('received embeds and emojis', () => {
    const { client, space } = setup();
    const embed = new Embed({ title: 't', color: 0xff, footer: { text: 'f', icon_url: 'https://x/i.png' }, author: { name: 'a' }, fields: [{ name: 'n', value: 'v' }] });
    expect(embed.hexColor).toBe('#0000ff');
    expect(embed.footer).toEqual({ text: 'f', iconURL: 'https://x/i.png', proxyIconURL: undefined });
    expect(embed.author?.name).toBe('a');
    expect(embed.length).toBe(5);
    expect(embed.equals(embed.toJSON())).toBe(true);
    expect(embed.thumbnail).toBeNull();
    const unicode = new ReactionEmoji(client, '👋');
    expect(unicode.toString()).toBe('👋');
    expect(unicode.identifier).toBe('👋');
    expect(unicode.createdAt).toBeNull();
    const emoji = space.emojis._add({ id: '800', space_id: SPACE_ID, name: 'party', url: 'https://cdn/e.gif', animated: true });
    const custom = new ReactionEmoji(client, 'custom:800');
    expect(custom.name).toBe('party');
    expect(custom.toString()).toBe('<a:party:800>');
    expect(emoji.identifier).toBe('custom:800');
    expect(new Emoji(client, { id: '1', name: null }).toString()).toBe('<:_:1>');
  });
});

describe('more managers', () => {
  it('fetches spaces and the audit log', async () => {
    const { api, client, space } = setup();
    api.on('GET /spaces', [apiSpace({ id: '2000000000000000002', name: 'Second', rooms: [] })]);
    api.on('GET /spaces/:id', apiSpace({ name: 'Fresh', rooms: [] }));
    api.on('POST /spaces', apiSpace({ id: '2000000000000000003', name: 'Mine', rooms: [], owner_id: BOT_ID }));
    api.on('GET /spaces/:id/audit-log', {
      entries: [{ id: '900', action_type: 'member_ban_add', user_id: OWNER_ID, target_id: '700', created_at: now, reason: 'spam', changes: { reason: { new: 'spam' } } }],
      users: { [OWNER_ID]: { id: OWNER_ID, username: 'owner', display_name: '', avatar: '', public_flags: 0, bot: false } },
    });
    const all = await client.spaces.fetch();
    expect(all.get('2000000000000000002')?.name).toBe('Second');
    expect((await client.spaces.fetch(SPACE_ID)).name).toBe('Lobby');
    expect((await space.fetch()).name).toBe('Fresh');
    const created = await client.spaces.create({ name: 'Mine' });
    expect(api.last().body).toEqual({ name: 'Mine' });
    expect(created.ownerId).toBe(BOT_ID);
    const logs = await space.fetchAuditLogs({ type: 'member_ban_add', limit: 10 });
    expect(api.last().query.get('action')).toBe('member_ban_add');
    const entry = logs.entries.first()!;
    expect(entry.executor?.username).toBe('owner');
    expect(entry.changes).toEqual([{ key: 'reason', new: 'spam' }]);
    expect(entry.toJSON()).toMatchObject({ action: 'member_ban_add', spaceId: SPACE_ID });
  });

  it('moves and deletes roles, adds members with OAuth2, lists invites', async () => {
    const { api, space } = setup();
    api.on('PATCH /spaces/:id/roles', [role(MOD_ROLE_ID, 1, 64), role('3000000000000000003', 2, 64, { bot_id: BOT_ID })]);
    api.on('DELETE /spaces/:id/roles/:id', undefined);
    api.on('PUT /spaces/:id/members/:id', { space_id: SPACE_ID, user_id: '650' });
    api.on('GET /spaces/:id/members/:id', { id: '650', username: 'joined', roles: [], joined_at: now, nick: null });
    api.on('GET /spaces/:id/invites', [{ code: 'aa', space_id: SPACE_ID, inviter_id: OWNER_ID, max_uses: 0, current_uses: 3, created_at: now }]);
    api.on('DELETE /spaces/:id/invites/:code', undefined);
    await space.roles.setPositions([{ role: MOD_ROLE_ID, position: 1 }]);
    expect(api.last().body).toEqual([{ id: MOD_ROLE_ID, position: 1 }]);
    expect(space.roles.cache.get(MOD_ROLE_ID)!.position).toBe(1);
    await space.roles.cache.get(MOD_ROLE_ID)!.delete();
    expect(space.roles.cache.has(MOD_ROLE_ID)).toBe(false);
    const member = await space.members.add('650', { accessToken: 'oauth-token' });
    expect(api.calls.find((c) => c.method === 'PUT')!.body).toEqual({ access_token: 'oauth-token' });
    expect(member.user.username).toBe('joined');
    const invites = await space.invites.fetch();
    const invite = invites.get('aa')!;
    expect(invite.maxAge).toBe(0);
    expect(invite.uses).toBe(3);
    await invite.delete();
    expect(space.invites.cache.has('aa')).toBe(false);
    expect(space.roles.cache.get(EVERYONE_ID)).toBeDefined();
  });

  it('pages archived threads and manages group PMs', async () => {
    const { api, client } = setup();
    api.on('GET /rooms/:id/threads/archived', {
      threads: [spaceRoom('4000000000000000050', RoomType.Thread, { parent_id: TEXT_ID, thread: { archived: true, locked: false, private: false, invitable: true, auto_archive_minutes: 60, owner_id: OWNER_ID, archived_at: now } })],
      has_more: true,
    });
    api.on('PATCH /rooms/:id', { id: GROUP_ID, type: 2, recipients: [BOT_ID, OWNER_ID], created_at: now, name: 'renamed' });
    api.on('DELETE /rooms/:id/participants/:id', undefined);
    const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const page = await room.threads.fetchArchived({ before: 0, limit: 5 });
    expect(page.hasMore).toBe(true);
    expect(page.threads.first()?.archived).toBe(true);
    expect(api.last().query.get('before')).toBe('1970-01-01T00:00:00.000Z');
    const group = client.rooms.cache.get(GROUP_ID) as GroupPMRoom;
    await group.setName('renamed');
    expect(group.name).toBe('renamed');
    expect([...group.recipients.keys()]).toEqual([BOT_ID, OWNER_ID]);
    await group.leave();
    expect(api.last().path).toBe(`/rooms/${GROUP_ID}/participants/${BOT_ID}`);
    expect(client.rooms.cache.has(GROUP_ID)).toBe(false);
  });

  it('edits the client user and uploads its avatar', async () => {
    const { api, client } = setup();
    api.on('PATCH /users/@me', (call: { body: Record<string, string> }) => ({ id: BOT_ID, username: 'helper', display_name: call.body.display_name ?? 'Helper', accent_color: call.body.accent_color ?? '' }));
    api.on('POST /users/@me/avatar', { id: BOT_ID, username: 'helper', avatar: 'https://cdn/avatar.png' });
    await client.user.edit({ displayName: 'Assistant', accentColor: 'Red', avatar: new Blob(['png'], { type: 'image/png' }) });
    expect(api.calls[0]!.body).toEqual({ display_name: 'Assistant', accent_color: '#ed4245' });
    expect((api.calls[1]!.form?.get('file') as File).type).toBe('image/png');
    expect(client.user.displayName).toBe('Assistant');
    expect(client.user.accentColor).toBe(0xed4245);
    expect(client.user.avatarURL()).toBe('https://cdn/avatar.png');
    await client.user.setAvatar(null);
    expect(api.last().body).toEqual({ avatar: '' });
  });
});

describe('file resolution', () => {
  it('reads file: URLs, downloads http(s) URLs and guesses types', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'strafejs-'));
    try {
      const path = join(dir, 'my note.txt');
      writeFileSync(path, 'hello');
      const file = await resolveFile(pathToFileURL(path));
      expect(file.name).toBe('my note.txt');
      expect(file.contentType).toBe('text/plain');
      expect(await (file.data as Blob).text()).toBe('hello');
      await expect(resolveFile(pathToFileURL(join(dir, 'missing.txt')))).rejects.toMatchObject({ code: 'FileInvalid' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const fetch = async () => new Response(new Blob(['img'], { type: 'image/webp' }));
    const remote = await resolveFile('https://x.test/pics/cat.webp?size=1', undefined, fetch);
    expect(remote.name).toBe('cat.webp');
    expect(remote.contentType).toBe('image/webp');
    await expect(resolveFile('https://x.test/a.png', undefined, async () => new Response('', { status: 404 }))).rejects.toMatchObject({ code: 'FileInvalid' });
    expect(contentTypeFor('A.JPG')).toBe('image/jpeg');
    expect(contentTypeFor('noext')).toBeUndefined();
    expect((await resolveFile(new Uint8Array([1]))).name).toBe('file.bin');
  });

  it('never reads a string as a local path: it may be user input (files: [args[0]])', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'strafejs-'));
    try {
      const secret = join(dir, '.env');
      writeFileSync(secret, 'STRAFE_TOKEN=secret');
      for (const input of [secret, pathToFileURL(secret).href, '/proc/self/environ', './.env', 'C:\\bot\\.env', 'ftp://x.test/a']) {
        await expect(resolveFile(input), input).rejects.toMatchObject({ name: 'StrafeTypeError [FileInvalid]', code: 'FileInvalid' });
      }
      await expect(resolveFile(new URL('data:text/plain,hi'))).rejects.toMatchObject({ code: 'FileInvalid' });
      // The explicit form still works.
      expect(await ((await resolveFile(pathToFileURL(secret))).data as Blob).text()).toBe('STRAFE_TOKEN=secret');

      // '!img /proc/self/environ' -> message.reply({ files: [args[0]] }) posts nothing.
      const { api, space } = setup();
      api.on('POST /rooms/:id/attachments', { id: '1', url: 'https://cdn/x', filename: 'x' });
      api.on('POST /rooms/:id/messages', {});
      const room = space.rooms.cache.get(TEXT_ID) as TextRoom;
      await expect(room.send({ files: [secret] })).rejects.toMatchObject({ code: 'FileInvalid' });
      await expect(room.send({ files: [{ attachment: '/proc/self/environ', name: 'env.txt' }] })).rejects.toMatchObject({ code: 'FileInvalid' });
      await expect(space.setIcon(secret)).rejects.toMatchObject({ code: 'FileInvalid' });
      expect(api.calls).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

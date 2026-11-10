import { describe, expect, it } from 'vitest';
import { ClientUser } from '../src/structures/ClientUser.js';
import { Message } from '../src/structures/Message.js';
import { OverwriteType } from '../src/structures/PermissionOverwrites.js';
import { GroupPMRoom } from '../src/structures/rooms/GroupPMRoom.js';
import { PMRoom } from '../src/structures/rooms/PMRoom.js';
import { SectionRoom } from '../src/structures/rooms/SectionRoom.js';
import { TextRoom } from '../src/structures/rooms/TextRoom.js';
import { ThreadRoom } from '../src/structures/rooms/ThreadRoom.js';
import { VoiceRoom } from '../src/structures/rooms/VoiceRoom.js';
import { RoomType } from '../src/types/api/room.js';
import { PermissionFlagsBits as P, PermissionsBitField } from '../src/util/PermissionsBitField.js';
import {
  BOT_ID,
  BOT_ROLE_ID,
  ENCRYPTED_ID,
  EVERYONE_ID,
  GROUP_ID,
  MOD_ROLE_ID,
  OWNER_ID,
  PM_ID,
  SECRET_ID,
  SECTION_ID,
  SPACE_ID,
  TEXT_ID,
  THREAD_ID,
  VOICE_ID,
  message,
  setup,
} from './helpers.js';

describe('caches and room classes', () => {
  it('builds each room type and shares space rooms with client.rooms', () => {
    const { client, space } = setup();
    expect(client.rooms.cache.get(SECTION_ID)).toBeInstanceOf(SectionRoom);
    expect(client.rooms.cache.get(TEXT_ID)).toBeInstanceOf(TextRoom);
    expect(client.rooms.cache.get(VOICE_ID)).toBeInstanceOf(VoiceRoom);
    expect(client.rooms.cache.get(THREAD_ID)).toBeInstanceOf(ThreadRoom);
    expect(client.rooms.cache.get(PM_ID)).toBeInstanceOf(PMRoom);
    expect(client.rooms.cache.get(GROUP_ID)).toBeInstanceOf(GroupPMRoom);
    expect(space.rooms.cache.get(TEXT_ID)).toBe(client.rooms.cache.get(TEXT_ID));
    expect(space.rooms.cache.has(PM_ID)).toBe(false);

    const text = space.rooms.cache.get(TEXT_ID) as TextRoom;
    expect(text.parent?.id).toBe(SECTION_ID);
    expect(text.topic).toBe('hello');
    expect(text.toString()).toBe(`<#${TEXT_ID}>`);
    expect(text.url).toBe(`https://chat.example/spaces/${SPACE_ID}/rooms/${TEXT_ID}`);
    expect((space.rooms.cache.get(SECTION_ID) as SectionRoom).children.map((r) => r.id).sort()).toEqual([TEXT_ID, VOICE_ID].sort());
    expect(space.rooms.sorted.map((r) => r.id)).toEqual([SECRET_ID, ENCRYPTED_ID, SECTION_ID, TEXT_ID, VOICE_ID]);
    expect(space.systemRoom).toBe(text);
    expect((space.rooms.cache.get(THREAD_ID) as ThreadRoom).parent?.id).toBe(SECRET_ID);
  });

  it('narrows with the type guards and knows what is encrypted', () => {
    const { client } = setup();
    const pm = client.rooms.cache.get(PM_ID)!;
    const group = client.rooms.cache.get(GROUP_ID)!;
    const encrypted = client.rooms.cache.get(ENCRYPTED_ID)!;
    const section = client.rooms.cache.get(SECTION_ID)!;
    expect(pm.isPMBased() && pm.isEncrypted()).toBe(true);
    expect(group.isEncrypted()).toBe(false);
    expect(group.isSendable()).toBe(true);
    expect(encrypted.isEncrypted() && !encrypted.isSendable()).toBe(true);
    expect(section.isTextBased()).toBe(false);
    expect(client.rooms.cache.get(VOICE_ID)!.isVoiceBased()).toBe(true);
    expect(client.rooms.cache.get(THREAD_ID)!.isThread()).toBe(true);
    if (pm.isPM()) expect(pm.recipient?.id).toBe(OWNER_ID);
    expect(client.users.cache.get(OWNER_ID)?.pmRoom?.id).toBe(PM_ID);
  });

  it('merges light READY rooms and partial room updates into the cached room', () => {
    const { client } = setup();
    const text = client.rooms.cache.get(TEXT_ID) as TextRoom;
    client.rooms._add({ id: TEXT_ID, type: RoomType.SpaceText, space_id: SPACE_ID, last_message_id: '9', recipients: [], created_at: '' });
    expect(client.rooms.cache.get(TEXT_ID)).toBe(text);
    expect(text.lastMessageId).toBe('9');
    expect(text.topic).toBe('hello');
    expect(text.parentId).toBe(SECTION_ID);
    client.rooms._add({ id: TEXT_ID, room_id: TEXT_ID, name: 'renamed', slowmode_seconds: 5, parent_id: null });
    expect(text.name).toBe('renamed');
    expect(text.rateLimitPerUser).toBe(5);
    expect(text.parent).toBeNull();
  });

  it('removes a space with its rooms, and a room with its threads', () => {
    const { client, space } = setup();
    client.rooms._remove(SECRET_ID);
    expect(client.rooms.cache.has(THREAD_ID)).toBe(false);
    client.spaces._remove(space.id);
    expect(client.rooms.cache.has(TEXT_ID)).toBe(false);
    expect(client.rooms.cache.has(PM_ID)).toBe(true);
  });
});

describe('users', () => {
  it('builds handles for local and remote users', () => {
    const { client } = setup();
    client.federationDomain = 'chat.example';
    const local = client.users._add({ id: '7', username: 'ana', display_name: '', home_domain: 'chat.example' });
    const remote = client.users._add({ id: '8', username: 'bo', display_name: 'Bo', home_domain: 'other.example', origin_id: '42' });
    expect(local.tag).toBe('ana');
    expect(local.displayName).toBe('ana');
    expect(local.isRemote).toBe(false);
    expect(remote.tag).toBe('bo@other.example');
    expect(remote.isRemote).toBe(true);
    expect(remote.displayName).toBe('Bo');
    expect(remote.toString()).toBe('<@8>');
    const partial = client.users._add({ id: '9' });
    expect(partial.partial).toBe(true);
    client.users._add({ id: '9', username: 'cy' });
    expect(partial.partial).toBe(false);
  });

  it('patches the client user in place and refuses PMs', async () => {
    const { client } = setup();
    expect(client.user).toBeInstanceOf(ClientUser);
    expect(client.users._add({ id: BOT_ID, display_name: 'New' })).toBe(client.user);
    expect(client.user.displayName).toBe('New');
    expect(client.user.createdAt.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    await expect(client.users.cache.get(OWNER_ID)!.send('hi')).rejects.toMatchObject({ code: 'PMsEncrypted' });
    await expect(client.users.fetch('12345')).rejects.toMatchObject({ code: 'NotFound' });
  });
});

describe('messages', () => {
  it('reads plain, encrypted, edited, reply and system messages', () => {
    const { client } = setup();
    const text = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const reply = text.messages._add(
      message('11', {
        plaintext: `hi <@${BOT_ID}> and <@&${MOD_ROLE_ID}> in <#${TEXT_ID}> @everyone`,
        updated_at: '2026-11-09T10:05:00Z',
        reply_to_id: '10',
        referenced_message: { ...message('10', { plaintext: 'original', sender_id: BOT_ID }), author: undefined } as never,
        mentions: [BOT_ID],
        mention_roles: [MOD_ROLE_ID],
        mention_everyone: true,
        attachments: [{ id: '20', filename: 'a.png', size: 3, url: 'https://cdn/a.png', width: 1, height: 1 }],
        embeds: [{ type: 'rich', title: 'x', image: { url: 'https://e/i.png', proxy_url: '/media/v1/sig/src' } }],
        reactions: [{ emoji: '👍', count: 2, me: true }, { emoji: 'custom:555', count: 1, me: false }],
      }),
    );
    expect(reply).toBeInstanceOf(Message);
    expect(reply.inSpace()).toBe(true);
    expect(reply.space.id).toBe(SPACE_ID);
    expect(reply.author.username).toBe('owner');
    expect(reply.member?.id).toBe(OWNER_ID);
    expect(reply.editedAt?.toISOString()).toBe('2026-11-09T10:05:00.000Z');
    expect(reply.reference).toEqual({ messageId: '10', roomId: TEXT_ID, spaceId: SPACE_ID });
    expect(text.messages.cache.get('10')?.content).toBe('original');
    expect(reply.mentions.has(BOT_ID)).toBe(true);
    expect(reply.mentions.has(client.user)).toBe(true);
    expect(reply.mentions.repliedUser?.id).toBe(BOT_ID);
    expect(reply.mentions.roles.first()?.name).toBe('Mods');
    expect(reply.mentions.rooms.has(TEXT_ID)).toBe(true);
    expect(reply.cleanContent).toBe('hi @Helper and @Mods in #chat @​everyone');
    expect(reply.attachments.get('20')?.name).toBe('a.png');
    expect(reply.embeds[0]?.image?.proxyURL).toBe('https://chat.example/api/media/v1/sig/src');
    expect(reply.reactions.cache.get('👍')?.count).toBe(2);
    expect(reply.reactions.cache.get('555')?.identifier).toBe('custom:555');
    expect(reply.reactions.cache.get('👍')?.me).toBe(true);
    expect(reply.editable).toBe(false);
    expect(reply.deletable).toBe(true); // bot role has Manage Messages
    expect(text.messages.cache.get('10')!.editable).toBe(true);

    const encrypted = (client.rooms.cache.get(ENCRYPTED_ID) as TextRoom).messages._add(
      { ...message('12', { room_id: ENCRYPTED_ID, ciphertext: 'abc' }), plaintext: undefined } as never,
    );
    expect(encrypted.encrypted).toBe(true);
    expect(encrypted.content).toBeNull();
    expect(encrypted.cleanContent).toBeNull();

    const notice = text.messages._add({
      id: '13',
      room_id: TEXT_ID,
      sender_id: '0',
      system_type: 'space_member_join',
      system_payload: JSON.stringify({ user_id: OWNER_ID }),
      created_at: '2026-11-09T10:00:00Z',
      updated_at: '2026-11-09T10:00:00Z',
    } as never);
    expect(notice.system).toBe(true);
    expect(notice.systemData).toEqual({ type: 'space_member_join', data: { user_id: OWNER_ID } });
    expect(notice.author.system).toBe(true);
    expect(notice.content).toBe('');

    const partial = text.messages._add({ id: '14', room_id: TEXT_ID }, false);
    expect(partial.partial).toBe(true);
    expect(partial.author).toBeNull();
  });

  it('keeps old copies for update events', () => {
    const { client } = setup();
    const text = client.rooms.cache.get(TEXT_ID) as TextRoom;
    const first = text.messages._add(message('15'));
    const old = first._update(message('15', { plaintext: 'edited', updated_at: '2026-11-09T11:00:00Z' }));
    expect(old.content).toBe('hello');
    expect(first.content).toBe('edited');
    expect(old.id).toBe(first.id);
  });
});

describe('members, roles and permissions', () => {
  it('reads REST and gateway member forms', () => {
    const { client, space } = setup();
    const member = space.members._add({
      id: '77',
      username: 'cara',
      display_name: 'Cara',
      roles: [MOD_ROLE_ID],
      joined_at: '2026-01-01T00:00:00Z',
      nick: 'C',
      space_avatar: 'https://cdn/sa.png',
      avatar: 'https://cdn/a.png',
    });
    expect(member.displayName).toBe('C');
    expect(member.displayAvatarURL()).toBe('https://cdn/sa.png');
    expect(member.user.displayAvatarURL()).toBe('https://cdn/a.png');
    expect(member.roles.highest.id).toBe(MOD_ROLE_ID);
    expect(member.roles.hoist?.id).toBe(MOD_ROLE_ID);
    expect(member.displayHexColor).toBe('#ff0000');
    expect(member.roles.cache.has(EVERYONE_ID)).toBe(true);
    space.members._add({ space_id: SPACE_ID, user_id: '77', role_ids: [], nick: null, space_avatar: null, space_banner: null, space_about_me: null, space_bio: null, space_pronouns: null });
    expect(member.displayName).toBe('Cara');
    expect(member.roles.highest.id).toBe(EVERYONE_ID);
    expect(client.users.cache.get('77')?.username).toBe('cara');
    expect(space.roles.highest?.id).toBe(MOD_ROLE_ID);
    expect(space.roles.everyone?.toString()).toBe('@everyone');
    expect(space.roles.botRoleFor(BOT_ID)?.managed).toBe(true);
    expect(space.roles.cache.get(MOD_ROLE_ID)!.members.size).toBe(0);
  });

  it('resolves permissions like the server', () => {
    const { space } = setup();
    const bot = space.members.me!;
    const owner = space.members.cache.get(OWNER_ID)!;
    const mod = space.members._add({ id: '78', username: 'mod', roles: [MOD_ROLE_ID], joined_at: '2026-01-01T00:00:00Z' });

    expect(owner.permissions.bitfield).toBe(PermissionsBitField.All);
    expect(bot.permissions.has(P.ManageMessages)).toBe(true);
    expect(bot.permissions.has(P.KickMembers)).toBe(false);

    // The text room is synced with its section, which denies Send Messages to @everyone.
    const inText = bot.permissionsIn(TEXT_ID);
    expect(inText.has(P.ViewRoom)).toBe(true);
    expect(inText.has(P.SendMessages)).toBe(false);
    expect(inText.has(P.AttachFiles)).toBe(false); // implicit: no Send Messages, no Attach Files
    expect(inText.has(P.ManageMessages)).toBe(true);
    // The voice room is in the section but not synced: its own (empty) overrides apply.
    expect(bot.permissionsIn(VOICE_ID).has(P.SendMessages)).toBe(true);
    // The mods room hides itself from @everyone and shows itself to Mods.
    expect(bot.permissionsIn(SECRET_ID).bitfield).toBe(0n);
    expect(mod.permissionsIn(SECRET_ID).has(P.ViewRoom)).toBe(true);
    // Threads inherit their room.
    expect(bot.permissionsIn(THREAD_ID).bitfield).toBe(0n);
    expect(mod.permissionsIn(THREAD_ID).has(P.ViewRoom)).toBe(true);
    // The owner holds every room permission, cached or not.
    expect(space.rooms.cache.get(SECRET_ID)!.permissionsFor(OWNER_ID)?.bitfield).toBe(PermissionsBitField.AllRoom);
    // A role on its own.
    expect(space.rooms.cache.get(SECRET_ID)!.permissionsFor(space.roles.cache.get(MOD_ROLE_ID)!)?.has(P.ViewRoom)).toBe(true);
    expect(space.rooms.cache.get(SECRET_ID)!.permissionsFor('999')).toBeNull();
    // Visible members of a room.
    expect([...(space.rooms.cache.get(SECRET_ID) as TextRoom).members.keys()].sort()).toEqual(['78', OWNER_ID].sort());

    // Private threads: only members and Manage Threads.
    const thread = space.rooms.cache.get(THREAD_ID) as ThreadRoom;
    thread._patch({ id: THREAD_ID, thread: { private: true } } as never);
    expect(mod.permissionsIn(THREAD_ID).bitfield).toBe(0n);
    thread.members._add({ user_id: '78', joined_at: '2026-01-01T00:00:00Z' });
    expect(mod.permissionsIn(THREAD_ID).has(P.ViewRoom)).toBe(true);
  });

  it('applies hierarchy for manageable, kickable and bannable', () => {
    const { space } = setup();
    const target = space.members._add({ id: '79', username: 't', roles: [], joined_at: '2026-01-01T00:00:00Z' });
    const owner = space.members.cache.get(OWNER_ID)!;
    expect(target.manageable).toBe(true); // bot role (1) above @everyone (0)
    expect(target.kickable).toBe(false); // no Kick Members
    space.members.me!._roles = [BOT_ROLE_ID, MOD_ROLE_ID];
    expect(target.kickable).toBe(true);
    expect(target.bannable).toBe(true);
    expect(owner.manageable).toBe(false);
    const peer = space.members._add({ id: '80', username: 'p', roles: [MOD_ROLE_ID], joined_at: '2026-01-01T00:00:00Z' });
    expect(peer.manageable).toBe(false); // same highest role
    expect(space.roles.cache.get(BOT_ROLE_ID)!.editable).toBe(true);
    expect(space.roles.cache.get(MOD_ROLE_ID)!.editable).toBe(false);
  });

  it('caches overrides with their type', () => {
    const { space } = setup();
    const secret = space.rooms.cache.get(SECRET_ID) as TextRoom;
    const everyone = secret.permissionOverwrites.cache.get(EVERYONE_ID)!;
    expect(everyone.type).toBe(OverwriteType.Role);
    expect(everyone.deny.has(P.ViewRoom)).toBe(true);
    secret._patch({ id: SECRET_ID, user_overrides: [{ user_id: BOT_ID, allow: 1, deny: 0, created_at: '', updated_at: '' }] });
    expect(secret.permissionOverwrites.cache.get(BOT_ID)?.type).toBe(OverwriteType.Member);
    expect(space.members.me!.permissionsIn(SECRET_ID).has(P.ViewRoom)).toBe(true);
  });
});

describe('toJSON', () => {
  it('serializes structures without the client', () => {
    const { client, space } = setup();
    const json = space.toJSON();
    expect(json.id).toBe(SPACE_ID);
    expect(json.client).toBeUndefined();
    expect(json.roles).toContain(MOD_ROLE_ID);
    expect(JSON.stringify(client)).not.toContain('test-token');
    expect(JSON.stringify(client.rooms.cache.get(TEXT_ID))).toContain('"name":"chat"');
  });
});

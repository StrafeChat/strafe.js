import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../src/client/Client.js';
import { Events } from '../../src/client/ClientEvents.js';
import type { ClientEvents } from '../../src/client/ClientEvents.js';
import { RoomType } from '../../src/types/api/room.js';
import { Options } from '../../src/util/Options.js';
import { PermissionFlagsBits as P } from '../../src/util/PermissionsBitField.js';
import {
  BOT_ID,
  ENCRYPTED_ID,
  EVERYONE_ID,
  GROUP_ID,
  MOD_ROLE_ID,
  OWNER_ID,
  SECRET_ID,
  SECTION_ID,
  SPACE_ID,
  TEXT_ID,
  THREAD_ID,
  VOICE_ID,
  apiSpace,
  message,
  role,
  spaceRoom,
} from '../helpers.js';
import { dispatch, flush, loggedIn } from './helpers.js';

const now = '2026-11-09T11:00:00Z';
const USER_ID = '1000000000000000003';

const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.destroy();
});

async function start() {
  const value = await loggedIn();
  clients.push(value.client);
  const { client, socket } = value;
  /** Records the arguments of each emission of `event`. */
  function record<E extends keyof ClientEvents>(event: E): ClientEvents[E][] {
    const calls: ClientEvents[E][] = [];
    client.on(event, (...args) => calls.push(args));
    return calls;
  }
  /** Sends a dispatch in the room or space and lets the handlers run. */
  async function send(t: string, d: unknown, envelope: Record<string, unknown> = {}): Promise<void> {
    dispatch(socket, t, d, envelope);
    await flush();
  }
  return { ...value, record, send };
}

function memberAdd(id: string, roleIds: string[] = []) {
  return {
    id,
    space_id: SPACE_ID,
    username: `user${id.slice(-1)}`,
    display_name: 'Someone',
    avatar: '',
    banner: '',
    bio: '',
    about_me: '',
    pronouns: '',
    bot: false,
    public_flags: 0,
    role_ids: roleIds,
    joined_at: now,
    nick: null,
    space_avatar: null,
    space_banner: null,
    space_about_me: null,
    space_bio: null,
    space_pronouns: null,
  };
}

describe('messages', () => {
  it('MESSAGE_CREATE caches the message, updates the room and emits messageCreate', async () => {
    const { client, record, send } = await start();
    const created = record(Events.MessageCreate);
    await send('MESSAGE_CREATE', { ...message('700'), space_id: SPACE_ID }, { room_id: TEXT_ID, space_id: SPACE_ID });
    const [msg] = created[0] ?? [];
    expect(msg?.content).toBe('hello');
    expect(msg?.author.id).toBe(OWNER_ID);
    expect(msg?.inSpace()).toBe(true);
    expect(msg?.space?.id).toBe(SPACE_ID);
    const room = client.rooms.cache.get(TEXT_ID);
    expect(room?.isTextRoom() && room.messages.cache.get('700')).toBe(msg);
    expect(room?.isTextRoom() && room.lastMessageId).toBe('700');
  });

  it('emits encrypted messages with null content, and reduced system notices', async () => {
    const { record, send } = await start();
    const created = record(Events.MessageCreate);
    // The server leaves plaintext out of encrypted messages.
    const { plaintext: _plaintext, ...encryptedData } = message('701', { room_id: ENCRYPTED_ID, ciphertext: 'b64' });
    await send('MESSAGE_CREATE', encryptedData, { room_id: ENCRYPTED_ID, space_id: SPACE_ID });
    await send(
      'MESSAGE_CREATE',
      { room_id: TEXT_ID, space_id: SPACE_ID, id: '702', sender_id: '0', system_type: 'space_member_join', system_payload: JSON.stringify({ user_id: USER_ID }), created_at: now, updated_at: now },
      { room_id: TEXT_ID, space_id: SPACE_ID },
    );
    const [encrypted] = created[0] ?? [];
    expect(encrypted?.encrypted).toBe(true);
    expect(encrypted?.content).toBeNull();
    const [notice] = created[1] ?? [];
    expect(notice?.system).toBe(true);
    expect(notice?.systemData?.type).toBe('space_member_join');
  });

  it('fetches a room it does not know before emitting, and keeps events in order', async () => {
    const { client, api, record, send } = await start();
    const NEW_ID = '4000000000000000020';
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.on(`GET /rooms/${NEW_ID}`, async () => {
      await gate;
      return { id: NEW_ID, type: RoomType.SpaceText, space_id: SPACE_ID, name: 'late', created_at: now, recipients: [], e2ee_enabled: false };
    });
    const created = record(Events.MessageCreate);
    await send('MESSAGE_CREATE', message('710', { room_id: NEW_ID }), { room_id: NEW_ID, space_id: SPACE_ID });
    await send('MESSAGE_CREATE', message('711'), { room_id: TEXT_ID, space_id: SPACE_ID });
    expect(created).toHaveLength(0);
    release();
    await vi.waitFor(() => {
      expect(created).toHaveLength(2);
    });
    expect(created.map(([msg]) => msg.id)).toEqual(['710', '711']);
    const late = client.rooms.cache.get(NEW_ID);
    expect(late?.isSpaceBased() && late.space.id).toBe(SPACE_ID);
  });

  it('drops events for rooms it cannot fetch, with a debug line', async () => {
    const { client, record, send } = await start();
    const created = record(Events.MessageCreate);
    const debug = vi.fn();
    client.on(Events.Debug, debug);
    await send('MESSAGE_CREATE', message('712', { room_id: '4000000000000000099' }), { room_id: '4000000000000000099' });
    await vi.waitFor(() => {
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/Dropped an event for room 4000000000000000099/));
    });
    expect(created).toHaveLength(0);
  });

  it('MESSAGE_UPDATE gives the cached copy before the edit, or a partial message', async () => {
    const { record, send } = await start();
    const updated = record(Events.MessageUpdate);
    const env = { room_id: TEXT_ID, space_id: SPACE_ID };
    await send('MESSAGE_CREATE', message('720'), env);
    await send('MESSAGE_UPDATE', message('720', { plaintext: 'edited', updated_at: '2026-11-09T12:00:00Z' }), env);
    await send('MESSAGE_UPDATE', message('721', { plaintext: 'never seen' }), env);
    const [old, current] = updated[0] ?? [];
    expect(old?.content).toBe('hello');
    expect(current?.content).toBe('edited');
    expect(old).not.toBe(current);
    const [partial, fresh] = updated[1] ?? [];
    expect(partial?.partial).toBe(true);
    expect(fresh?.content).toBe('never seen');
  });

  it('MESSAGE_DELETE emits the cached message or a partial one and updates the room', async () => {
    const { client, record, send } = await start();
    const deleted = record(Events.MessageDelete);
    const env = { room_id: TEXT_ID, space_id: SPACE_ID };
    await send('MESSAGE_CREATE', message('730'), env);
    await send('MESSAGE_DELETE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '730', last_message_id: '99' }, env);
    await send('MESSAGE_DELETE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '731' }, env);
    expect(deleted[0]?.[0].content).toBe('hello');
    expect(deleted[1]?.[0].partial).toBe(true);
    expect(deleted[1]?.[0].id).toBe('731');
    const room = client.rooms.cache.get(TEXT_ID);
    expect(room?.isTextRoom() && room.messages.cache.has('730')).toBe(false);
    expect(room?.isTextRoom() && room.lastMessageId).toBe('99');
  });

  it('reactions work on cached and uncached messages', async () => {
    const { record, send } = await start();
    const added = record(Events.MessageReactionAdd);
    const removed = record(Events.MessageReactionRemove);
    const env = { room_id: TEXT_ID, space_id: SPACE_ID };
    await send('MESSAGE_CREATE', message('740'), env);
    await send('MESSAGE_REACTION_ADD', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '740', user_id: OWNER_ID, emoji: '👍' }, env);
    await send('MESSAGE_REACTION_ADD', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '740', user_id: BOT_ID, emoji: '👍' }, env);
    const [reaction, user] = added[1] ?? [];
    expect(reaction?.count).toBe(2);
    expect(reaction?.me).toBe(true);
    expect(user?.id).toBe(BOT_ID);
    expect(reaction?.emoji.name).toBe('👍');

    await send('MESSAGE_REACTION_REMOVE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '740', user_id: OWNER_ID, emoji: '👍' }, env);
    await send('MESSAGE_REACTION_REMOVE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '740', user_id: BOT_ID, emoji: '👍' }, env);
    expect(removed).toHaveLength(2);
    expect(removed[1]?.[0].count).toBe(0);
    expect(removed[1]?.[0].message.reactions.cache.size).toBe(0);

    // A reaction on a message from before the bot started: partial message, unknown count.
    await send('MESSAGE_REACTION_ADD', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '1', user_id: OWNER_ID, emoji: 'custom:3000000000000000077' }, env);
    const [partial] = added[2] ?? [];
    expect(partial?.message.partial).toBe(true);
    expect(partial?.partial).toBe(true);
    expect(partial?.emoji.id).toBe('3000000000000000077');
  });

  it("the bot's own reaction is counted once, whether the REST answer or the event comes first", async () => {
    const { api, client, send } = await start();
    const env = { room_id: TEXT_ID, space_id: SPACE_ID };
    const own = { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '741', user_id: BOT_ID, emoji: '👍' };
    await send('MESSAGE_CREATE', message('741', { reactions: [{ emoji: '👍', count: 2, me: false }] }), env);
    const room = client.rooms.cache.get(TEXT_ID);
    if (!room?.isTextRoom()) throw new Error('no room');
    const msg = room.messages.cache.get('741')!;

    // REST answer first (it already counts the bot), then the bot's own MESSAGE_REACTION_ADD.
    api.on('PUT /rooms/:id/messages/:id/reactions/:emoji', { reactions: [{ emoji: '👍', count: 3, me: true }] });
    const reaction = await msg.react('👍');
    expect(reaction.count).toBe(3);
    await send('MESSAGE_REACTION_ADD', own, env);
    expect(reaction).toMatchObject({ count: 3, me: true });

    // Removing: REST says 2 (others still react), then the bot's MESSAGE_REACTION_REMOVE.
    api.on('DELETE /rooms/:id/messages/:id/reactions/:emoji', { reactions: [{ emoji: '👍', count: 2, me: false }] });
    await reaction.remove();
    await send('MESSAGE_REACTION_REMOVE', own, env);
    expect(msg.reactions.cache.get('👍')).toMatchObject({ count: 2, me: false });
    // The server also sends a remove for a reaction that was never there.
    await send('MESSAGE_REACTION_REMOVE', own, env);
    expect(msg.reactions.cache.get('👍')?.count).toBe(2);

    // Event first, then the REST answer.
    await send('MESSAGE_REACTION_ADD', own, env);
    expect(msg.reactions.cache.get('👍')).toMatchObject({ count: 3, me: true });
    await msg.react('👍');
    expect(msg.reactions.cache.get('👍')).toMatchObject({ count: 3, me: true });

    // A user the reaction already lists is not counted again.
    await send('MESSAGE_REACTION_ADD', { ...own, user_id: OWNER_ID }, env);
    await send('MESSAGE_REACTION_ADD', { ...own, user_id: OWNER_ID }, env);
    expect(msg.reactions.cache.get('👍')?.count).toBe(4);
  });

  it('reaction users are cached through makeCache (ReactionUserManager limit)', async () => {
    const value = await loggedIn({ makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, ReactionUserManager: 0 }) });
    clients.push(value.client);
    const { api, client, socket } = value;
    const env = { room_id: TEXT_ID, space_id: SPACE_ID };
    dispatch(socket, 'MESSAGE_CREATE', message('742'), env);
    dispatch(socket, 'MESSAGE_REACTION_ADD', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '742', user_id: OWNER_ID, emoji: '👍' }, env);
    await flush();
    const room = client.rooms.cache.get(TEXT_ID);
    if (!room?.isTextRoom()) throw new Error('no room');
    const reaction = room.messages.cache.get('742')!.reactions.cache.get('👍')!;
    expect(reaction.count).toBe(1);
    expect(reaction.users.cache.size).toBe(0);
    // A fetch still returns everyone, and `me` comes from the answer, not the (empty) cache.
    api.on('GET /rooms/:id/messages/:id/reactions/:emoji', [
      { id: OWNER_ID, username: 'owner' },
      { id: BOT_ID, username: 'helper' },
    ]);
    const users = await reaction.users.fetch();
    expect([...users.keys()]).toEqual([OWNER_ID, BOT_ID]);
    expect(reaction.users.cache.size).toBe(0);
    expect(reaction).toMatchObject({ count: 2, me: true });
  });

  it('ROOM_PINS_UPDATE marks the cached message and emits roomPinsUpdate', async () => {
    const { record, send, client } = await start();
    const pins = record(Events.RoomPinsUpdate);
    const env = { room_id: TEXT_ID, space_id: SPACE_ID };
    await send('MESSAGE_CREATE', message('750'), env);
    await send('ROOM_PINS_UPDATE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '750', user_id: OWNER_ID, pinned: true, pinned_at: now, last_pin_timestamp: now }, env);
    const [room, date, details] = pins[0] ?? [];
    expect(room?.id).toBe(TEXT_ID);
    expect(date?.toISOString()).toBe('2026-11-09T11:00:00.000Z');
    expect(details).toEqual({ messageId: '750', pinned: true, userId: OWNER_ID });
    const text = client.rooms.cache.get(TEXT_ID);
    const msg = text?.isTextRoom() ? text.messages.cache.get('750') : undefined;
    expect(msg?.pinned).toBe(true);
    expect(msg?.pinnedById).toBe(OWNER_ID);
  });

  it('TYPING_START emits a Typing', async () => {
    const { record, send } = await start();
    const typing = record(Events.TypingStart);
    await send('TYPING_START', { room_id: TEXT_ID, space_id: SPACE_ID, user_id: OWNER_ID, timestamp: 1_790_000_000 }, { room_id: TEXT_ID, space_id: SPACE_ID });
    const [entry] = typing[0] ?? [];
    expect(entry?.room.id).toBe(TEXT_ID);
    expect(entry?.user.id).toBe(OWNER_ID);
    expect(entry?.startedTimestamp).toBe(1_790_000_000_000);
  });

  it('only emits raw for events without a client event', async () => {
    const { client, send } = await start();
    const raw = vi.fn();
    const any = vi.fn();
    client.on(Events.Raw, raw);
    for (const event of [Events.MessageCreate, Events.RoomUpdate, Events.UserUpdate]) client.on(event, any);
    await send('MESSAGE_ACK', { room_id: TEXT_ID, message_id: '1', last_read_message_id: '1' }, { user_id: BOT_ID });
    await send('TO_DEVICE', { sender: 'x' }, { user_id: BOT_ID });
    expect(raw).toHaveBeenCalledTimes(2);
    expect(any).not.toHaveBeenCalled();
  });
});

describe('rooms and threads', () => {
  it('SPACE_ROOM_CREATE is an upsert: roomCreate for new rooms, roomUpdate otherwise', async () => {
    const { client, record, send } = await start();
    const created = record(Events.RoomCreate);
    const updated = record(Events.RoomUpdate);
    const NEW_ID = '4000000000000000030';
    await send('SPACE_ROOM_CREATE', { ...spaceRoom(NEW_ID, RoomType.SpaceVoice, { name: 'Stage' }), room_id: NEW_ID }, { space_id: SPACE_ID });
    await send('SPACE_ROOM_CREATE', { ...spaceRoom(NEW_ID, RoomType.SpaceVoice, { name: 'Stage 2' }), room_id: NEW_ID }, { space_id: SPACE_ID });
    expect(created).toHaveLength(1);
    expect(created[0]?.[0].isVoiceBased()).toBe(true);
    expect(client.spaces.cache.get(SPACE_ID)?.rooms.cache.has(NEW_ID)).toBe(true);
    const [old, current] = updated[0] ?? [];
    expect(old?.isSpaceBased() && old.name).toBe('Stage');
    expect(current?.isSpaceBased() && current.name).toBe('Stage 2');
  });

  it('SPACE_ROOM_UPDATE merges a partial room and keeps what it does not mention', async () => {
    const { client, record, send } = await start();
    const updated = record(Events.RoomUpdate);
    await send('SPACE_ROOM_UPDATE', { room_id: TEXT_ID, space_id: SPACE_ID, position: 4, parent_id: null, permissions_synced: false, updated_at: now }, { space_id: SPACE_ID });
    const room = client.rooms.cache.get(TEXT_ID);
    const [old] = updated[0] ?? [];
    expect(old?.isSpaceBased() && old.parentId).toBe(SECTION_ID);
    expect(room?.isTextRoom() && room.parentId).toBeNull();
    expect(room?.isTextRoom() && room.rawPosition).toBe(4);
    expect(room?.isTextRoom() && room.name).toBe('chat');
    expect(room?.isTextRoom() && room.topic).toBe('hello');
    expect(room?.type).toBe(RoomType.SpaceText);
  });

  it('SPACE_ROOM_DELETE removes the room and its threads', async () => {
    const { client, record, send } = await start();
    const deleted = record(Events.RoomDelete);
    await send('SPACE_ROOM_DELETE', { room_id: SECRET_ID, space_id: SPACE_ID }, { space_id: SPACE_ID });
    expect(deleted[0]?.[0].id).toBe(SECRET_ID);
    expect(client.rooms.cache.has(SECRET_ID)).toBe(false);
    expect(client.rooms.cache.has(THREAD_ID)).toBe(false);
    expect(client.spaces.cache.get(SPACE_ID)?.rooms.cache.has(SECRET_ID)).toBe(false);
  });

  it('override events patch the room and emit roomUpdate with the overrides before and after', async () => {
    const { client, record, send } = await start();
    const updated = record(Events.RoomUpdate);
    await send(
      'SPACE_ROOM_OVERRIDE_UPDATE',
      { space_id: SPACE_ID, room_id: SECRET_ID, role_id: EVERYONE_ID, allow: Number(P.ViewRoom), deny: 0, created_at: now, updated_at: now },
      { space_id: SPACE_ID },
    );
    const [old, current] = updated[0] ?? [];
    const before = old?.isTextRoom() ? old.permissionOverwrites.cache.get(EVERYONE_ID) : undefined;
    const after = current?.isTextRoom() ? current.permissionOverwrites.cache.get(EVERYONE_ID) : undefined;
    expect(before?.deny.has(P.ViewRoom)).toBe(true);
    expect(after?.allow.has(P.ViewRoom)).toBe(true);

    await send('SPACE_ROOM_USER_OVERRIDE_UPDATE', { space_id: SPACE_ID, room_id: SECRET_ID, user_id: OWNER_ID, allow: 0, deny: 2048, created_at: now, updated_at: now }, { space_id: SPACE_ID });
    const room = client.rooms.cache.get(SECRET_ID);
    expect(room?.isTextRoom() && room.permissionOverwrites.cache.has(OWNER_ID)).toBe(true);
    await send('SPACE_ROOM_USER_OVERRIDE_DELETE', { space_id: SPACE_ID, room_id: SECRET_ID, user_id: OWNER_ID }, { space_id: SPACE_ID });
    await send('SPACE_ROOM_OVERRIDE_DELETE', { space_id: SPACE_ID, room_id: SECRET_ID, role_id: MOD_ROLE_ID }, { space_id: SPACE_ID });
    expect(room?.isTextRoom() && [...room.permissionOverwrites.cache.keys()]).toEqual([EVERYONE_ID]);
    expect(updated).toHaveLength(4);
  });

  it('ROOM_CREATE, ROOM_UPDATE and ROOM_LEAVE track group PMs', async () => {
    const { client, record, send } = await start();
    const created = record(Events.RoomCreate);
    const updated = record(Events.RoomUpdate);
    const deleted = record(Events.RoomDelete);
    const group = { id: GROUP_ID, type: RoomType.GroupPM, recipients: [BOT_ID, OWNER_ID], created_at: now, e2ee_enabled: false, name: 'friends', creator_id: OWNER_ID };
    await send('ROOM_CREATE', group, { user_id: BOT_ID });
    await send('ROOM_UPDATE', { ...group, name: 'pals' }, { user_id: BOT_ID });
    await send('ROOM_LEAVE', { room_id: GROUP_ID }, { user_id: BOT_ID });
    expect(created[0]?.[0].isGroupPM()).toBe(true);
    const [old, current] = updated[0] ?? [];
    expect(old?.isGroupPM() && old.name).toBe('friends');
    expect(current?.isGroupPM() && current.name).toBe('pals');
    expect(deleted[0]?.[0].id).toBe(GROUP_ID);
    expect(client.rooms.cache.has(GROUP_ID)).toBe(false);
  });

  it('thread events', async () => {
    const { client, api, record, send } = await start();
    const created = record(Events.ThreadCreate);
    const updated = record(Events.ThreadUpdate);
    const members = record(Events.ThreadMembersUpdate);
    const deleted = record(Events.ThreadDelete);
    const NEW_ID = '4000000000000000040';
    const thread = {
      ...spaceRoom(NEW_ID, RoomType.Thread, {
        name: 'help',
        parent_id: TEXT_ID,
        thread: { archived: false, locked: false, private: false, invitable: true, auto_archive_minutes: 60, owner_id: OWNER_ID, archived_at: null, message_count: 0, member_count: 1, joined: false },
      }),
      room_id: NEW_ID,
    };
    await send('THREAD_CREATE', { ...thread, newly_created: true }, { space_id: SPACE_ID, room_id: NEW_ID });
    const [room, newly] = created[0] ?? [];
    expect(room?.isThread()).toBe(true);
    expect(newly).toBe(true);
    expect(room?.parentId).toBe(TEXT_ID);

    await send('THREAD_UPDATE', { ...thread, name: 'solved' }, { space_id: SPACE_ID, room_id: NEW_ID });
    expect(updated[0]?.[0].name).toBe('help');
    expect(updated[0]?.[1].name).toBe('solved');

    await send(
      'THREAD_MEMBERS_UPDATE',
      { space_id: SPACE_ID, room_id: NEW_ID, parent_id: TEXT_ID, added_members: [{ user_id: BOT_ID, joined_at: now }], removed_member_ids: [OWNER_ID], member_count: 1 },
      { space_id: SPACE_ID, room_id: NEW_ID },
    );
    const [added, removed, target] = members[0] ?? [];
    expect([...(added?.keys() ?? [])]).toEqual([BOT_ID]);
    expect([...(removed?.keys() ?? [])]).toEqual([OWNER_ID]);
    expect(target?.joined).toBe(true);
    expect(target?.memberCount).toBe(1);

    await send('THREAD_MEMBER_UPDATE', { space_id: SPACE_ID, room_id: NEW_ID, joined: false }, { user_id: BOT_ID });
    expect(target?.joined).toBe(false);

    await send('THREAD_DELETE', { space_id: SPACE_ID, room_id: NEW_ID, parent_id: TEXT_ID }, { space_id: SPACE_ID });
    expect(deleted[0]?.[0].id).toBe(NEW_ID);
    expect(client.rooms.cache.has(NEW_ID)).toBe(false);

    // Added to a private thread the bot did not know: fetched and emitted as threadCreate.
    const PRIVATE_ID = '4000000000000000041';
    api.on(`GET /rooms/${PRIVATE_ID}`, { ...thread, id: PRIVATE_ID, room_id: PRIVATE_ID, name: 'private' });
    await send('THREAD_MEMBER_UPDATE', { space_id: SPACE_ID, room_id: PRIVATE_ID, joined: true }, { user_id: BOT_ID });
    await vi.waitFor(() => {
      expect(created).toHaveLength(2);
    });
    expect(created[1]?.[0].joined).toBe(true);
    expect(created[1]?.[1]).toBe(false);
  });
});

describe("the client's own thread membership", () => {
  const PRIVATE_ID = '4000000000000000042';
  function threadData(id: string, extra: { private?: boolean; owner_id?: string; joined?: boolean; archived?: boolean } = {}) {
    return {
      ...spaceRoom(id, RoomType.Thread, {
        name: 'side',
        parent_id: TEXT_ID,
        thread: {
          archived: extra.archived ?? false,
          locked: false,
          private: extra.private ?? false,
          invitable: true,
          auto_archive_minutes: 60,
          owner_id: extra.owner_id ?? OWNER_ID,
          archived_at: null,
          message_count: 0,
          member_count: 1,
          ...(extra.joined === undefined ? {} : { joined: extra.joined }),
        },
      }),
      room_id: id,
    };
  }

  it("ignores THREAD_CREATE / THREAD_UPDATE's joined, which describes the creator or the actor", async () => {
    const { client, send } = await start();
    const env = { space_id: SPACE_ID, room_id: PRIVATE_ID };
    // Someone else starts a public thread: the broadcast says joined (theirs).
    await send('THREAD_CREATE', { ...threadData('4000000000000000043', { joined: true }), newly_created: true }, { space_id: SPACE_ID });
    expect(client.rooms.cache.get('4000000000000000043')).toMatchObject({ joined: false });
    // The bot starts one: newly_created with the bot as owner.
    await send('THREAD_CREATE', { ...threadData('4000000000000000044', { joined: true, owner_id: BOT_ID }), newly_created: true }, { space_id: SPACE_ID });
    expect(client.rooms.cache.get('4000000000000000044')).toMatchObject({ joined: true });
    // An edit by someone who joined does not make the bot a member either.
    await send('THREAD_UPDATE', { ...threadData('4000000000000000043', { joined: true }), name: 'renamed' }, { space_id: SPACE_ID });
    expect(client.rooms.cache.get('4000000000000000043')).toMatchObject({ name: 'renamed', joined: false });

    // The bot is added to a private thread (its member entry is not cached, the usual case).
    const space = client.spaces.cache.get(SPACE_ID)!;
    space.members._add({ id: BOT_ID, username: 'helper', roles: [], joined_at: now, nick: null, bot: true });
    await send('THREAD_CREATE', threadData(PRIVATE_ID, { private: true, joined: true }), env);
    const thread = client.rooms.cache.get(PRIVATE_ID);
    if (!thread?.isThread()) throw new Error('no thread');
    expect(thread.joined).toBe(false);
    expect(thread.permissionsFor(BOT_ID)?.has(P.ViewRoom)).toBe(false);
    await send('THREAD_MEMBER_UPDATE', { space_id: SPACE_ID, room_id: PRIVATE_ID, joined: true }, { user_id: BOT_ID });
    expect(thread.joined).toBe(true);
    // The auto-archive worker's THREAD_UPDATE is built for nobody: joined false.
    await send('THREAD_UPDATE', threadData(PRIVATE_ID, { private: true, archived: true, joined: false }), env);
    expect(thread.archived).toBe(true);
    expect(thread.joined).toBe(true);
    expect(thread.permissionsFor(BOT_ID)?.has(P.ViewRoom)).toBe(true);
  });
});

describe('spaces, members, roles and emojis', () => {
  it('SPACE_CREATE caches the space with its rooms; SPACE_UPDATE gives old and new', async () => {
    const { client, record, send } = await start();
    const created = record(Events.SpaceCreate);
    const updated = record(Events.SpaceUpdate);
    const OTHER_ID = '2000000000000000005';
    const OTHER_EVERYONE = '3000000000000000050';
    const other = apiSpace({
      id: OTHER_ID,
      name: 'Other',
      everyone_role_id: OTHER_EVERYONE,
      roles: [role(OTHER_EVERYONE, 0, 0, { name: '@everyone' })],
      rooms: [spaceRoom('4000000000000000050', RoomType.SpaceText, { space_id: OTHER_ID })],
    });
    await send('SPACE_CREATE', { ...other, space_id: OTHER_ID }, { user_id: BOT_ID });
    expect(created[0]?.[0].name).toBe('Other');
    const otherRoom = client.rooms.cache.get('4000000000000000050');
    expect(otherRoom?.isSpaceBased() && otherRoom.space.id).toBe(OTHER_ID);

    const { rooms: _rooms, roles: _roles, ...plain } = other;
    await send('SPACE_UPDATE', { ...plain, name: 'Renamed', space_id: OTHER_ID }, { space_id: OTHER_ID });
    const [old, current] = updated[0] ?? [];
    expect(old?.name).toBe('Other');
    expect(current?.name).toBe('Renamed');
    expect(current?.roles.cache.size).toBe(1);
  });

  it('SPACE_DELETE then SPACE_LEAVE emit spaceDelete once and drop the space rooms', async () => {
    const { client, record, send } = await start();
    const deleted = record(Events.SpaceDelete);
    await send('SPACE_DELETE', { space_id: SPACE_ID }, { space_id: SPACE_ID });
    await send('SPACE_LEAVE', { space_id: SPACE_ID }, { user_id: BOT_ID });
    expect(deleted).toHaveLength(1);
    expect(client.spaces.cache.size).toBe(0);
    expect(client.rooms.cache.has(TEXT_ID)).toBe(false);
  });

  it('member events: add (role_ids), update with the old roles, remove (partial when uncached)', async () => {
    const { client, record, send } = await start();
    const added = record(Events.SpaceMemberAdd);
    const updated = record(Events.SpaceMemberUpdate);
    const removed = record(Events.SpaceMemberRemove);
    const space = client.spaces.cache.get(SPACE_ID);

    await send('SPACE_MEMBER_ADD', memberAdd(USER_ID), { space_id: SPACE_ID });
    const [member] = added[0] ?? [];
    expect(member?.user.username).toBe('user3');
    expect(space?.members.cache.get(USER_ID)).toBe(member);

    const update = { space_id: SPACE_ID, user_id: USER_ID, role_ids: [MOD_ROLE_ID], nick: 'Mod', space_avatar: null, space_banner: null, space_about_me: null, space_bio: null, space_pronouns: null };
    await send('SPACE_MEMBER_UPDATE', update, { space_id: SPACE_ID });
    const [old, current] = updated[0] ?? [];
    expect(old?.roles.cache.has(MOD_ROLE_ID)).toBe(false);
    expect(current?.roles.cache.has(MOD_ROLE_ID)).toBe(true);
    expect(old?.nickname).toBeNull();
    expect(current?.nickname).toBe('Mod');
    expect(current?.permissions.has(P.KickMembers)).toBe(true);

    // An update for a member that is not cached: the old one is partial.
    await send('SPACE_MEMBER_UPDATE', { ...update, user_id: OWNER_ID + '9' }, { space_id: SPACE_ID });
    expect(updated[1]?.[0].partial).toBe(true);

    await send('SPACE_MEMBER_REMOVE', { space_id: SPACE_ID, user_id: USER_ID }, { space_id: SPACE_ID });
    await send('SPACE_MEMBER_REMOVE', { space_id: SPACE_ID, user_id: '1000000000000000077' }, { space_id: SPACE_ID });
    expect(removed[0]?.[0]).toBe(member);
    expect(removed[1]?.[0].partial).toBe(true);
    expect(space?.members.cache.has(USER_ID)).toBe(false);
  });

  it('role events', async () => {
    const { client, record, send } = await start();
    const created = record(Events.RoleCreate);
    const updated = record(Events.RoleUpdate);
    const deleted = record(Events.RoleDelete);
    const ROLE_ID = '3000000000000000060';
    await send('SPACE_ROLE_CREATE', { ...role(ROLE_ID, 3, 0, { name: 'New' }), space_id: SPACE_ID }, { space_id: SPACE_ID });
    await send('SPACE_ROLE_UPDATE', { ...role(ROLE_ID, 3, Number(P.Administrator), { name: 'Admin' }), space_id: SPACE_ID }, { space_id: SPACE_ID });
    await send('SPACE_ROLE_DELETE', { space_id: SPACE_ID, role_id: ROLE_ID }, { space_id: SPACE_ID });
    // The created role is the cached object, patched in place by the update.
    expect(created[0]?.[0]).toBe(updated[0]?.[1]);
    expect(updated[0]?.[0].name).toBe('New');
    expect(updated[0]?.[1].name).toBe('Admin');
    expect(updated[0]?.[1].permissions.has(P.Administrator)).toBe(true);
    expect(deleted[0]?.[0].id).toBe(ROLE_ID);
    expect(client.spaces.cache.get(SPACE_ID)?.roles.cache.has(ROLE_ID)).toBe(false);
  });

  it('emoji events keep client.emojis current', async () => {
    const { client, record, send } = await start();
    const created = record(Events.EmojiCreate);
    const updated = record(Events.EmojiUpdate);
    const deleted = record(Events.EmojiDelete);
    const EMOJI_ID = '3000000000000000070';
    const emoji = { id: EMOJI_ID, space_id: SPACE_ID, name: 'party', url: 'https://cdn.chat.example/emojis/x.png', animated: false, creator_id: OWNER_ID, created_at: now, updated_at: now };
    await send('SPACE_EMOJI_CREATE', emoji, { space_id: SPACE_ID });
    expect(created[0]?.[0].name).toBe('party');
    expect(client.emojis.cache.has(EMOJI_ID)).toBe(true);
    await send('SPACE_EMOJI_UPDATE', { ...emoji, name: 'fiesta' }, { space_id: SPACE_ID });
    expect(updated[0]?.[0].name).toBe('party');
    expect(updated[0]?.[1].name).toBe('fiesta');
    await send('SPACE_EMOJI_DELETE', { space_id: SPACE_ID, emoji_id: EMOJI_ID }, { space_id: SPACE_ID });
    expect(deleted[0]?.[0].id).toBe(EMOJI_ID);
    expect(client.emojis.cache.has(EMOJI_ID)).toBe(false);
  });
});

describe('users, presence and voice', () => {
  it('PRESENCE_UPDATE replaces the presence and skips duplicate copies', async () => {
    const { client, send } = await start();
    // Presences are patched in place, so take what each event showed when it was emitted.
    const presences: [string | null, string, string | undefined][] = [];
    client.on(Events.PresenceUpdate, (before, after) => presences.push([before?.status ?? null, after.status, after.activities[0]?.name]));
    const update = { user_id: OWNER_ID, presence: { status: 'online', activities: [{ type: 'playing', name: 'Chess' }] } };
    await send('PRESENCE_UPDATE', update, { space_id: SPACE_ID });
    await send('PRESENCE_UPDATE', update, { space_id: '2000000000000000002' });
    await send('PRESENCE_UPDATE', { user_id: OWNER_ID, presence: { status: 'idle' } }, { space_id: SPACE_ID });
    expect(presences).toEqual([
      [null, 'online', 'Chess'],
      ['online', 'idle', undefined],
    ]);
    expect(client.users.cache.get(OWNER_ID)?.presence?.status).toBe('idle');
  });

  it('USER_UPDATE patches a cached user and skips copies that change nothing', async () => {
    const { client, record, send } = await start();
    const users = record(Events.UserUpdate);
    await send('SPACE_MEMBER_ADD', memberAdd(USER_ID), { space_id: SPACE_ID });
    const update = { user_id: USER_ID, username: 'user3', display_name: 'New Name', avatar: '', banner: '', bio: '', about_me: '', accent_color: '', bot: false, pronouns: '' };
    await send('USER_UPDATE', { ...update, room_id: TEXT_ID, space_id: SPACE_ID }, { room_id: TEXT_ID, space_id: SPACE_ID });
    await send('USER_UPDATE', update, { user_id: BOT_ID });
    expect(users).toHaveLength(1);
    const [old, current] = users[0] ?? [];
    expect(old?.displayName).toBe('Someone');
    expect(current?.displayName).toBe('New Name');
    expect(client.users.cache.get(USER_ID)).toBe(current);
  });

  it('VOICE_STATE_UPDATE tracks joins and leaves', async () => {
    const { client, record, send } = await start();
    const states = record(Events.VoiceStateUpdate);
    const space = client.spaces.cache.get(SPACE_ID);
    const state = { user_id: USER_ID, room_id: VOICE_ID, space_id: SPACE_ID, session_id: 's2', self_mute: true, self_deaf: false, mute: false, deaf: false, self_video: false, self_stream: false, suppress: false };
    await send('VOICE_STATE_UPDATE', state, { space_id: SPACE_ID, room_id: VOICE_ID });
    const [old, joined] = states[0] ?? [];
    expect(old?.roomId).toBeNull();
    expect(joined?.roomId).toBe(VOICE_ID);
    expect(joined?.selfMute).toBe(true);
    expect(space?.voiceStates.cache.has(USER_ID)).toBe(true);
    await send('VOICE_STATE_UPDATE', { ...state, left: true }, { space_id: SPACE_ID, room_id: VOICE_ID });
    expect(states).toHaveLength(2);
    expect(space?.voiceStates.cache.has(USER_ID)).toBe(false);
  });
});

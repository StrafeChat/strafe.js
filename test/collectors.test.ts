import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../src/client/Client.js';
import { Events } from '../src/client/ClientEvents.js';
import { MessageCollector } from '../src/structures/MessageCollector.js';
import { ReactionCollector } from '../src/structures/ReactionCollector.js';
import type { TextRoom } from '../src/structures/rooms/TextRoom.js';
import { Collection } from '../src/util/Collection.js';
import { BOT_ID, OWNER_ID, SECRET_ID, SPACE_ID, TEXT_ID, message } from './helpers.js';
import { dispatch, flush, loggedIn } from './gateway/helpers.js';

const USER_ID = '1000000000000000003';
const env = { room_id: TEXT_ID, space_id: SPACE_ID };

const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.destroy();
});

async function start() {
  const value = await loggedIn();
  clients.push(value.client);
  const room = value.client.rooms.cache.get(TEXT_ID) as TextRoom;
  const say = (id: string, author = OWNER_ID, roomId = TEXT_ID, content = 'hello') => {
    dispatch(value.socket, 'MESSAGE_CREATE', message(id, { room_id: roomId, sender_id: author, plaintext: content, author: { ...message(id).author!, id: author } }), { ...env, room_id: roomId });
  };
  const react = (messageId: string, userId: string, emoji: string, added = true) => {
    dispatch(value.socket, added ? 'MESSAGE_REACTION_ADD' : 'MESSAGE_REACTION_REMOVE', { ...env, message_id: messageId, user_id: userId, emoji }, env);
  };
  return { ...value, room, say, react };
}

describe('message collectors', () => {
  it('awaitMessages resolves with the first matching message in the room, then stops listening', async () => {
    const { client, room, say } = await start();
    const baseline = client.listenerCount(Events.MessageCreate);
    const answer = room.awaitMessages({ filter: (m) => m.author.id === USER_ID, max: 1, time: 5_000, errors: ['time'] });
    expect(client.listenerCount(Events.MessageCreate)).toBe(baseline + 1);
    say('800'); // another author
    say('801', USER_ID, SECRET_ID); // another room
    say('802', USER_ID, TEXT_ID, 'yes');
    const collected = await answer;
    expect(collected).toBeInstanceOf(Collection);
    expect([...collected.keys()]).toEqual(['802']);
    expect(collected.first()?.content).toBe('yes');
    expect(client.listenerCount(Events.MessageCreate)).toBe(baseline);
  });

  it('awaitMessages rejects with the (empty) collection when the time runs out and `time` is an error', async () => {
    const { room } = await start();
    const error = await room.awaitMessages({ max: 1, time: 20, errors: ['time'] }).catch((collected: unknown) => collected);
    expect(error).toBeInstanceOf(Collection);
    expect((error as Collection<string, unknown>).size).toBe(0);
    // Without `errors`, the same end resolves.
    await expect(room.awaitMessages({ max: 1, time: 20 })).resolves.toHaveProperty('size', 0);
  });

  it('createMessageCollector emits collect, ignore, dispose and end, and honours maxProcessed', async () => {
    const { room, say, socket } = await start();
    const collector = room.createMessageCollector({ filter: (m) => m.content !== 'skip', dispose: true, maxProcessed: 4 });
    expect(collector).toBeInstanceOf(MessageCollector);
    const seen: string[] = [];
    collector.on('collect', (m) => seen.push(`collect ${m.id}`));
    collector.on('ignore', (m) => seen.push(`ignore ${m.id}`));
    collector.on('dispose', (m) => seen.push(`dispose ${m.id}`));
    const ended = new Promise<[Collection<string, unknown>, string]>((resolve) => collector.once('end', (c, r) => resolve([c, r])));
    say('810');
    say('811', OWNER_ID, TEXT_ID, 'skip');
    say('812');
    await flush();
    dispatch(socket, 'MESSAGE_DELETE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '810' }, env);
    say('813');
    const [collected, reason] = await ended;
    expect(seen).toEqual(['collect 810', 'ignore 811', 'collect 812', 'dispose 810', 'collect 813']);
    expect([...collected.keys()]).toEqual(['812', '813']);
    expect(reason).toBe('processedLimit');
    expect(collector.received).toBe(4);
    expect(collector.ended).toBe(true);
    expect(collector.endReason).toBe('processedLimit');
  });

  it('ends on stop(), on idle, and when the room is deleted', async () => {
    const { client, room, say, socket } = await start();
    const stopped = room.createMessageCollector();
    const onEnd = vi.fn();
    stopped.on('end', onEnd);
    stopped.stop();
    stopped.stop('again');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith(expect.any(Collection), 'user');

    const idle = room.createMessageCollector({ idle: 30 });
    const idleEnd = new Promise<string>((resolve) => idle.once('end', (_c, r) => resolve(r)));
    say('820');
    await flush();
    expect(idle.collected.size).toBe(1);
    expect(await idleEnd).toBe('idle');

    const deleted = room.createMessageCollector();
    const deletedEnd = new Promise<string>((resolve) => deleted.once('end', (_c, r) => resolve(r)));
    dispatch(socket, 'SPACE_ROOM_DELETE', { room_id: TEXT_ID, space_id: SPACE_ID }, { space_id: SPACE_ID });
    expect(await deletedEnd).toBe('roomDelete');
    expect(client.listenerCount(Events.RoomDelete)).toBe(0);
  });

  it('every text-based room has them', async () => {
    const { client } = await start();
    for (const room of client.rooms.cache.values()) {
      if (!room.isTextBased()) continue;
      const collector = room.createMessageCollector({ time: 1 });
      expect(collector.room).toBe(room);
      collector.stop();
    }
  });
});

describe('reaction collectors', () => {
  it('awaitReactions collects matching reactions on one message', async () => {
    const { client, room, say, react } = await start();
    say('830');
    await flush();
    const poll = room.messages.cache.get('830')!;
    const votes = poll.awaitReactions({ filter: (reaction, user) => reaction.emoji.name === '👍' && user.id !== BOT_ID, max: 2, time: 5_000 });
    react('830', BOT_ID, '👍'); // the bot's own vote: filtered out
    react('830', OWNER_ID, '👎'); // another emoji: filtered out
    react('831', OWNER_ID, '👍'); // another message
    react('830', OWNER_ID, '👍');
    react('830', USER_ID, '👍');
    const collected = await votes;
    expect([...collected.keys()]).toEqual(['👍']);
    expect(collected.get('👍')?.count).toBe(3);
    expect(client.listenerCount(Events.MessageReactionAdd)).toBe(0);
  });

  it('counts users and emoji, disposes an emoji nobody has any more, and ends with the message', async () => {
    const { room, say, react, socket } = await start();
    say('840');
    await flush();
    const target = room.messages.cache.get('840')!;
    const collector = target.createReactionCollector({ dispose: true });
    expect(collector).toBeInstanceOf(ReactionCollector);
    const disposed = vi.fn();
    collector.on('dispose', disposed);
    react('840', OWNER_ID, '👍');
    react('840', USER_ID, '👍');
    react('840', OWNER_ID, '🎉');
    await flush();
    expect(collector.total).toBe(3);
    expect([...collector.users.keys()]).toEqual([OWNER_ID, USER_ID]);
    expect([...collector.collected.keys()]).toEqual(['👍', '🎉']);
    react('840', OWNER_ID, '🎉', false);
    await flush();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect([...collector.collected.keys()]).toEqual(['👍']);
    expect(collector.total).toBe(2);
    const ended = new Promise<string>((resolve) => collector.once('end', (_c, r) => resolve(r)));
    dispatch(socket, 'MESSAGE_DELETE', { room_id: TEXT_ID, space_id: SPACE_ID, message_id: '840' }, env);
    expect(await ended).toBe('messageDelete');
  });

  it('maxUsers and maxEmojis end the collector', async () => {
    const { room, say, react } = await start();
    say('850');
    await flush();
    const target = room.messages.cache.get('850')!;
    const byUsers = target.awaitReactions({ maxUsers: 2 });
    const byEmoji = target.createReactionCollector({ maxEmojis: 2 });
    const emojiEnd = new Promise<string>((resolve) => byEmoji.once('end', (_c, r) => resolve(r)));
    react('850', OWNER_ID, '👍');
    react('850', OWNER_ID, '👀');
    react('850', USER_ID, '👍');
    expect((await byUsers).size).toBe(2);
    expect(await emojiEnd).toBe('emojiLimit');
  });
});

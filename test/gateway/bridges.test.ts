import { afterEach, describe, expect, it } from 'vitest';
import type { Client } from '../../src/client/Client.js';
import { Events } from '../../src/client/ClientEvents.js';
import type { ClientEvents } from '../../src/client/ClientEvents.js';
import type { TextRoom } from '../../src/structures/rooms/TextRoom.js';
import { BOT_ID, BRIDGE_ID, OWNER_ID, PUPPET_ID, SPACE_ID, TEXT_ID, apiBridge, apiSpace, bridgedMessage, message } from '../helpers.js';
import { dispatch, flush, loggedIn, readyPayload } from './helpers.js';

const OTHER_ID = '1310000000000000010';
const OTHER_BOT = '1000000000000000099';

/** A bridge another bot drives, as everyone who can view the room sees it. */
function summary(id = OTHER_ID) {
  const { settings: _s, creator: _c, updated_at: _u, last_used_at: _l, ...rest } = apiBridge({ id, driver_id: OTHER_BOT, application_id: OTHER_BOT, driver_name: 'Other' });
  return rest;
}

const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.destroy();
});

/** Logged in with READY carrying one bridge the bot drives and one summary of another bot's. */
async function start() {
  const { rooms, ...space } = apiSpace();
  const withBridges = (rooms ?? []).map((room) => (room.id === TEXT_ID ? { ...room, bridges: [summary(), summary(BRIDGE_ID)] } : room));
  const value = await loggedIn({}, readyPayload({ spaces: [space], space_rooms: { [SPACE_ID]: withBridges }, bridges: [apiBridge()] }));
  clients.push(value.client);
  const { client, socket } = value;
  function record<E extends keyof ClientEvents>(event: E): ClientEvents[E][] {
    const calls: ClientEvents[E][] = [];
    client.on(event, (...args) => calls.push(args));
    return calls;
  }
  async function send(t: string, d: unknown, envelope: Record<string, unknown> = { space_id: SPACE_ID, room_id: TEXT_ID }): Promise<void> {
    dispatch(socket, t, d, envelope);
    await flush();
  }
  const room = client.rooms.cache.get(TEXT_ID) as TextRoom;
  return { ...value, record, send, room };
}

describe('bridges from READY', () => {
  it('caches the bridges the bot drives in full and every room’s summaries', async () => {
    const { client, room } = await start();
    expect(client.bridges.cache.size).toBe(1);
    const mine = client.bridges.cache.get(BRIDGE_ID)!;
    expect(mine.partial).toBe(false);
    expect(mine.driven).toBe(true);
    expect(mine.room).toBe(room);
    expect(room.bridged).toBe(true);
    expect([...room.bridges.keys()].sort()).toEqual([BRIDGE_ID, OTHER_ID]);
    // The summary in the room did not replace the full object.
    expect(room.bridges.get(BRIDGE_ID)).toBe(mine);
    expect(room.bridges.get(OTHER_ID)!.partial).toBe(true);
    expect(client.bridges.cache.has(OTHER_ID)).toBe(false);
  });
});

describe('bridge management events', () => {
  it('emits create and update for another bot’s bridge, from the summaries', async () => {
    const { send, record, room, client } = await start();
    const created = record(Events.BridgeCreate);
    const updated = record(Events.BridgeUpdate);
    await send('BRIDGE_CREATE', summary('1310000000000000011'));
    expect(created).toHaveLength(1);
    expect(room.bridges.has('1310000000000000011')).toBe(true);
    expect(client.bridges.cache.has('1310000000000000011')).toBe(false);

    await send('BRIDGE_UPDATE', { ...summary('1310000000000000011'), state: 'paused', state_reason: 'became_private' });
    expect(updated).toHaveLength(1);
    const [old, now] = updated[0]!;
    expect(old.state).toBe('active');
    expect(now.state).toBe('paused');
    expect(now.stateReason).toBe('became_private');
  });

  it('applies only the full object for its own bridge, and emits a delete once', async () => {
    const { send, record, client, room } = await start();
    const updated = record(Events.BridgeUpdate);
    const deleted = record(Events.BridgeDelete);
    // Summary first (to the room's viewers), then the full object (the bot's feed).
    await send('BRIDGE_UPDATE', { ...summary(BRIDGE_ID), driver_id: BOT_ID, name: 'Renamed' });
    expect(updated).toHaveLength(0);
    await send('BRIDGE_UPDATE', apiBridge({ name: 'Renamed', settings: { relay_bots: true, relay_other_bridges: false, reply_pings: true, allow_colour: false, show_profile_links: false } }));
    expect(updated).toHaveLength(1);
    expect(updated[0]![0].name).toBe('Discord #general');
    expect(updated[0]![1].name).toBe('Renamed');
    expect(client.bridges.cache.get(BRIDGE_ID)!.settings?.relayBots).toBe(true);

    await send('BRIDGE_DELETE', { id: BRIDGE_ID, space_id: SPACE_ID, room_id: TEXT_ID });
    await send('BRIDGE_DELETE', { id: BRIDGE_ID, bridge_id: BRIDGE_ID, space_id: SPACE_ID, room_id: TEXT_ID });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]![0].id).toBe(BRIDGE_ID);
    expect(client.bridges.cache.has(BRIDGE_ID)).toBe(false);
    expect(room.bridges.has(BRIDGE_ID)).toBe(false);
  });

  it('emits webhooksUpdate with the room', async () => {
    const { send, record, room } = await start();
    const calls = record(Events.WebhooksUpdate);
    await send('WEBHOOKS_UPDATE', { space_id: SPACE_ID, room_id: TEXT_ID });
    expect(calls).toEqual([[room]]);
  });
});

describe('the bridge feed', () => {
  it('emits messages to copy with the reply’s copy, and edits with where they went', async () => {
    const { send, record, client, room } = await start();
    const created = record(Events.BridgeMessageCreate);
    const updated = record(Events.BridgeMessageUpdate);
    await send('BRIDGE_MESSAGE_CREATE', {
      bridge_id: BRIDGE_ID,
      room_id: TEXT_ID,
      message: message('7000000000000000040', { reply_to_id: '7000000000000000010' }),
      reply_external: { external_message_id: '1300', part: 0 },
    });
    expect(created).toHaveLength(1);
    const [msg, details] = created[0]!;
    expect(msg.id).toBe('7000000000000000040');
    expect(room.messages.cache.get(msg.id)).toBe(msg);
    expect(details.bridge).toBe(client.bridges.cache.get(BRIDGE_ID));
    expect(details.replyExternal).toEqual({ externalMessageId: '1300', part: 0 });

    await send('BRIDGE_MESSAGE_UPDATE', {
      bridge_id: BRIDGE_ID,
      room_id: TEXT_ID,
      message: message('7000000000000000040', { plaintext: 'edited' }),
      external: [
        { external_message_id: '1400', part: 0 },
        { external_message_id: '1401', part: 1 },
      ],
    });
    const [edited, editDetails] = updated[0]!;
    expect(edited.content).toBe('edited');
    expect(editDetails.replyExternal).toBeNull();
    expect(editDetails.external).toEqual([
      { externalMessageId: '1400', part: 0 },
      { externalMessageId: '1401', part: 1 },
    ]);
  });

  it('emits deletes with a partial message when it was not cached', async () => {
    const { send, record } = await start();
    const deleted = record(Events.BridgeMessageDelete);
    await send('BRIDGE_MESSAGE_DELETE', { bridge_id: BRIDGE_ID, room_id: TEXT_ID, message_id: '7000000000000000041', external: [{ external_message_id: '1500', part: 0 }], by_moderator: true });
    const [msg, details] = deleted[0]!;
    expect(msg.id).toBe('7000000000000000041');
    expect(msg.partial).toBe(true);
    expect(details).toMatchObject({ byModerator: true, external: [{ externalMessageId: '1500', part: 0 }] });
  });

  it('emits reactions from people and from another bridge’s users, never caching the latter', async () => {
    const { send, record, client } = await start();
    const added = record(Events.BridgeReactionAdd);
    const removed = record(Events.BridgeReactionRemove);
    const owner = { id: OWNER_ID, username: 'owner', display_name: 'The Owner', avatar: '', bot: false };
    await send('BRIDGE_REACTION_ADD', { bridge_id: BRIDGE_ID, room_id: TEXT_ID, message_id: '7000000000000000042', external: [{ external_message_id: '1600', part: 0 }], user: owner, emoji: '👍' });
    expect(added[0]![0]).toMatchObject({ emoji: '👍', puppet: null, external: [{ externalMessageId: '1600', part: 0 }] });
    expect(added[0]![0].user).toBe(client.users.cache.get(OWNER_ID));

    await send('BRIDGE_REACTION_REMOVE', {
      bridge_id: BRIDGE_ID,
      room_id: TEXT_ID,
      message_id: '7000000000000000042',
      external: [],
      user: { id: '1310000000000000088', username: 'Bob', display_name: 'Bob', avatar: '', bot: true, puppet: { bridge_id: OTHER_ID, puppet_id: '1310000000000000088', platform: 'matrix', platform_name: 'Matrix' } },
      emoji: 'custom:5000000000000000009',
    });
    const details = removed[0]![0];
    expect(details.puppet).toEqual({ bridgeId: OTHER_ID, puppetId: '1310000000000000088', platform: 'matrix', platformName: 'Matrix' });
    expect(details.user.username).toBe('Bob');
    expect(client.users.cache.has('1310000000000000088')).toBe(false);
  });

  it('emits opt-outs and puppet blocks with the external ids', async () => {
    const { send, record } = await start();
    const optOuts = record(Events.BridgeOptOut);
    const blocks = record(Events.BridgePuppetBlock);
    const unblocks = record(Events.BridgePuppetUnblock);
    await send('BRIDGE_OPTOUT', { bridge_id: BRIDGE_ID, user_id: OWNER_ID, external: [{ message_id: '7000000000000000001', external_message_id: '1700', part: 0 }] });
    expect(optOuts[0]![0]).toMatchObject({ userId: OWNER_ID, external: [{ messageId: '7000000000000000001', externalMessageId: '1700', part: 0 }] });
    expect(optOuts[0]![0].bridge.id).toBe(BRIDGE_ID);

    await send('BRIDGE_PUPPET_BLOCK', { bridge_id: BRIDGE_ID, puppet_id: PUPPET_ID, external_user_id: '81726354' });
    await send('BRIDGE_PUPPET_UNBLOCK', { bridge_id: BRIDGE_ID, puppet_id: PUPPET_ID, external_user_id: '81726354' });
    expect(blocks[0]![0]).toMatchObject({ puppetId: PUPPET_ID, externalUserId: '81726354' });
    expect(unblocks[0]![0]).toMatchObject({ puppetId: PUPPET_ID, externalUserId: '81726354' });
  });

  it('caches a bridge it was not told about from the feed’s ids', async () => {
    const { send, record, client } = await start();
    const blocks = record(Events.BridgePuppetBlock);
    await send('BRIDGE_PUPPET_BLOCK', { bridge_id: '1310000000000000012', puppet_id: PUPPET_ID, external_user_id: '1' });
    const bridge = blocks[0]![0].bridge;
    expect(bridge.id).toBe('1310000000000000012');
    expect(bridge.partial).toBe(true);
    expect(client.bridges.cache.get('1310000000000000012')).toBe(bridge);
  });
});

describe('masqueraded messages in the room', () => {
  it('reads webhook_id and masquerade off MESSAGE_CREATE, and a bridged user’s reaction', async () => {
    const { send, record, client, room } = await start();
    const created = record(Events.MessageCreate);
    const reactions = record(Events.MessageReactionAdd);
    await send('MESSAGE_CREATE', bridgedMessage('7000000000000000050'));
    const [msg] = created[0]!;
    expect(msg.webhookId).toBe(BRIDGE_ID);
    expect(msg.isBridged).toBe(true);
    expect(msg.author.id).toBe(PUPPET_ID);
    expect(msg.masquerade?.bridge?.platform).toBe('discord');
    expect(client.users.cache.has(PUPPET_ID)).toBe(false);

    await send('MESSAGE_REACTION_ADD', {
      room_id: TEXT_ID,
      message_id: '7000000000000000050',
      user_id: PUPPET_ID,
      emoji: '🎉',
      puppet: { bridge_id: BRIDGE_ID, puppet_id: PUPPET_ID, platform: 'discord', platform_name: 'Discord', name: 'Alice', avatar: null },
    });
    const [reaction, user] = reactions[0]!;
    expect(reaction.message.id).toBe('7000000000000000050');
    expect(user.username).toBe('Alice');
    expect(user.bot).toBe(true);
    expect(client.users.cache.has(PUPPET_ID)).toBe(false);
    expect(room.messages.cache.get('7000000000000000050')).toBe(msg);
  });
});

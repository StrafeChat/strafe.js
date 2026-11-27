import type { Client } from '../../client/Client.js';
import { Events } from '../../client/ClientEvents.js';
import type { Bridge } from '../../structures/Bridge.js';
import { externalRef, feedMessage, isFullBridge } from '../../structures/Bridge.js';
import type { Message, PartialMessage } from '../../structures/Message.js';
import { User } from '../../structures/User.js';
import type {
  GatewayBridgeData,
  GatewayBridgeDeleteData,
  GatewayBridgeMessageCreateData,
  GatewayBridgeMessageDeleteData,
  GatewayBridgeMessageUpdateData,
  GatewayBridgeOptOutData,
  GatewayBridgePuppetBlockData,
  GatewayBridgeReactionData,
  GatewayWebhooksUpdateData,
} from '../../types/api/bridge.js';
import type { GatewayEnvelope } from '../../types/api/gateway.js';
import type { Snowflake } from '../../util/Snowflake.js';
import { debug, nonEmpty, textRoomOf } from './util.js';

/** `WEBHOOKS_UPDATE`: emits `webhooksUpdate` with the room. @internal */
export function webhooksUpdate(client: Client, data: GatewayWebhooksUpdateData): void {
  const room = client.rooms.cache.get(data.room_id);
  if (room && (room.isTextRoom() || room.isVoiceBased())) client.emit(Events.WebhooksUpdate, room);
}

/**
 * `BRIDGE_CREATE` / `BRIDGE_UPDATE`. Everyone who can view the room gets the public summary; the
 * driving bot also gets the full bridge on its own feed. A bridge this bot drives therefore
 * arrives twice: the summary is skipped and the full object applied and emitted.
 */
function upsert(client: Client, data: GatewayBridgeData, created: boolean): void {
  const ours = data.driver_id !== null && data.driver_id === client._userId;
  if (ours && !isFullBridge(data)) return;
  const room = client.rooms.cache.get(data.room_id);
  const existing = client.bridges.cache.get(data.id) ?? (room?.isTextRoom() ? room.bridges.get(data.id) : undefined);
  const old = existing?._clone() ?? null;
  const bridge = client.bridges._add(data, room?.isTextRoom() ? room : null);
  if (created || old === null) client.emit(Events.BridgeCreate, bridge);
  else client.emit(Events.BridgeUpdate, old, bridge);
}

/** `BRIDGE_CREATE`. @internal */
export function bridgeCreate(client: Client, data: GatewayBridgeData): void {
  upsert(client, data, true);
}

/** `BRIDGE_UPDATE`. @internal */
export function bridgeUpdate(client: Client, data: GatewayBridgeData): void {
  upsert(client, data, false);
}

/** `BRIDGE_DELETE`: uncaches the bridge and emits `bridgeDelete` once (the bot gets it twice). @internal */
export function bridgeDelete(client: Client, data: GatewayBridgeDeleteData): void {
  const removed = client.bridges._remove(data.id, data.room_id) ?? client.bridges._takeTombstone(data.id);
  if (removed) client.emit(Events.BridgeDelete, removed);
}

/** The bridge a feed event is about; one this bot drives that is not cached yet is cached from the ids. */
function bridgeOf(client: Client, bridgeId: Snowflake, roomId: Snowflake | undefined, envelope: GatewayEnvelope): Bridge {
  const cached = client.bridges.cache.get(bridgeId);
  if (cached) return cached;
  const spaceId = nonEmpty(envelope.space_id);
  return client.bridges._add({
    id: bridgeId,
    ...(roomId === undefined ? {} : { room_id: roomId }),
    ...(spaceId === undefined ? {} : { space_id: spaceId }),
    driver_id: client._userId,
  });
}

/** `BRIDGE_MESSAGE_CREATE`: caches the message and emits `bridgeMessageCreate`. @internal */
export async function bridgeMessageCreate(client: Client, data: GatewayBridgeMessageCreateData, envelope: GatewayEnvelope): Promise<void> {
  const bridge = bridgeOf(client, data.bridge_id, data.room_id, envelope);
  try {
    const { message, replyExternal } = await feedMessage(client, data);
    client.emit(Events.BridgeMessageCreate, message, { bridge, replyExternal });
  } catch (error) {
    debug(client, `Dropped BRIDGE_MESSAGE_CREATE for room ${data.room_id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** `BRIDGE_MESSAGE_UPDATE`: patches the message and emits `bridgeMessageUpdate` with its copies. @internal */
export async function bridgeMessageUpdate(client: Client, data: GatewayBridgeMessageUpdateData, envelope: GatewayEnvelope): Promise<void> {
  const bridge = bridgeOf(client, data.bridge_id, data.room_id, envelope);
  try {
    const { message, replyExternal } = await feedMessage(client, data);
    client.emit(Events.BridgeMessageUpdate, message, { bridge, replyExternal, external: data.external.map(externalRef) });
  } catch (error) {
    debug(client, `Dropped BRIDGE_MESSAGE_UPDATE for room ${data.room_id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** `BRIDGE_MESSAGE_DELETE`: emits `bridgeMessageDelete` with the copies to remove. @internal */
export async function bridgeMessageDelete(client: Client, data: GatewayBridgeMessageDeleteData, envelope: GatewayEnvelope): Promise<void> {
  const bridge = bridgeOf(client, data.bridge_id, data.room_id, envelope);
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const message = (room.messages.cache.get(data.message_id) ?? room.messages._add({ id: data.message_id, room_id: room.id }, false)) as Message | PartialMessage;
  client.emit(Events.BridgeMessageDelete, message, { bridge, external: data.external.map(externalRef), byModerator: data.by_moderator });
}

async function reaction(client: Client, data: GatewayBridgeReactionData, envelope: GatewayEnvelope, added: boolean): Promise<void> {
  const bridge = bridgeOf(client, data.bridge_id, data.room_id, envelope);
  const room = await textRoomOf(client, data, envelope);
  if (!room) return;
  const message = (room.messages.cache.get(data.message_id) ?? room.messages._add({ id: data.message_id, room_id: room.id }, false)) as Message | PartialMessage;
  const { puppet } = data.user;
  // Another bridge's bridged user is not an account: never cached.
  const user = puppet ? new User(client, { ...data.user, bot: true }) : client.users._add(data.user);
  const details = {
    bridge,
    message,
    emoji: data.emoji,
    user,
    puppet: puppet ? { bridgeId: puppet.bridge_id, puppetId: puppet.puppet_id, platform: puppet.platform, platformName: puppet.platform_name } : null,
    external: data.external.map(externalRef),
  };
  client.emit(added ? Events.BridgeReactionAdd : Events.BridgeReactionRemove, details);
}

/** `BRIDGE_REACTION_ADD`. @internal */
export function bridgeReactionAdd(client: Client, data: GatewayBridgeReactionData, envelope: GatewayEnvelope): Promise<void> {
  return reaction(client, data, envelope, true);
}

/** `BRIDGE_REACTION_REMOVE`. @internal */
export function bridgeReactionRemove(client: Client, data: GatewayBridgeReactionData, envelope: GatewayEnvelope): Promise<void> {
  return reaction(client, data, envelope, false);
}

/** `BRIDGE_OPTOUT`: emits `bridgeOptOut` with the copies to delete. @internal */
export function bridgeOptOut(client: Client, data: GatewayBridgeOptOutData, envelope: GatewayEnvelope): void {
  const bridge = bridgeOf(client, data.bridge_id, nonEmpty(envelope.room_id), envelope);
  client.emit(Events.BridgeOptOut, {
    bridge,
    userId: data.user_id,
    external: data.external.map((entry) => ({ ...externalRef(entry), messageId: entry.message_id })),
  });
}

function puppetBlock(client: Client, data: GatewayBridgePuppetBlockData, envelope: GatewayEnvelope, blocked: boolean): void {
  const bridge = bridgeOf(client, data.bridge_id, nonEmpty(envelope.room_id), envelope);
  client.emit(blocked ? Events.BridgePuppetBlock : Events.BridgePuppetUnblock, { bridge, puppetId: data.puppet_id, externalUserId: data.external_user_id });
}

/** `BRIDGE_PUPPET_BLOCK`. @internal */
export function bridgePuppetBlock(client: Client, data: GatewayBridgePuppetBlockData, envelope: GatewayEnvelope): void {
  puppetBlock(client, data, envelope, true);
}

/** `BRIDGE_PUPPET_UNBLOCK`. @internal */
export function bridgePuppetUnblock(client: Client, data: GatewayBridgePuppetBlockData, envelope: GatewayEnvelope): void {
  puppetBlock(client, data, envelope, false);
}

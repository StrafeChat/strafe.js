import { Routes } from '../../rest/Routes.js';
import type { APIBridge, APIBridgeSummary } from '../../types/api/bridge.js';
import type { APIWebhook } from '../../types/api/webhook.js';
import { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Bridge, BridgeCreateOptions } from '../Bridge.js';
import { bridgeCreateBody } from '../Bridge.js';
import type { WebhookCreateOptions } from '../Webhook.js';
import { Webhook, webhookBody } from '../Webhook.js';
import type { TextRoom } from './TextRoom.js';
import type { VoiceRoom } from './VoiceRoom.js';

/**
 * `POST /rooms/:id/webhooks`.
 *
 * @internal
 */
export async function createWebhook(room: TextRoom | VoiceRoom, options: WebhookCreateOptions): Promise<Webhook> {
  const body = await webhookBody(room.client, options);
  return new Webhook(room.client, await room.client.rest.post<APIWebhook>(Routes.roomWebhooks(room.id), { body }));
}

/**
 * `GET /rooms/:id/webhooks`.
 *
 * @internal
 */
export async function fetchWebhooks(room: TextRoom | VoiceRoom): Promise<Collection<Snowflake, Webhook>> {
  const list = await room.client.rest.get<APIWebhook[]>(Routes.roomWebhooks(room.id));
  return new Collection(list.map((data) => [data.id, new Webhook(room.client, data)] as const));
}

/**
 * `POST /rooms/:id/bridges`.
 *
 * @internal
 */
export async function createBridge(room: TextRoom, options: BridgeCreateOptions): Promise<Bridge> {
  const body = await bridgeCreateBody(room.client, options);
  return room.client.bridges._add(await room.client.rest.post<APIBridge>(Routes.roomBridges(room.id), { body }), room);
}

/**
 * `GET /rooms/:id/bridges`.
 *
 * @internal
 */
export async function fetchBridges(room: TextRoom): Promise<Collection<Snowflake, Bridge>> {
  const list = await room.client.rest.get<APIBridgeSummary[]>(Routes.roomBridges(room.id));
  room._setBridges(list);
  return room.bridges.clone();
}

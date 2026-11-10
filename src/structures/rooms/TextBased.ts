import { BulkDeleteError } from '../../errors/BulkDeleteError.js';
import { ErrorCodes } from '../../errors/ErrorCodes.js';
import { StrafeRangeError } from '../../errors/StrafeError.js';
import { Routes } from '../../rest/Routes.js';
import type { APIMessage } from '../../types/api/message.js';
import { Collection } from '../../util/Collection.js';
import type { Snowflake } from '../../util/Snowflake.js';
import type { Message } from '../Message.js';
import type { MessageCreateOptions, MessageResolvable } from '../MessagePayload.js';
import { assertSendable, linkEmbedAttachments, resolveMessageCreate, uploadFiles } from '../MessagePayload.js';
import type { TextBasedRoom } from './index.js';

/**
 * Sends a message: checks it locally, uploads its files, then posts it.
 *
 * @internal
 */
export async function sendMessage(room: TextBasedRoom, options: string | MessageCreateOptions): Promise<Message> {
  assertSendable(room);
  const { body, files } = resolveMessageCreate(room.client, options);
  if (files.length > 0) {
    const uploads = await uploadFiles(room.client, room.id, files);
    body.attachments = uploads.map((upload) => upload.attachment.id);
    if (body.embeds) linkEmbedAttachments(body.embeds, uploads);
  }
  const data = await room.client.rest.post<APIMessage>(Routes.roomMessages(room.id), { body });
  return room.messages._add(data);
}

/**
 * Shows "typing..." for about 5 seconds (the server sends at most one typing event per user per
 * room every 5 s).
 *
 * @internal
 */
export async function sendTyping(room: TextBasedRoom): Promise<void> {
  await room.client.rest.post(Routes.roomTyping(room.id));
}

/** The most messages `bulkDelete()` deletes in one call. */
export const MaxBulkDelete = 100;

/**
 * Deletes several messages. Strafe has no bulk-delete endpoint, so this sends one `DELETE` per
 * message (through the rate limiter, so a large batch takes a while).
 *
 * @internal
 */
export async function bulkDelete(
  room: TextBasedRoom,
  messages: number | Collection<Snowflake, Message> | readonly MessageResolvable[],
): Promise<Collection<Snowflake, Message | Snowflake>> {
  let targets: MessageResolvable[];
  if (typeof messages === 'number') {
    if (!Number.isInteger(messages) || messages < 1 || messages > MaxBulkDelete) throw new StrafeRangeError(ErrorCodes.BulkDeleteLimit);
    targets = [...(await room.messages.fetch({ limit: messages })).values()];
  } else {
    targets = messages instanceof Collection ? [...messages.values()] : [...messages];
    if (targets.length > MaxBulkDelete) throw new StrafeRangeError(ErrorCodes.BulkDeleteLimit);
  }
  const deleted = new Collection<Snowflake, Message | Snowflake>();
  const failed = new Collection<Snowflake, unknown>();
  await Promise.all(
    targets.map(async (target) => {
      const id = typeof target === 'string' ? target : target.id;
      try {
        await room.messages.delete(id);
        deleted.set(id, typeof target === 'string' ? (room.messages.cache.get(id) ?? id) : target);
      } catch (error) {
        failed.set(id, error);
      }
    }),
  );
  if (failed.size > 0) throw new BulkDeleteError(deleted, failed);
  return deleted;
}

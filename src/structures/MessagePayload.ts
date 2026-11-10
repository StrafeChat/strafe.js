import { AttachmentBuilder } from '../builders/AttachmentBuilder.js';
import type { AttachmentPayload } from '../builders/AttachmentBuilder.js';
import type { EmbedData } from '../builders/EmbedBuilder.js';
import { embedDataToAPI, validateEmbeds } from '../builders/EmbedBuilder.js';
import type { Client } from '../client/Client.js';
import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeRangeError, StrafeTypeError } from '../errors/StrafeError.js';
import { Routes } from '../rest/Routes.js';
import type { RawFile } from '../rest/types.js';
import type { APIAttachment, APIEmbed } from '../types/api/message.js';
import type { RESTPatchAPIRoomMessageJSONBody, RESTPostAPIRoomMessageJSONBody } from '../types/api/rest.js';
import { RoomType } from '../types/api/room.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import { resolveFile } from '../util/DataResolver.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { JSONEncodable } from '../util/Util.js';
import { codePointLength, isJSONEncodable } from '../util/Util.js';
import { Attachment } from './Attachment.js';
import type { Message } from './Message.js';
import type { BaseRoom } from './rooms/BaseRoom.js';

/** The longest message text, in code points. */
export const MaxMessageLength = 4000;
/** The most files on one message. */
export const MaxMessageAttachments = 10;

/** An embed to send: an {@link EmbedBuilder}, a received {@link Embed}, camelCase {@link EmbedData} or wire data. */
export type EmbedResolvable = APIEmbed | EmbedData | JSONEncodable<APIEmbed>;

/**
 * A file to send: an {@link AttachmentBuilder}, `{ attachment, name }`, a received
 * {@link Attachment} (downloaded and uploaded again), or the file itself ({@link BufferResolvable}).
 */
export type FileResolvable = AttachmentBuilder | AttachmentPayload | Attachment | BufferResolvable;

/** A message or its id. */
export type MessageResolvable = Message | Snowflake;

/**
 * What every send and reply takes. There is no `allowedMentions`: Strafe finds mentions in the
 * text itself and has no way to suppress a ping, so the option would be a promise the library
 * cannot keep. Use {@link escapeMentions} on text you did not write.
 */
export interface BaseMessageOptions {
  /** The text (at most 4000 characters, counted in code points). Mentions in it notify. */
  content?: string | null | undefined;
  /** Embeds (bots only, at most 10, Embed Links permission, rooms that are not end-to-end encrypted). */
  embeds?: readonly EmbedResolvable[] | undefined;
  /** Files (at most 10). Each is uploaded to the room first; embeds can show them with `attachment://<name>`. */
  files?: readonly FileResolvable[] | undefined;
}

/** Makes the message a reply. */
export interface ReplyOptions {
  /** The message replied to (in the same room). */
  messageReference: MessageResolvable;
}

/** What `room.send()` takes. */
export interface MessageCreateOptions extends BaseMessageOptions {
  /** Reply to a message of the same room. */
  reply?: ReplyOptions | undefined;
}

/** What `message.reply()` takes. */
export type MessageReplyOptions = BaseMessageOptions;

/**
 * What `message.edit()` takes. Only your own messages can be edited, and only their text and
 * embeds: files cannot be added or removed, and an empty `content` keeps the old text (the text
 * cannot be cleared).
 */
export interface MessageEditOptions {
  /** New text; `null`, `undefined` or `''` keeps the current text. */
  content?: string | null | undefined;
  /** New embeds; `[]` or `null` removes them; `undefined` keeps them. */
  embeds?: readonly EmbedResolvable[] | null | undefined;
}

/** A prepared message: the JSON body and the files still to upload. */
export interface ResolvedMessage {
  /** The body (without `attachments`, which come from the uploads). */
  body: RESTPostAPIRoomMessageJSONBody;
  /** Files to upload first, in order. */
  files: { file: FileResolvable; name: string | undefined; width: number | undefined; height: number | undefined }[];
}

/**
 * Turns embeds of any accepted form into wire embeds and checks them all together.
 *
 * @param embeds - The embeds.
 * @throws {@link StrafeRangeError} `EmbedInvalid`.
 */
export function resolveEmbeds(embeds: readonly EmbedResolvable[]): APIEmbed[] {
  const out = embeds.map((embed) => {
    const raw = isJSONEncodable<APIEmbed>(embed) ? (embed as { data?: APIEmbed }).data ?? embed.toJSON() : embed;
    const data = embedDataToAPI(raw);
    delete data.type;
    return data;
  });
  validateEmbeds(out);
  return out;
}

/**
 * Throws when the client cannot post in `room`: an end-to-end encrypted room (or any 1:1 PM),
 * which the server would refuse anyway.
 *
 * @internal
 */
export function assertSendable(room: BaseRoom): void {
  if (!room.isTextBased()) throw new StrafeTypeError(ErrorCodes.RoomNotTextBased);
  if (room.type === RoomType.PM) throw new StrafeError(ErrorCodes.PMsEncrypted);
  if (room.isEncrypted()) throw new StrafeError(ErrorCodes.RoomEncrypted);
}

function warnAllowedMentions(client: Client, options: object): void {
  if (!('allowedMentions' in options) || client._warnedAllowedMentions) return;
  client._warnedAllowedMentions = true;
  client.emit(
    'warn',
    'allowedMentions is not supported: Strafe finds mentions in the message text and cannot suppress them. Use escapeMentions() on text you did not write.',
  );
}

/**
 * Checks and splits send options into a body and files, without any request.
 *
 * @param client - The client (for warnings).
 * @param options - A string or {@link MessageCreateOptions}.
 * @throws {@link StrafeError} `MessageEmpty`, {@link StrafeRangeError} `MessageTooLarge` or `EmbedInvalid`.
 */
export function resolveMessageCreate(client: Client, options: string | MessageCreateOptions): ResolvedMessage {
  const data: MessageCreateOptions = typeof options === 'string' ? { content: options } : options;
  warnAllowedMentions(client, data);
  const body: RESTPostAPIRoomMessageJSONBody = {};
  const content = data.content ?? '';
  if (content !== '') {
    const length = codePointLength(content);
    if (length > MaxMessageLength) throw new StrafeRangeError(ErrorCodes.MessageTooLarge, `${length} characters (at most ${MaxMessageLength})`);
    body.plaintext = content;
  }
  if (data.embeds && data.embeds.length > 0) body.embeds = resolveEmbeds(data.embeds);
  const files = (data.files ?? []).map(describeFile);
  if (files.length > MaxMessageAttachments) {
    throw new StrafeRangeError(ErrorCodes.MessageTooLarge, `${files.length} files (at most ${MaxMessageAttachments})`);
  }
  if (data.reply) {
    const reference = data.reply.messageReference;
    body.reply_to_id = typeof reference === 'string' ? reference : reference.id;
  }
  if (body.plaintext === undefined && body.embeds === undefined && files.length === 0) throw new StrafeError(ErrorCodes.MessageEmpty);
  return { body, files };
}

/**
 * Checks edit options and builds the `PATCH` body.
 *
 * @param client - The client (for warnings).
 * @param options - A string or {@link MessageEditOptions}.
 */
export function resolveMessageEdit(client: Client, options: string | MessageEditOptions): RESTPatchAPIRoomMessageJSONBody {
  const data: MessageEditOptions = typeof options === 'string' ? { content: options } : options;
  warnAllowedMentions(client, data);
  if ('files' in data || 'attachments' in data) {
    throw new StrafeError(ErrorCodes.Unsupported, 'Changing the files of a sent message', 'only the text and embeds can be edited');
  }
  const body: RESTPatchAPIRoomMessageJSONBody = {};
  if (data.content !== undefined && data.content !== null && data.content !== '') {
    const length = codePointLength(data.content);
    if (length > MaxMessageLength) throw new StrafeRangeError(ErrorCodes.MessageTooLarge, `${length} characters (at most ${MaxMessageLength})`);
    body.plaintext = data.content;
  }
  if (data.embeds === null) body.embeds = [];
  else if (data.embeds !== undefined) body.embeds = data.embeds.length === 0 ? [] : resolveEmbeds(data.embeds);
  return body;
}

function describeFile(file: FileResolvable): ResolvedMessage['files'][number] {
  if (file instanceof AttachmentBuilder) return { file: file.attachment, name: file.name, width: file.width, height: file.height };
  if (file instanceof Attachment) {
    return { file: file.url, name: file.name ?? undefined, width: file.width ?? undefined, height: file.height ?? undefined };
  }
  if (typeof file === 'object' && !(file instanceof Blob) && !(file instanceof URL) && !ArrayBuffer.isView(file) && 'attachment' in file) {
    return { file: file.attachment, name: file.name, width: file.width, height: file.height };
  }
  return { file, name: undefined, width: undefined, height: undefined };
}

/** The file name the server stores (it replaces characters outside `A-Za-z0-9._-`). */
function storedName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180);
}

/**
 * Uploads files to a room (`POST /rooms/:id/attachments`), three at a time, keeping their order.
 *
 * @param client - The client.
 * @param roomId - The room.
 * @param files - The files.
 * @internal
 */
export async function uploadFiles(client: Client, roomId: Snowflake, files: ResolvedMessage['files']): Promise<{ name: string; attachment: APIAttachment }[]> {
  const results = new Array<{ name: string; attachment: APIAttachment }>(files.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const index = next++;
      const entry = files[index];
      if (!entry) continue;
      const resolved = await resolveFile(entry.file as BufferResolvable, entry.name, client.rest.options.makeRequest);
      const raw: RawFile = { name: resolved.name, data: resolved.data, key: 'file' };
      if (resolved.contentType !== undefined) raw.contentType = resolved.contentType;
      const fields: Record<string, number> = {};
      if (entry.width !== undefined && entry.height !== undefined) {
        fields.width = entry.width;
        fields.height = entry.height;
      }
      const attachment = await client.rest.post<APIAttachment>(Routes.roomAttachments(roomId), { files: [raw], body: fields });
      results[index] = { name: resolved.name, attachment };
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return results;
}

/**
 * Points `attachment://<name>` references in embeds at the uploaded attachments' ids, so two files
 * with the same name, or a name the server rewrites, still resolve.
 *
 * @internal
 */
export function linkEmbedAttachments(embeds: APIEmbed[], uploads: readonly { name: string; attachment: APIAttachment }[]): void {
  const byName = new Map<string, string>();
  for (const { name, attachment } of uploads) {
    if (!byName.has(name)) byName.set(name, attachment.id);
    const stored = attachment.filename ?? storedName(name);
    if (!byName.has(stored)) byName.set(stored, attachment.id);
  }
  const fix = (url: string | undefined): string | undefined => {
    if (url === undefined) return url;
    const match = /^attachment:\/\/(.+)$/i.exec(url.trim());
    if (!match) return url;
    const id = byName.get(match[1] ?? '');
    return id === undefined ? url : `attachment://${id}`;
  };
  for (const embed of embeds) {
    if (embed.image) embed.image.url = fix(embed.image.url) ?? embed.image.url;
    if (embed.thumbnail) embed.thumbnail.url = fix(embed.thumbnail.url) ?? embed.thumbnail.url;
    if (embed.author?.icon_url !== undefined) embed.author.icon_url = fix(embed.author.icon_url) ?? '';
    if (embed.footer?.icon_url !== undefined) embed.footer.icon_url = fix(embed.footer.icon_url) ?? '';
  }
}

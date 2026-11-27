import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeRangeError, StrafeTypeError } from '../errors/StrafeError.js';
import { toBlob } from '../rest/multipart.js';
import type { REST } from '../rest/REST.js';
import { Routes } from '../rest/Routes.js';
import type { FetchLike, RawFile, RequestData, RouteLike } from '../rest/types.js';
import type { APIMessage } from '../types/api/message.js';
import type { AllowedMentionsType, APIAllowedMentions, RESTPatchAPIWebhookMessageJSONBody, RESTPostAPIWebhookExecuteJSONBody } from '../types/api/webhook.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import { contentTypeFor, resolveFile } from '../util/DataResolver.js';
import type { Snowflake } from '../util/Snowflake.js';
import { codePointLength } from '../util/Util.js';
import { Attachment } from './Attachment.js';
import type { EmbedResolvable, FileResolvable } from './MessagePayload.js';
import { MaxMessageAttachments, MaxMessageLength, describeFile, resolveEmbeds } from './MessagePayload.js';

/**
 * Which mentions in a webhook's (or bridge's) text notify, Discord's `allowedMentions`. Leaving
 * it out notifies users, roles and `@everyone` alike; `{ parse: [] }` notifies nobody. On top of
 * it, `@everyone` and roles notify only when the webhook has `massMentions`.
 *
 * Only webhook sends take it: an ordinary `room.send()` has no allowed mentions on Strafe.
 */
export interface AllowedMentions {
  /** Kinds that notify: `'users'`, `'roles'`, `'everyone'`. */
  parse?: readonly AllowedMentionsType[] | undefined;
  /** Users that may be notified (up to 100; not with `'users'` in `parse`). */
  users?: readonly Snowflake[] | undefined;
  /** Roles that may be notified (up to 100; not with `'roles'` in `parse`). */
  roles?: readonly Snowflake[] | undefined;
  /** Whether a reply notifies the author of the message it answers. */
  repliedUser?: boolean | undefined;
}

/** What `webhook.send()` and `webhookClient.send()` take: discord.js's `WebhookMessageCreateOptions`. */
export interface WebhookMessageCreateOptions {
  /** Text (at most 4000 code points). */
  content?: string | null | undefined;
  /** Post under this name instead of the webhook's (1-80; no reserved, staff or role names). */
  username?: string | undefined;
  /** Post with this picture: an `https://` URL (readers load it through the instance's image proxy). */
  avatarURL?: string | undefined;
  /** Embeds (at most 10). A webhook needs no Embed Links bit. */
  embeds?: readonly EmbedResolvable[] | undefined;
  /** Files (at most 10), uploaded with the message; embeds can show them with `attachment://<name>`. */
  files?: readonly FileResolvable[] | undefined;
  /** Which mentions notify. */
  allowedMentions?: AllowedMentions | undefined;
  /** Post into this thread of the webhook's room (an archived one is unarchived). */
  threadId?: Snowflake | undefined;
  /**
   * Wait for the message and return it (default `true`, as discord.js does). With `false` the
   * server answers before the message is returned and nothing comes back.
   */
  wait?: boolean | undefined;
  /** {@link WebhookMessageFlags}: `SuppressNotifications` (no badges, no push), `SuppressEmbeds` (ignored). */
  flags?: number | undefined;
  /** Accepted and ignored, as on Strafe's server. */
  tts?: boolean | undefined;
}

/** What `webhook.editMessage()` takes. */
export interface WebhookMessageEditOptions {
  /** New text. */
  content?: string | null | undefined;
  /** New embeds; `[]` or `null` removes them. */
  embeds?: readonly EmbedResolvable[] | null | undefined;
  /** New files, added to the ones kept. */
  files?: readonly FileResolvable[] | undefined;
  /** The files to keep (attachments or their ids); left out keeps every file. */
  attachments?: readonly (Attachment | Snowflake)[] | undefined;
  /** Which mentions notify (they are parsed and filtered again). */
  allowedMentions?: AllowedMentions | undefined;
  /** The thread the message is in. */
  threadId?: Snowflake | undefined;
}

/** Options of `webhook.fetchMessage()` and `deleteMessage()`. */
export interface WebhookFetchMessageOptions {
  /** The thread the message is in. */
  threadId?: Snowflake | undefined;
}

/**
 * Turns {@link AllowedMentions} into the wire object.
 *
 * @param mentions - The allowed mentions.
 */
export function resolveAllowedMentions(mentions: AllowedMentions): APIAllowedMentions {
  const out: APIAllowedMentions = {};
  if (mentions.parse !== undefined) out.parse = [...mentions.parse];
  if (mentions.users !== undefined) out.users = [...mentions.users];
  if (mentions.roles !== undefined) out.roles = [...mentions.roles];
  if (mentions.repliedUser !== undefined) out.replied_user = mentions.repliedUser;
  for (const kind of ['users', 'roles'] as const) {
    if (out.parse?.includes(kind) === true && out[kind] !== undefined) {
      throw new StrafeTypeError(ErrorCodes.InvalidArgument, `allowedMentions cannot list ${kind} both in parse and by id.`);
    }
    if ((out[kind]?.length ?? 0) > 100) throw new StrafeRangeError(ErrorCodes.InvalidArgument, `allowedMentions.${kind} holds at most 100 ids.`);
  }
  return out;
}

function checkContent(content: string): void {
  const length = codePointLength(content);
  if (length > MaxMessageLength) throw new StrafeRangeError(ErrorCodes.MessageTooLarge, `${length} characters (at most ${MaxMessageLength})`);
}

/**
 * Reads files into multipart parts named `files[0]`, `files[1]`... (Discord's form).
 *
 * @internal
 */
export async function resolveSendFiles(files: readonly FileResolvable[], fetchImpl: FetchLike | undefined): Promise<RawFile[]> {
  if (files.length > MaxMessageAttachments) {
    throw new StrafeRangeError(ErrorCodes.MessageTooLarge, `${files.length} files (at most ${MaxMessageAttachments})`);
  }
  return Promise.all(
    files.map(async (file, index) => {
      const entry = describeFile(file);
      const resolved = await resolveFile(entry.file as BufferResolvable, entry.name, fetchImpl);
      const raw: RawFile = { name: resolved.name, data: resolved.data, key: `files[${index}]` };
      if (resolved.contentType !== undefined) raw.contentType = resolved.contentType;
      return raw;
    }),
  );
}

/**
 * A JSON body, or with files a `payload_json` part beside them (Discord's multipart form, which
 * Strafe's webhook and bridge routes read).
 *
 * @internal
 */
export function withFiles(body: object, files: readonly RawFile[]): Pick<RequestData, 'body' | 'files'> {
  if (files.length === 0) return { body };
  return { files, body: { payload_json: JSON.stringify(body) } };
}

/**
 * Checks webhook send options and builds the execute body.
 *
 * @param options - Text or options.
 * @internal
 */
export function resolveWebhookCreate(options: string | WebhookMessageCreateOptions): { body: RESTPostAPIWebhookExecuteJSONBody; options: WebhookMessageCreateOptions } {
  const data: WebhookMessageCreateOptions = typeof options === 'string' ? { content: options } : options;
  const body: RESTPostAPIWebhookExecuteJSONBody = {};
  if (data.content !== undefined && data.content !== null && data.content !== '') {
    checkContent(data.content);
    body.content = data.content;
  }
  if (data.username !== undefined) body.username = data.username;
  if (data.avatarURL !== undefined) body.avatar_url = data.avatarURL;
  if (data.embeds && data.embeds.length > 0) body.embeds = resolveEmbeds(data.embeds);
  if (data.allowedMentions !== undefined) body.allowed_mentions = resolveAllowedMentions(data.allowedMentions);
  if (data.flags !== undefined) body.flags = data.flags;
  if (data.tts !== undefined) body.tts = data.tts;
  if (body.content === undefined && body.embeds === undefined && (data.files?.length ?? 0) === 0) throw new StrafeError(ErrorCodes.MessageEmpty);
  return { body, options: data };
}

/**
 * Checks webhook edit options and builds the `PATCH` body.
 *
 * @param options - Text or options.
 * @internal
 */
export function resolveWebhookEdit(options: string | WebhookMessageEditOptions): { body: RESTPatchAPIWebhookMessageJSONBody; options: WebhookMessageEditOptions } {
  const data: WebhookMessageEditOptions = typeof options === 'string' ? { content: options } : options;
  const body: RESTPatchAPIWebhookMessageJSONBody = {};
  if (data.content !== undefined && data.content !== null) {
    checkContent(data.content);
    body.content = data.content;
  }
  if (data.embeds === null) body.embeds = [];
  else if (data.embeds !== undefined) body.embeds = data.embeds.length === 0 ? [] : resolveEmbeds(data.embeds);
  if (data.allowedMentions !== undefined) body.allowed_mentions = resolveAllowedMentions(data.allowedMentions);
  if (data.attachments !== undefined) body.attachments = data.attachments.map((a) => ({ id: a instanceof Attachment ? a.id : a }));
  return { body, options: data };
}

/** Image types a webhook or bridge avatar may be. */
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/**
 * Turns an image into the `data:` URI webhook and bridge routes take for `avatar`: a `data:` URI
 * is passed through, anything else is read (a URL is downloaded) and encoded.
 *
 * @param image - The image.
 * @param fetchImpl - The `fetch` used to download URLs.
 * @internal
 */
export async function resolveImageDataURI(image: BufferResolvable, fetchImpl: FetchLike | undefined): Promise<string> {
  if (typeof image === 'string' && image.startsWith('data:')) return image;
  const resolved = await resolveFile(image, undefined, fetchImpl);
  const blob = await toBlob(resolved.data);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const type = [resolved.contentType, blob.type, contentTypeFor(resolved.name), sniffImage(bytes)].find(
    (candidate): candidate is string => candidate !== undefined && AVATAR_TYPES.has(candidate),
  );
  if (type === undefined) throw new StrafeTypeError(ErrorCodes.FileInvalid, 'an avatar must be a PNG, JPEG, GIF or WebP image');
  return `data:${type};base64,${base64(bytes)}`;
}

function sniffImage(bytes: Uint8Array): string | undefined {
  const starts = (...sig: number[]): boolean => sig.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return undefined;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * The query of an execute or a message route.
 *
 * @internal
 */
export function webhookQuery(wait: boolean | undefined, threadId: Snowflake | undefined): Record<string, string | undefined> {
  return { wait: wait === undefined ? undefined : String(wait), thread_id: threadId };
}

/**
 * How a webhook request authenticates: its token in the `Authorization: Webhook` header (the
 * default), its token in the path (Discord's URL form), or, with no token, the bot that made it.
 *
 * @internal
 */
export interface WebhookCredentials {
  /** The webhook. */
  id: Snowflake;
  /** Its token, or `null` to use the REST client's own (bot) token. */
  token: string | null;
  /** Put the token in the path instead of the header. */
  tokenInURL: boolean;
}

/** The route and auth of a webhook request. @internal */
export function webhookRoute(credentials: WebhookCredentials, messageId?: Snowflake): Pick<RequestData, 'auth'> & { route: RouteLike } {
  const { id, token, tokenInURL } = credentials;
  const pathToken = token !== null && tokenInURL ? token : undefined;
  const route = messageId === undefined ? Routes.webhook(id, pathToken) : Routes.webhookMessage(id, messageId, pathToken);
  if (token === null) return { route };
  return { route, auth: tokenInURL ? false : { prefix: 'Webhook', token } };
}

/**
 * Executes a webhook: `POST /webhooks/:id` with the body and files. Resolves with the message, or
 * `undefined` with `wait: false`.
 *
 * @internal
 */
export async function executeWebhook(rest: REST, credentials: WebhookCredentials, options: string | WebhookMessageCreateOptions): Promise<APIMessage | undefined> {
  const { body, options: data } = resolveWebhookCreate(options);
  const files = await resolveSendFiles(data.files ?? [], rest.options.makeRequest);
  const { route, auth } = webhookRoute(credentials);
  const wait = data.wait ?? true;
  const result = await rest.post<APIMessage | undefined>(route, { ...withFiles(body, files), ...(auth === undefined ? {} : { auth }), query: webhookQuery(wait, data.threadId) });
  return wait ? result : undefined;
}

/** `GET /webhooks/:id[/:token]/messages/:messageId`. @internal */
export function fetchWebhookMessage(rest: REST, credentials: WebhookCredentials, messageId: Snowflake, options: WebhookFetchMessageOptions = {}): Promise<APIMessage> {
  const { route, auth } = webhookRoute(credentials, messageId);
  return rest.get<APIMessage>(route, { ...(auth === undefined ? {} : { auth }), query: webhookQuery(undefined, options.threadId) });
}

/** `PATCH /webhooks/:id[/:token]/messages/:messageId`. @internal */
export async function editWebhookMessage(
  rest: REST,
  credentials: WebhookCredentials,
  messageId: Snowflake,
  options: string | WebhookMessageEditOptions,
): Promise<APIMessage> {
  const { body, options: data } = resolveWebhookEdit(options);
  const files = await resolveSendFiles(data.files ?? [], rest.options.makeRequest);
  const { route, auth } = webhookRoute(credentials, messageId);
  return rest.patch<APIMessage>(route, { ...withFiles(body, files), ...(auth === undefined ? {} : { auth }), query: webhookQuery(undefined, data.threadId) });
}

/** `DELETE /webhooks/:id[/:token]/messages/:messageId`. @internal */
export async function deleteWebhookMessage(rest: REST, credentials: WebhookCredentials, messageId: Snowflake, options: WebhookFetchMessageOptions = {}): Promise<void> {
  const { route, auth } = webhookRoute(credentials, messageId);
  await rest.delete(route, { ...(auth === undefined ? {} : { auth }), query: webhookQuery(undefined, options.threadId) });
}

import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeTypeError } from '../errors/StrafeError.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { RouteLike } from './types.js';

const SNOWFLAKE = /^\d{1,20}$/;

/** A path segment that is already encoded and checked (an emoji or an invite code). */
class Segment {
  public constructor(public readonly value: string) {}
}

/**
 * Builds a path, checking every interpolated id: a decimal snowflake or `@me`, nothing else. An id
 * is often user input (`space.members.kick(args[0])`), and `fetch` resolves `..` and `\`, so
 * `../rooms/1` would otherwise reach another endpoint with the bot's permissions.
 */
function path(strings: TemplateStringsArray, ...values: readonly (Snowflake | Segment)[]): RouteLike {
  let out = strings[0] ?? '';
  values.forEach((value, index) => {
    out += value instanceof Segment ? value.value : checkId(value);
    out += strings[index + 1] ?? '';
  });
  return out as RouteLike;
}

function checkId(id: unknown): string {
  if (typeof id === 'string' && (SNOWFLAKE.test(id) || id === '@me')) return id;
  throw new StrafeTypeError(ErrorCodes.IdInvalid, id);
}

/** Percent-encodes a segment; `.` and `..` survive encoding and would move up the path, so they are refused. */
function encodeSegment(value: string): string | null {
  const encoded = encodeURIComponent(value);
  return encoded === '' || encoded === '.' || encoded === '..' ? null : encoded;
}

/**
 * Turns a reaction emoji into the path segment Strafe expects: a unicode emoji percent-encoded, or
 * `custom:<id>` for a custom emoji. Accepts `<:name:id>`, `<a:name:id>`, `name:id`, `custom:id`, a
 * bare id or a unicode emoji.
 *
 * @param emoji - The emoji.
 * @throws {@link StrafeTypeError} `EmojiInvalid` for an empty emoji, `.` or `..`.
 */
export function reactionEmojiSegment(emoji: string): string {
  const trimmed = typeof emoji === 'string' ? emoji.trim() : '';
  const custom = /^<a?:\w*:(\d+)>$/.exec(trimmed) ?? /^(?:\w+:|custom:)?(\d{5,20})$/.exec(trimmed);
  if (custom) return `custom:${custom[1] ?? ''}`;
  const encoded = encodeSegment(trimmed);
  if (encoded === null) throw new StrafeTypeError(ErrorCodes.EmojiInvalid, emoji);
  return encoded;
}

function emojiSegment(emoji: string): Segment {
  return new Segment(reactionEmojiSegment(emoji));
}

function codeSegment(code: string): Segment {
  const encoded = typeof code === 'string' ? encodeSegment(code) : null;
  if (encoded === null) throw new StrafeTypeError(ErrorCodes.InviteInvalid, code);
  return new Segment(encoded);
}

/** A webhook token: `swh_` + base64url on Strafe (letters, digits, `_`, `-`, `.` for Discord-style tokens). */
const WEBHOOK_TOKEN = /^[A-Za-z0-9_.-]{1,256}$/;

function tokenSegment(token: string): Segment {
  if (typeof token !== 'string' || !WEBHOOK_TOKEN.test(token) || token === '.' || token === '..') {
    throw new StrafeTypeError(ErrorCodes.InvalidArgument, 'A webhook token holds only letters, digits, "_", "-" and ".".');
  }
  return new Segment(token);
}

/** An id on another platform (an external message or user id), percent-encoded. */
function externalSegment(value: string): Segment {
  const encoded = typeof value === 'string' && value.length > 0 && value.length <= 256 ? encodeSegment(value) : null;
  if (encoded === null) throw new StrafeTypeError(ErrorCodes.InvalidArgument, `Invalid external id ${JSON.stringify(value)} (1-256 characters, not "." or "..").`);
  return new Segment(encoded);
}

/** The `/webhooks/:id` or `/webhooks/:id/:token` base. */
function webhookBase(webhookId: Snowflake, token?: string): RouteLike {
  return token === undefined ? path`/webhooks/${webhookId}` : path`/webhooks/${webhookId}/${tokenSegment(token)}`;
}

/**
 * Paths of the Strafe REST API, relative to the API base, like `discord-api-types`' `Routes`.
 * Pass them to `rest.get/post/put/patch/delete`.
 *
 * Every id is checked: a decimal snowflake or `@me`, else a {@link StrafeTypeError} `IdInvalid`
 * (and `EmojiInvalid` / `InviteInvalid` for an emoji or code of `.` or `..`), so input such as
 * `../rooms/1` cannot reach another endpoint.
 *
 * @example
 * ```ts
 * await rest.post(Routes.roomMessages(roomId), { body: { plaintext: 'hi' } });
 * ```
 */
export const Routes = {
  /** `GET /` (instance index, no auth). */
  instance: (): RouteLike => '/',

  /** `GET`, `PATCH /users/@me`. */
  user: (userId: Snowflake = '@me'): RouteLike => path`/users/${userId}`,
  /** `POST /users/@me/avatar`. */
  userAvatar: (): RouteLike => '/users/@me/avatar',
  /** `POST /users/@me/banner`. */
  userBanner: (): RouteLike => '/users/@me/banner',
  /** `GET /users/@me/spaces`. */
  userSpaces: (): RouteLike => '/users/@me/spaces',

  /** `GET`, `POST /rooms` (your rooms; open a PM or group PM). */
  rooms: (): RouteLike => '/rooms',
  /** `GET`, `PATCH /rooms/:id`. */
  room: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}`,
  /** `POST /rooms/:id/participants`. */
  roomParticipants: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/participants`,
  /** `DELETE /rooms/:id/participants/:userId`. */
  roomParticipant: (roomId: Snowflake, userId: Snowflake): RouteLike => path`/rooms/${roomId}/participants/${userId}`,
  /** `POST /rooms/:id/typing`. */
  roomTyping: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/typing`,
  /** `POST /rooms/:id/ack`. */
  roomAck: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/ack`,
  /** `PATCH /rooms/:id/notify-settings`. */
  roomNotifySettings: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/notify-settings`,
  /** `GET`, `POST /rooms/:id/messages`. */
  roomMessages: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/messages`,
  /** `GET`, `PATCH`, `DELETE /rooms/:id/messages/:msgId`. */
  roomMessage: (roomId: Snowflake, messageId: Snowflake): RouteLike => path`/rooms/${roomId}/messages/${messageId}`,
  /** `GET /rooms/:id/messages/search`. */
  roomMessageSearch: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/messages/search`,
  /** `GET`, `PUT`, `DELETE /rooms/:id/messages/:msgId/reactions/:emoji` (emoji converted by {@link reactionEmojiSegment}). */
  roomMessageReaction: (roomId: Snowflake, messageId: Snowflake, emoji: string): RouteLike =>
    path`/rooms/${roomId}/messages/${messageId}/reactions/${emojiSegment(emoji)}`,
  /** `PUT`, `DELETE /rooms/:id/messages/:msgId/pin`. */
  roomMessagePin: (roomId: Snowflake, messageId: Snowflake): RouteLike => path`/rooms/${roomId}/messages/${messageId}/pin`,
  /** `POST /rooms/:id/messages/:msgId/threads` (start a thread from a message). */
  roomMessageThreads: (roomId: Snowflake, messageId: Snowflake): RouteLike => path`/rooms/${roomId}/messages/${messageId}/threads`,
  /** `GET /rooms/:id/pins`. */
  roomPins: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/pins`,
  /** `POST /rooms/:id/attachments`. */
  roomAttachments: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/attachments`,
  /** `POST /rooms/:id/threads`. */
  roomThreads: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/threads`,
  /** `GET /rooms/:id/threads/archived`. */
  roomArchivedThreads: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/threads/archived`,
  /** `GET`, `PATCH`, `DELETE /rooms/:id/thread` (the thread itself). */
  thread: (threadId: Snowflake): RouteLike => path`/rooms/${threadId}/thread`,
  /** `GET /rooms/:id/thread-members`. */
  threadMembers: (threadId: Snowflake): RouteLike => path`/rooms/${threadId}/thread-members`,
  /** `PUT`, `DELETE /rooms/:id/thread-members/:userId` (`@me` to join or leave). */
  threadMember: (threadId: Snowflake, userId: Snowflake = '@me'): RouteLike => path`/rooms/${threadId}/thread-members/${userId}`,
  /** `GET /rooms/:id/voice/states`. */
  roomVoiceStates: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/voice/states`,

  /** `GET`, `POST /spaces`. */
  spaces: (): RouteLike => '/spaces',
  /** `GET`, `PATCH`, `DELETE /spaces/:id`. */
  space: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}`,
  /** `POST /spaces/:id/icon`. */
  spaceIcon: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/icon`,
  /** `POST /spaces/:id/banner`. */
  spaceBanner: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/banner`,
  /** `POST /spaces/:id/leave`. */
  spaceLeave: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/leave`,
  /** `POST /spaces/:id/transfer-ownership`. */
  spaceTransferOwnership: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/transfer-ownership`,
  /** `GET /spaces/:id/audit-log`. */
  spaceAuditLog: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/audit-log`,
  /** `GET /spaces/:id/widget.json` (no auth). */
  spaceWidget: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/widget.json`,
  /** `GET /spaces/:id/messages/search`. */
  spaceMessageSearch: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/messages/search`,
  /** `GET /spaces/:id/threads/active`. */
  spaceActiveThreads: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/threads/active`,

  /** `GET /spaces/:id/members`. */
  spaceMembers: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/members`,
  /** `GET`, `PATCH`, `PUT`, `DELETE /spaces/:id/members/:userId` (`@me` for yourself). */
  spaceMember: (spaceId: Snowflake, userId: Snowflake): RouteLike => path`/spaces/${spaceId}/members/${userId}`,
  /** `POST /spaces/:id/members/@me/avatar`. */
  spaceMemberAvatar: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/members/@me/avatar`,
  /** `POST /spaces/:id/members/@me/banner`. */
  spaceMemberBanner: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/members/@me/banner`,
  /** `PUT /spaces/:id/members/:userId/roles` (replace the list). */
  spaceMemberRoles: (spaceId: Snowflake, userId: Snowflake): RouteLike => path`/spaces/${spaceId}/members/${userId}/roles`,
  /** `PUT`, `DELETE /spaces/:id/members/:userId/roles/:roleId`. */
  spaceMemberRole: (spaceId: Snowflake, userId: Snowflake, roleId: Snowflake): RouteLike =>
    path`/spaces/${spaceId}/members/${userId}/roles/${roleId}`,
  /** `PATCH`, `DELETE /spaces/:id/members/:userId/voice` (moderate / disconnect). */
  spaceMemberVoice: (spaceId: Snowflake, userId: Snowflake): RouteLike => path`/spaces/${spaceId}/members/${userId}/voice`,

  /** `GET /spaces/:id/bans`. */
  spaceBans: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/bans`,
  /** `POST`, `DELETE /spaces/:id/bans/:userId`. */
  spaceBan: (spaceId: Snowflake, userId: Snowflake): RouteLike => path`/spaces/${spaceId}/bans/${userId}`,

  /** `GET`, `POST`, `PATCH` (reorder) `/spaces/:id/roles`. */
  spaceRoles: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/roles`,
  /** `PATCH`, `DELETE /spaces/:id/roles/:roleId`. */
  spaceRole: (spaceId: Snowflake, roleId: Snowflake): RouteLike => path`/spaces/${spaceId}/roles/${roleId}`,

  /** `GET`, `POST /spaces/:id/rooms`. */
  spaceRooms: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/rooms`,
  /** `PATCH`, `DELETE /spaces/:id/rooms/:roomId`. */
  spaceRoom: (spaceId: Snowflake, roomId: Snowflake): RouteLike => path`/spaces/${spaceId}/rooms/${roomId}`,
  /** `POST /spaces/:id/rooms/reorder`. */
  spaceRoomsReorder: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/rooms/reorder`,
  /** `POST /spaces/:id/rooms/move`. */
  spaceRoomsMove: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/rooms/move`,
  /** `GET /spaces/:id/rooms/:roomId/overrides` (role overrides). */
  spaceRoomOverrides: (spaceId: Snowflake, roomId: Snowflake): RouteLike => path`/spaces/${spaceId}/rooms/${roomId}/overrides`,
  /** `PUT`, `DELETE /spaces/:id/rooms/:roomId/overrides/:roleId`. */
  spaceRoomOverride: (spaceId: Snowflake, roomId: Snowflake, roleId: Snowflake): RouteLike =>
    path`/spaces/${spaceId}/rooms/${roomId}/overrides/${roleId}`,
  /** `GET /spaces/:id/rooms/:roomId/overrides/users`. */
  spaceRoomUserOverrides: (spaceId: Snowflake, roomId: Snowflake): RouteLike => path`/spaces/${spaceId}/rooms/${roomId}/overrides/users`,
  /** `PUT`, `DELETE /spaces/:id/rooms/:roomId/overrides/users/:userId`. */
  spaceRoomUserOverride: (spaceId: Snowflake, roomId: Snowflake, userId: Snowflake): RouteLike =>
    path`/spaces/${spaceId}/rooms/${roomId}/overrides/users/${userId}`,

  /** `GET`, `POST /spaces/:id/invites`. */
  spaceInvites: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/invites`,
  /** `DELETE /spaces/:id/invites/:code`. */
  spaceInvite: (spaceId: Snowflake, code: string): RouteLike => path`/spaces/${spaceId}/invites/${codeSegment(code)}`,
  /** `GET /spaces/invites/:code` (preview, no auth; `code@domain` for other instances). */
  invite: (code: string): RouteLike => path`/spaces/invites/${codeSegment(code)}`,
  /** `POST /spaces/invites/:code/join`. */
  inviteJoin: (code: string): RouteLike => path`/spaces/invites/${codeSegment(code)}/join`,

  /** `GET`, `POST /spaces/:id/emojis`. */
  spaceEmojis: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/emojis`,
  /** `PATCH`, `DELETE /spaces/:id/emojis/:emojiId`. */
  spaceEmoji: (spaceId: Snowflake, emojiId: Snowflake): RouteLike => path`/spaces/${spaceId}/emojis/${emojiId}`,
  /** `GET /emojis` (every emoji of your spaces). */
  emojis: (): RouteLike => '/emojis',
  /** `GET /emojis/:emojiId` (any emoji by id). */
  emoji: (emojiId: Snowflake): RouteLike => path`/emojis/${emojiId}`,

  /** `GET`, `POST /rooms/:id/webhooks`. */
  roomWebhooks: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/webhooks`,
  /** `GET /spaces/:id/webhooks` (those in rooms where you have Manage Webhooks). */
  spaceWebhooks: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/webhooks`,
  /**
   * `GET`, `PATCH`, `DELETE`, `POST` (execute) `/webhooks/:id`, or `/webhooks/:id/:token` with a
   * token (Discord's form; prefer the `Authorization: Webhook <token>` header, which keeps the token
   * out of URLs and logs).
   */
  webhook: (webhookId: Snowflake, token?: string): RouteLike => webhookBase(webhookId, token),
  /** `POST /webhooks/:id/token` (reset the token; Manage Webhooks). */
  webhookTokenReset: (webhookId: Snowflake): RouteLike => path`/webhooks/${webhookId}/token`,
  /** `GET`, `PATCH`, `DELETE /webhooks/:id[/:token]/messages/:messageId`. */
  webhookMessage: (webhookId: Snowflake, messageId: Snowflake, token?: string): RouteLike =>
    `${webhookBase(webhookId, token)}${path`/messages/${messageId}`}` as RouteLike,

  /** `GET`, `POST /rooms/:id/bridges`. */
  roomBridges: (roomId: Snowflake): RouteLike => path`/rooms/${roomId}/bridges`,
  /** `GET`, `PATCH`, `DELETE /bridges/:id`. */
  bridge: (bridgeId: Snowflake): RouteLike => path`/bridges/${bridgeId}`,
  /** `GET` (backlog), `POST` (send) `/bridges/:id/messages`. */
  bridgeMessages: (bridgeId: Snowflake): RouteLike => path`/bridges/${bridgeId}/messages`,
  /** `PATCH`, `DELETE /bridges/:id/messages/:messageId` (a message the bridge posted, by its Strafe id). */
  bridgeMessage: (bridgeId: Snowflake, messageId: Snowflake): RouteLike => path`/bridges/${bridgeId}/messages/${messageId}`,
  /** `GET` (lookup), `PATCH`, `DELETE /bridges/:id/messages/external/:externalMessageId`. */
  bridgeExternalMessage: (bridgeId: Snowflake, externalMessageId: string): RouteLike =>
    path`/bridges/${bridgeId}/messages/external/${externalSegment(externalMessageId)}`,
  /** `GET`, `PUT /bridges/:id/messages/:messageId/external` (a Strafe message's copies; record one). */
  bridgeMessageExternal: (bridgeId: Snowflake, messageId: Snowflake): RouteLike => path`/bridges/${bridgeId}/messages/${messageId}/external`,
  /** `PUT`, `DELETE /bridges/:id/messages/:messageId/reactions/:emoji/:externalUserId`. */
  bridgeMessageReaction: (bridgeId: Snowflake, messageId: Snowflake, emoji: string, externalUserId: string): RouteLike =>
    path`/bridges/${bridgeId}/messages/${messageId}/reactions/${emojiSegment(emoji)}/${externalSegment(externalUserId)}`,
  /** `PUT`, `DELETE /bridges/:id/messages/external/:externalMessageId/reactions/:emoji/:externalUserId`. */
  bridgeExternalReaction: (bridgeId: Snowflake, externalMessageId: string, emoji: string, externalUserId: string): RouteLike =>
    path`/bridges/${bridgeId}/messages/external/${externalSegment(externalMessageId)}/reactions/${emojiSegment(emoji)}/${externalSegment(externalUserId)}`,
  /** `GET`, `PATCH`, `DELETE /bridges/:id/puppets/:externalUserId`. */
  bridgePuppet: (bridgeId: Snowflake, externalUserId: string): RouteLike => path`/bridges/${bridgeId}/puppets/${externalSegment(externalUserId)}`,
  /** `GET /bridges/:id/blocks`. */
  bridgeBlocks: (bridgeId: Snowflake): RouteLike => path`/bridges/${bridgeId}/blocks`,
  /** `PUT`, `DELETE /bridges/:id/blocks/:puppetId`. */
  bridgeBlock: (bridgeId: Snowflake, puppetId: Snowflake): RouteLike => path`/bridges/${bridgeId}/blocks/${puppetId}`,
  /** `GET`, `PUT /users/@me/bridge-consent`. */
  userBridgeConsent: (): RouteLike => '/users/@me/bridge-consent',
  /** `GET`, `PUT /spaces/:id/members/@me/bridge-consent`. */
  spaceMemberBridgeConsent: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/members/@me/bridge-consent`,
  /** `GET`, `PUT /spaces/:id/bridge-consent` (the space's mode; Manage Space to change it). */
  spaceBridgeConsent: (spaceId: Snowflake): RouteLike => path`/spaces/${spaceId}/bridge-consent`,

  /** `POST /oauth2/token`. */
  oauth2Token: (): RouteLike => '/oauth2/token',
  /** `POST /oauth2/token/revoke`. */
  oauth2TokenRevoke: (): RouteLike => '/oauth2/token/revoke',
  /** `GET /oauth2/@me` (Bearer token). */
  oauth2CurrentAuthorization: (): RouteLike => '/oauth2/@me',
} as const;

/** Segments after `/webhooks/:id/` that are routes, not a token. */
const WEBHOOK_STATIC = new Set(['token', 'messages']);

/**
 * The bucket key of a path: ids replaced with `:id`, invite codes with `:code`, reaction emoji
 * with `:emoji` (`/rooms/:id/messages/:id/reactions/:emoji`), a webhook token with `:token` and
 * a bridge's external ids with `:external`. Strafe limits each route per account, whatever room or
 * space it names, so this is the whole bucket.
 *
 * @param path - A path relative to the API base (query string allowed).
 */
export function routeTemplate(path: string): string {
  const [pathname = ''] = path.split('?');
  const parts = pathname.split('/');
  const out: string[] = [];
  const bridge = parts[1] === 'bridges';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    const previous = parts[i - 1];
    if (parts[1] === 'webhooks' && i === 3 && !WEBHOOK_STATIC.has(part)) out.push(':token');
    else if (bridge && (previous === 'external' || previous === 'puppets' || parts[i - 2] === 'reactions')) out.push(':external');
    else if (previous === 'reactions') out.push(':emoji');
    else if (previous === 'invites' && part !== '' && !/^\d+$/.test(part)) out.push(':code');
    else if (/^\d+$/.test(part)) out.push(':id');
    else out.push(part);
  }
  return out.join('/');
}

/**
 * The id a request is queued under: the first id in the path (the room, space, webhook or bridge).
 * Requests with the same route template and major parameter run one at a time, in order, so
 * messages to one room (or through one webhook or bridge) keep their order while others are not
 * held up.
 *
 * @param path - A path relative to the API base.
 */
export function majorParameter(path: string): string {
  const match = /^\/(?:rooms|spaces|webhooks|bridges)\/(\d+)/.exec(path);
  return match?.[1] ?? 'global';
}

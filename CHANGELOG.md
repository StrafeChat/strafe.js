# Changelog

All notable changes to `@strafechat/strafe.js`. The project follows
[semantic versioning](https://semver.org): the public API is what the package root exports and the
documentation describes; members starting with `_` or marked `@internal` are not covered.

## 2.1.0 (2026-11-26)

Webhooks, bridges and permission writes need an instance running equinox from 2026-11-26 or later:
older servers read permissions only as numbers and refuse the string form.

### Permissions

- `PermissionFlagsBits.ManageWebhooks` (`1n << 31n`) and `PermissionFlagsBits.Masquerade`
  (`1n << 32n`). Permission writes (roles, room overrides, any `bigint` in a request body) are now
  sent as decimal strings, the server's full form, so bits past 30 survive;
  `PermissionsBitField.toWire()` gives that string for hand-built bodies.

### Webhooks

- `room.createWebhook()`, `room.fetchWebhooks()` (text rooms and voice-room chats),
  `space.fetchWebhooks()`, `client.fetchWebhook(id, token?)`, and the `Webhook` structure: `edit()`
  (name, avatar, `massMentions`, moving to another room), `delete()`, `resetToken()`, `send()`,
  `fetchMessage()`, `editMessage()` and `deleteMessage()`. Tokens are kept out of `toJSON()` and come
  back only from create and token resets, as on the server.
- `WebhookClient({ id, token } | { url })` with no bot token, login or gateway, and
  `parseWebhookURL()`. It sends `Authorization: Webhook <token>` by default (`tokenInURL: true` for
  Discord's path form), and each webhook's `429`s wait in their own queue.
- `allowedMentions` on webhook sends (`parse`, `users`, `roles`, `repliedUser`), checked locally;
  `WebhookMessageFlags`.
- `message.webhookId`, `message.isWebhook`, `message.isBridged` and `message.masquerade` (name,
  avatar, colour, bridge, `via`). A webhook's or bridged user's `author` is never put in
  `client.users`.
- `Events.WebhooksUpdate`, and `WebhookAPIError` (with `permission`, `nameReason`, `field`, `max`,
  `scope`) for webhook routes.

### Bridges

- `room.createBridge()`, `room.fetchBridges()`, `room.bridges` and `room.bridged`, and
  `client.bridges` (the bridges the bot drives, from `READY` and `BRIDGE_CREATE` / `BRIDGE_UPDATE`
  / `BRIDGE_DELETE`, with `bridgeCreate`, `bridgeUpdate` and `bridgeDelete`).
- `Bridge`: `send({ externalUser, externalMessageId, part, content, embeds, files, replyTo,
  repliedUser })` (idempotent, retried after timeouts and `send_in_progress`), `editMessage()`,
  `deleteMessage()`, `react()` and `unreact()` by the other platform's message ids, `link()` and
  `lookup()` for the id map, `backlog()` and `fetchBacklog()`, `pause()`, `resume()`, `edit()`,
  `setSettings()` and `delete()`; `bridge.puppets` (fetch, edit, forget) and `bridge.blocks`.
- The bridge feed as events with `Message` objects and external ids: `bridgeMessageCreate`,
  `bridgeMessageUpdate`, `bridgeMessageDelete`, `bridgeReactionAdd`, `bridgeReactionRemove`,
  `bridgeOptOut`, `bridgePuppetBlock` and `bridgePuppetUnblock`. Reactions by another bridge's users
  (`MESSAGE_REACTION_ADD` with `puppet`) never put them in `client.users`.
- `space.fetchBridgeConsentMode()` and `space.setBridgeConsentMode()`.
- `BridgeAPIError` (a `WebhookAPIError`, adding `state`, `stateReason` and `audience`), the bridge
  codes in `APIErrorCodes`, and the local `BridgeSendInvalid` refusal. A bridged user's slowmode
  (`429 slowmode`, `scope: "puppet"`) is waited out in the bridge's queue.

### Users

- Default avatars as in the web client: `user.defaultAvatarURL` (`<web>/avatars/default/<0-7>.png`,
  from the user's home id), `calculateUserDefaultAvatarIndex()` and `buildDefaultAvatarURL()`;
  `displayAvatarURL()` on users, members and `OAuth2User` falls back to it.

### Documentation

- Guide pages for webhooks and for bridging another platform, with a complete Discord bridge.

## 2.0.0 (2026-11-11)

A ground-up rewrite for the current Strafe server, modelled on discord.js v14. **Breaking:** nothing
from 1.x carries over. Versions 1.x spoke to the retired pre-2026 backend (msgpack over the old
gateway) and do not work with current instances.

### Package

- ESM only, with TypeScript declarations, and no runtime dependencies (the platform's `fetch`,
  `WebSocket`, `FormData` and `Blob`). `require()` works on Node.js 22.12 and newer.
- Supports Node.js 22.12 or newer, Bun, and Deno 2.5 or newer.

### Client and gateway

- `Client` with `login()` (falls back to `STRAFE_TOKEN`; checks the token before connecting),
  `destroy()`, `[Symbol.asyncDispose]`, `isReady()`, `generateInvite()`, `fetchInvite()`,
  `fetchInstance()` and `client.application` (`{ id }`: the bot's id is its application's id).
- A required instance (`instance` option or `STRAFE_INSTANCE`): a domain or URL, with the API,
  gateway, web and CDN addresses derived and individually overridable, plus `discoverInstance()`.
- `WebSocketManager` (`client.ws`): the `Bot` header on the handshake, latency pings
  (`client.ws.ping`), reconnects with exponential backoff and jitter, and cache reconciliation
  after each reconnect (Strafe has no resume).
- `Events` and typed `ClientEvents`, with old and new objects on updates and partial objects for
  uncached messages, reactions and members.

### Structures and managers

- `User`, `ClientUser`, `Space`, `SpaceMember`, `Role`, `Message`, `MessageReaction`, `Emoji`,
  `SpaceEmoji`, `Invite`, `Attachment`, `Embed`, `VoiceState`, `SpaceBan`, `AuditLogEntry`,
  `ThreadMember`, `Presence`, and the rooms `TextRoom`, `VoiceRoom`, `SectionRoom`, `ThreadRoom`,
  `PMRoom` and `GroupPMRoom` with type guards (`isTextBased()`, `isSendable()`, `isEncrypted()`...).
- Managers with `cache`, `fetch()`, `resolve()` and `resolveId()`, plus create, edit and delete where
  the API allows: spaces, rooms, users, emojis, members, member roles, roles, bans, invites,
  messages, reactions, permission overrides, threads, thread members and voice states.
- Federation: `user.handle` (`name@domain`), `user.homeDomain`, `user.isRemote`, mirrored spaces
  (`space.federated`), and `code@domain` invites.
- Cache limits through `makeCache` and `Options.cacheWithLimits()` (200 messages per room by
  default).

### Messages

- `room.send()` and `message.reply()` with content, embeds, files (two-step uploads) and replies;
  `attachment://<name>` in embeds; edit, delete, react, pin, unpin, `bulkDelete()` (one request per
  message), `sendTyping()`, history paging, pins and search.
- Local refusals with typed errors before any request: end-to-end encrypted rooms
  (`RoomEncrypted`), PMs (`PMsEncrypted`), empty or oversized messages, and embeds over Strafe's
  limits (with the server's error path).
- `EmbedBuilder`, `AttachmentBuilder`, `Colors`, and `Formatters` (mentions, timestamps, Markdown,
  `escapeMarkdown()`, `escapeMentions()`).
- Collectors in discord.js's shape: `room.createMessageCollector()` and `awaitMessages()`,
  `message.createReactionCollector()` and `awaitReactions()`.
- Files are bytes, a `Blob`, a stream, an `http(s)` URL, or a local file as a `file:` `URL`. Unlike
  discord.js, a string is never read as a local path, since it may be user input.

### Permissions

- `PermissionsBitField` and `PermissionFlagsBits` with Strafe's 31 bits.
- `member.permissions`, `member.permissionsIn(room)` and `room.permissionsFor(memberOrRole)`,
  computed with the server's algorithm (owner, Administrator, overrides, synced sections, threads,
  private threads, implicit rules), and the Discord-style role hierarchy helpers (`manageable`,
  `kickable`, `bannable`, `editable`).

### REST

- `REST`, usable on its own with `Routes`: per-route rate-limit budgets from `X-RateLimit-*`,
  in-order queues per room, `429` and slowmode handling, `rejectOnRateLimit` and `maxRetryAfter`,
  retries for idempotent requests only, timeouts, abort signals, multipart uploads, and the
  `rateLimited`, `response` and `debug` events.
- Errors: `StrafeAPIError`, `HTTPError`, `RateLimitError`, `StrafeError` with `ErrorCodes`, and
  `APIErrorCodes`.
- Every id that goes into a request path is checked (a snowflake or `@me`, else `IdInvalid`), so
  user input such as `../rooms/1` cannot reach another endpoint.
- Wire types for every route, payload and gateway event.

### OAuth2

- `OAuth2Client`: `generateAuthURL()` with PKCE (`createPKCE()`, S256) and `createState()`,
  `parseCallback()` (the expected state is required: a missing one fails the check),
  `exchangeCode()`, `refreshToken()`, `revokeToken()`, `fetchUser()`, `fetchSpaces()`,
  `fetchCurrentAuthorization()`, and bot install links. Works without a `Client`.
- `space.members.add(user, { accessToken })` for the `spaces.join` scope.

### Documentation

- A VitePress guide in `docs/` (getting started, events, messages and embeds, spaces and members,
  permissions, OAuth2, instances and federation, errors and rate limits, limits and differences,
  coming from discord.js), the TypeDoc API reference, and runnable examples in `examples/`.

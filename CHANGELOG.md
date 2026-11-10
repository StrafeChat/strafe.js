# Changelog

All notable changes to `@strafechat/strafe.js`. The project follows
[semantic versioning](https://semver.org): the public API is what the package root exports and the
documentation describes; members starting with `_` or marked `@internal` are not covered.

## 2.0.0 (unreleased)

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

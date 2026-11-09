# REST, errors and rate limits

Every request goes through `client.rest`, a `REST` client that queues requests, waits out rate
limits, retries what is safe to retry, and turns error responses into typed errors. It also works
on its own, without a gateway connection.

## Errors

| Class | Thrown when | Useful fields |
| --- | --- | --- |
| `StrafeError`, `StrafeTypeError`, `StrafeRangeError` | The library refuses something itself, before any request | `code` (an `ErrorCodes` value), `path` |
| `StrafeAPIError` | The server answered with an error | `status`, `code`, `path`, `message`, `rawError`, `method`, `url`, `requestBody` |
| `HTTPError` | The server answered with an error that is not JSON (a proxy's error page) | `status`, `statusText`, `body` |
| `RateLimitError` | A rate limit you asked not to wait for (see below) | `retryAfter`, `route`, `scope` |
| `BulkDeleteError` | Some deletions of `bulkDelete()` failed | `deleted`, `failed` |

```ts
import { ErrorCodes, StrafeAPIError, StrafeError } from '@strafechat/strafe.js';

try {
  await room.send({ embeds: [embed] });
} catch (error) {
  if (error instanceof StrafeError && error.code === ErrorCodes.RoomEncrypted) {
    // the room is end-to-end encrypted: nothing was sent
  } else if (error instanceof StrafeAPIError && error.status === 403) {
    console.warn(`Missing a permission: ${error.message}`);
  } else {
    throw error;
  }
}
```

`StrafeTypeError` and `StrafeRangeError` extend `TypeError` and `RangeError`, not `StrafeError`;
all three carry `code`.

### Ids from user input

Commands often pass what someone typed straight on: `space.members.kick(args[0])`. Every id that
goes into a request path is checked first: it must be a decimal snowflake, or `@me`. Anything else
(`../rooms/123`, a name, an empty string) rejects with a `StrafeTypeError` whose code is
`ErrorCodes.IdInvalid`, and no request is made, so typed input can never reach another endpoint
with the bot's permissions. A reaction emoji or an invite code of `.` or `..` is refused the same
way (`EmojiInvalid`, `InviteInvalid`), and `rest.get()` and friends refuse a path with a `.` or `..`
segment or a backslash (`RouteInvalid`).

```ts
try {
  await message.space.members.kick(args[0] ?? '');
} catch (error) {
  if (error instanceof StrafeTypeError && error.code === ErrorCodes.IdInvalid) await message.reply('That is not a user id.');
  else throw error;
}
```

### What the server says

Strafe's errors are `{ "error": "message" }` with an HTTP status: `400` bad input, `401` bad
credentials, `403` not allowed, `404` not found, `409` conflict, `413` too large, `429` too many
requests. `error.message` is the server's message. Some errors add a machine-readable slug, in
`error.code` and listed in `APIErrorCodes`:

| `APIErrorCodes` | `code` | Meaning |
| --- | --- | --- |
| `InvalidEmbed` | `invalid_embed` | An embed broke a rule; `error.path` says where |
| `VerificationLevel` | `verification_level` | The space's verification level refused the message (bots are exempt) |
| `AutomodBlocked` | `automod_blocked` | Automod refused the message; `rawError.rule` says which rule |
| `CannotEditMemberProfile` | `cannot_edit_member_profile` | You may not edit this member's space profile |
| `RoomFull` | `room_full` | The voice room is full |
| `InsufficientScope` | `insufficient_scope` | An OAuth2 token reached a route its scopes do not allow |
| `InvalidGrant`, `InvalidClient`, `InvalidScope`, `InvalidRequest`... | RFC 6749 codes | OAuth2 token endpoint errors |

Most `403`s and `404`s carry no slug, so check `status` (and the message when it matters). The
library refuses most mistakes before the request, with a `StrafeError` whose `code` names the rule.

## Rate limits

Strafe limits requests per account and per route. The REST client reads the `X-RateLimit-*`
headers and waits before it would exceed a limit; when a `429` arrives anyway it waits for
`Retry-After` and sends the request again. You do not need to handle `429`s.

- Requests to the same route and room (or space) run one at a time, in order. Messages sent to a
  room arrive in the order you sent them; other rooms are not held up.
- **Slowmode** answers `429` too. It holds only that room's queue, and is reported with
  `scope: 'shared'`. Members with Manage Messages or Manage Rooms are exempt.
- A wait longer than `maxRetryAfter` (60 seconds by default), such as a long slowmode, rejects with
  `RateLimitError` instead of stalling every later message to that room.
- `rejectOnRateLimit` rejects instead of waiting: `true`, a list of route prefixes
  (`['/rooms']`), or a function of the limit.

```ts
import { RESTEvents } from '@strafechat/strafe.js';

client.rest.on(RESTEvents.RateLimited, (info) => {
  console.warn(`Rate limited on ${info.route} for ${String(info.retryAfter)} ms (${info.scope})`);
});
```

## Retries and timeouts

| Situation | GET, PUT, DELETE | POST, PATCH |
| --- | --- | --- |
| `429` | Waited out and retried (not counted) | Waited out and retried (not counted) |
| Network error before anything was sent | Retried | Retried |
| Timeout, connection reset, `5xx` | Retried, up to `retries` (3) times with backoff | Retried on `503` only |

Strafe has no idempotency key, so retrying a `POST` that may have reached the server could post a
message twice; the library does not take that risk (discord.js does).

Requests time out after 15 seconds (`rest.timeout`), uploads after at least 120 seconds. Each
request also takes an `AbortSignal`.

```ts
const client = new Client({
  instance: 'app.strafe.chat',
  rest: { retries: 5, timeout: 30_000, rejectOnRateLimit: ['/spaces'] },
});
```

## Debugging

```ts
client.rest.on(RESTEvents.Debug, (line) => console.debug(line));
client.rest.on(RESTEvents.Response, (request, response) => {
  console.debug(`${request.method} ${request.path} -> ${String(response.status)}`);
});
```

Errors keep what was sent (`error.requestBody`), and so does the `response` event
(`request.data`). In both, OAuth2 secrets and the access token of `space.members.add()` show as
`[redacted]`; a raw `rest.request()` can do the same for its own fields with `redact: ['field']`.
The token is never logged or serialized: neither `client` nor `client.rest` shows it when
inspected or turned into JSON.

## REST without a gateway

Scripts, cron jobs and serverless functions often only need to send something. `REST` with
`Routes` does that without connecting to the gateway or caching anything:

<<< @/../examples/rest-only.ts

`Routes` holds every route a bot can use (`Routes.roomMessages(roomId)`,
`Routes.spaceMember(spaceId, userId)`...), and the wire types (`APIMessage`, `APISpace`,
`RESTPostAPIRoomMessageJSONBody`...) describe the JSON. The wire format is the server's own: the
message text is `plaintext`, ids are strings, permissions are numbers.

```ts
import { REST, Routes, type APIMember } from '@strafechat/strafe.js';

const rest = new REST({ instance: 'app.strafe.chat' }).setToken(process.env.STRAFE_TOKEN!);
const members = await rest.get<APIMember[]>(Routes.spaceMembers(spaceId));
await rest.put(Routes.spaceMemberRole(spaceId, userId, roleId));
```

# REST, errors and rate limits

Every request goes through `client.rest`. It queues requests, waits out rate limits, retries what is
safe to retry and throws typed errors. It also works without a gateway connection.

## Errors

| Class | Thrown when | Useful fields |
| --- | --- | --- |
| `StrafeError`, `StrafeTypeError`, `StrafeRangeError` | The library refuses something before any request | `code` (an `ErrorCodes` value), `path` |
| `StrafeAPIError` | The server answered with an error | `status`, `code`, `path`, `message`, `rawError`, `method`, `url`, `requestBody` |
| `HTTPError` | The server answered with a non-JSON error | `status`, `statusText`, `body` |
| `RateLimitError` | A rate limit you chose not to wait for | `retryAfter`, `route`, `scope` |
| `BulkDeleteError` | Some deletions in `bulkDelete()` failed | `deleted`, `failed` |

```ts
import { ErrorCodes, StrafeAPIError, StrafeError } from '@strafechat/strafe.js';

try {
  await room.send({ embeds: [embed] });
} catch (error) {
  if (error instanceof StrafeError && error.code === ErrorCodes.RoomEncrypted) {
    // nothing was sent
  } else if (error instanceof StrafeAPIError && error.status === 403) {
    console.warn(`Missing a permission: ${error.message}`);
  } else {
    throw error;
  }
}
```

`StrafeTypeError` and `StrafeRangeError` extend `TypeError` and `RangeError`, not `StrafeError`.
All three carry `code`.

### Ids from user input

Every id in a request path must be a decimal snowflake or `@me`. Anything else rejects with
`ErrorCodes.IdInvalid` and no request is made. Emoji and invite codes of `.` or `..` are refused
too (`EmojiInvalid`, `InviteInvalid`), as are `rest.get()` paths with `.`, `..` or a backslash
(`RouteInvalid`).

```ts
try {
  await message.space.members.kick(args[0] ?? '');
} catch (error) {
  if (error instanceof StrafeTypeError && error.code === ErrorCodes.IdInvalid) await message.reply('That is not a user id.');
  else throw error;
}
```

### What the server says

Server errors are `{ "error": "message" }` with a status: `400` bad input, `401` bad credentials,
`403` not allowed, `404` not found, `409` conflict, `413` too large, `429` too many requests. Some
add a slug in `error.code`:

| `APIErrorCodes` | `code` | Meaning |
| --- | --- | --- |
| `InvalidEmbed` | `invalid_embed` | An embed broke a rule; `error.path` says where |
| `VerificationLevel` | `verification_level` | The space's verification level refused the message (bots are exempt) |
| `AutomodBlocked` | `automod_blocked` | Automod refused the message; `rawError.rule` says which rule |
| `CannotEditMemberProfile` | `cannot_edit_member_profile` | You may not edit this member's space profile |
| `RoomFull` | `room_full` | The voice room is full |
| `InsufficientScope` | `insufficient_scope` | An OAuth2 token reached a route its scopes do not allow |
| `InvalidGrant`, `InvalidClient`, `InvalidScope`, `InvalidRequest`... | RFC 6749 codes | OAuth2 token endpoint errors |

Most `403`s and `404`s have no slug, so check `status`.

## Rate limits

The REST client reads the `X-RateLimit-*` headers and waits before hitting a limit. On a `429` it
waits for `Retry-After` and retries. You do not need to handle `429`s.

- Requests to the same route and room (or space) run in order, one at a time. Other rooms are not
  held up.
- Slowmode also answers `429`, with `scope: 'shared'`, and holds only that room's queue. Members
  with Manage Messages or Manage Rooms are exempt.
- A wait longer than `maxRetryAfter` (60 seconds) rejects with `RateLimitError`.
- `rejectOnRateLimit` rejects instead of waiting: `true`, route prefixes (`['/rooms']`), or a
  function.

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
| Timeout, connection reset, `5xx` | Retried up to `retries` (3) times with backoff | Retried on `503` only |

Strafe has no idempotency key, so a `POST` is not retried when it may have reached the server.

Requests time out after 15 seconds (`rest.timeout`), uploads after at least 120. Each request also
takes an `AbortSignal`.

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

Errors keep the request body in `error.requestBody`, and the `response` event in `request.data`.
OAuth2 secrets and the access token of `space.members.add()` show as `[redacted]`. Redact your own
fields in `rest.request()` with `redact: ['field']`. The bot token never appears when `client` or
`client.rest` is inspected or serialized.

## REST without a gateway

For scripts and serverless functions, use `REST` with `Routes`. Nothing connects or caches:

<<< @/../examples/rest-only.ts

`Routes` has every route a bot can use, and the wire types (`APIMessage`, `APISpace`,
`RESTPostAPIRoomMessageJSONBody`...) describe the JSON. Message text is `plaintext`, ids are
strings, permissions are numbers.

```ts
import { REST, Routes, type APIMember } from '@strafechat/strafe.js';

const rest = new REST({ instance: 'app.strafe.chat' }).setToken(process.env.STRAFE_TOKEN!);
const members = await rest.get<APIMember[]>(Routes.spaceMembers(spaceId));
await rest.put(Routes.spaceMemberRole(spaceId, userId, roleId));
```

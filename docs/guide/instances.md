# Instances and federation

Strafe is federated: each instance has its own domain, accounts and API. There is no default, so every
`Client`, `REST` and `OAuth2Client` names its instance.

## Pointing at an instance

```ts
new Client({ instance: 'app.strafe.chat' });
new Client({ instance: 'https://chat.example.org' });
new Client({ instance: 'https://example.org/strafe/api' });
new Client({ instance: 'http://localhost:4000' });
new Client(); // STRAFE_INSTANCE
```

| `instance` | API | Gateway | Web client |
| --- | --- | --- | --- |
| `app.strafe.chat` or `https://app.strafe.chat` | `https://app.strafe.chat/api` | `wss://app.strafe.chat/gateway/events` | `https://app.strafe.chat` |
| A URL ending in `/api` (`https://x.org/strafe/api`) | that URL | `wss://x.org/strafe/gateway/events` | `https://x.org/strafe` |
| Another URL with a path | that URL | `wss://<host>/gateway/events` | the origin |
| An origin with a port (`http://localhost:4000`) | that origin | the next port: `ws://localhost:4001/events` | the origin |

Local names (`localhost`, `*.localhost`, `*.local`, `*.test`, IPs) use `http` and `ws`. `client.urls`
shows the result.

At login the client reads the instance index and picks up its CDN, gateway and
`client.federationDomain`. `client.fetchInstance()` returns the whole index.

### Unusual layouts

Explicit addresses always win:

```ts
const client = new Client({
  instance: 'chat.example.org',
  rest: { api: 'https://api.chat.example.org' },
  ws: { gateway: 'wss://gateway.chat.example.org/events' },
  web: 'https://chat.example.org', // invite links, OAuth2 consent
  cdn: 'https://cdn.chat.example.org',
});
```

`discoverInstance()` finds them over the network, trying the URL, then `/.well-known/strafe`, then the
standard layout:

```ts
import { Client, discoverInstance } from '@strafechat/strafe.js';

const { urls } = await discoverInstance('chat.example.org');
const client = new Client({ instance: urls.origin, rest: { api: urls.api }, ws: { gateway: urls.gateway } });
```

## A bot belongs to one instance

A bot connects only to its application's instance. Spaces it joins elsewhere are mirrored there.

## People from other instances

| Property | Local user | User from `other.example` |
| --- | --- | --- |
| `user.username` | `alice` | `alice` |
| `user.handle` (and `user.tag`) | `alice` | `alice@other.example` |
| `user.homeDomain` | this instance's domain (`null` if it does not federate) | `other.example` |
| `user.isRemote` | `false` | `true` |
| `user.originId` | the same as `id` | the user's id on their own instance |

Ids differ per instance. Use `user.id` locally and `handle`, which is unique, to identify someone across the network.

## Spaces on other instances

A mirrored space has `space.federated` set to `true`, and `space.federation` and `room.federation`
name the origin. Everything works the same.

## Invites across instances

A code for a space on another instance is written `code@domain`:

```ts
await client.fetchInvite('abc123');
await client.fetchInvite('abc123@other.example');
await client.fetchInvite('https://other.example/invite/abc123'); // abc123@other.example
```

`fetchInvite()` works before login. To check a link without a request, use `parseInviteCode()`:

```ts
import { parseInviteCode } from '@strafechat/strafe.js';

const { code, linkHost } = parseInviteCode('https://other.example/invite/abc123');
```

`invite.url` always points at the bot's own instance.

## Developer documentation of an instance

Each instance serves its API reference at `https://<instance>/docs/`.

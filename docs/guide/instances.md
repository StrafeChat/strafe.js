# Instances and federation

Strafe is federated. Each instance is an independent server with its own domain, accounts, API,
gateway and applications, and instances talk to each other so that people can join spaces and
message people elsewhere. No instance is the official one, so strafe.js has no default: every
`Client`, `REST` and `OAuth2Client` names its instance.

## Pointing at an instance

```ts
new Client({ instance: 'app.strafe.chat' });            // a domain
new Client({ instance: 'https://chat.example.org' });   // an origin
new Client({ instance: 'https://example.org/strafe/api' }); // the API base itself
new Client({ instance: 'http://localhost:4000' });      // a development server
new Client();                                           // STRAFE_INSTANCE
```

The URLs are derived without any request:

| `instance` | API | Gateway | Web client |
| --- | --- | --- | --- |
| `app.strafe.chat` or `https://app.strafe.chat` | `https://app.strafe.chat/api` | `wss://app.strafe.chat/gateway/events` | `https://app.strafe.chat` |
| A URL ending in `/api` (`https://x.org/strafe/api`) | that URL | `wss://x.org/strafe/gateway/events` | `https://x.org/strafe` |
| Another URL with a path | that URL | `wss://<host>/gateway/events` | the origin |
| An origin with a port (`http://localhost:4000`) | that origin | the next port: `ws://localhost:4001/events` | the origin |

Local names (`localhost`, `*.localhost`, `*.local`, `*.test`, IP addresses) default to `http` and
`ws`; everything else to `https` and `wss`. `client.urls` shows the result.

At login, the client reads the instance's public index (`GET <api>/`). It records the instance's
federation domain (`client.federationDomain`), and takes the CDN and gateway addresses the
instance advertises, unless you set them yourself. `client.fetchInstance()` returns the whole index
(version, features, services).

### Unusual layouts

Any address can be set explicitly; explicit values always win:

```ts
const client = new Client({
  instance: 'chat.example.org',
  rest: { api: 'https://api.chat.example.org' },
  ws: { gateway: 'wss://gateway.chat.example.org/events' },
  web: 'https://chat.example.org',     // invite links and the OAuth2 consent page
  cdn: 'https://cdn.chat.example.org',
});
```

`discoverInstance(instance)` finds the addresses over the network instead, the way the desktop app
does: it tries the URL as an API, then `https://<host>/.well-known/strafe`, then the standard
layout, and returns `{ urls, version, federationDomain, index }`. Pass its `urls` back as overrides.

```ts
import { Client, discoverInstance } from '@strafechat/strafe.js';

const { urls } = await discoverInstance('chat.example.org');
const client = new Client({ instance: urls.origin, rest: { api: urls.api }, ws: { gateway: urls.gateway } });
```

## A bot belongs to one instance

A bot is an account on the instance where its application was created, and it connects to that
instance only. It still reaches the rest of the network through it: spaces hosted elsewhere that
it joins are mirrored on its home instance, and people from other instances appear in its spaces.

## People from other instances

Users carry where they come from:

| Property | Local user | User from `other.example` |
| --- | --- | --- |
| `user.username` | `alice` | `alice` |
| `user.handle` (and `user.tag`) | `alice` | `alice@other.example` |
| `user.homeDomain` | this instance's domain (`null` if it does not federate) | `other.example` |
| `user.isRemote` | `false` | `true` |
| `user.originId` | the same as `id` | the user's id on their own instance |

Ids are per instance: the same person has a different id on each instance that knows them. Use
`user.id` within the bot's instance, and `handle` when showing or storing who someone is across
the network. Strafe has no discriminators: a handle is unique.

## Spaces on other instances

A space can live on another instance and be mirrored on the bot's. Its `space.federated` is `true`
and `space.federation` names the origin; rooms carry `room.federation` too. Everything works the
same way: messages, members and moderation go to the origin through the bot's instance, and the
events come back over the bot's own gateway.

## Invites across instances

Invite codes are local to an instance. A code for a space on another instance is written
`code@domain`:

```ts
await client.fetchInvite('abc123');                    // this instance
await client.fetchInvite('abc123@other.example');       // a space hosted on other.example
await client.fetchInvite('https://other.example/invite/abc123'); // read as abc123@other.example
```

`client.fetchInvite()` works before login. A link from another instance's web client becomes
`code@host`, so the bot's instance fetches it from that host over federation. If your bot reads
invite links from messages, decide first whether it should follow links to other hosts at all:
`parseInviteCode(text)` returns `{ code, domain, linkHost }` without any request.

```ts
import { parseInviteCode } from '@strafechat/strafe.js';

const { code, linkHost } = parseInviteCode('https://other.example/invite/abc123');
```

`invite.url` is a link on the bot's own instance's web client.

## Developer documentation of an instance

Every instance serves the documentation of its own API and gateway at `https://<instance>/docs/`.
strafe.js follows the server's code where the two disagree, but the instance's pages are the
reference for the raw protocol.

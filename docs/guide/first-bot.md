# Your first bot

This page walks through `examples/ping-pong.ts` from the repository: a bot that answers `!ping` with
"Pong!" and the gateway latency.

<<< @/../examples/ping-pong.ts

## Run it

```sh
STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=your-token node bot.ts
```

Say `!ping` in a room the bot can see. If nothing happens, check that the room is not end-to-end
encrypted (a lock in the web client): a bot sees encrypted messages with `content === null` and
cannot answer there.

## Line by line

**`new Client({ instance })`** creates the client. Nothing connects yet. The options are few
because a Strafe bot has no intents to declare: it receives every event about what it can see.

**`client.once(Events.ClientReady, ...)`** runs once, when the first `READY` has filled the
caches. The argument is the client typed as `Client<true>`, whose `user`, `readyAt` and `uptime`
are not `null`. `'ready'` is emitted at the same moment, for code written that way. After a
reconnect the client emits `gatewayReady` and `reconnected` instead; see [Events](./events.md).

**`client.on(Events.MessageCreate, ...)`** fires for every message in every room the bot can see:
its own, other bots', and system notices (a member joined, a message was pinned) included. Two
checks come first in almost every handler:

- `message.author.bot` skips bots, including this one, so two bots never answer each other forever.
- `message.content === null` skips what the bot cannot read: messages in end-to-end encrypted rooms
  arrive with `encrypted === true` and no text.

**`message.reply()`** sends a reply in the same room. `room.send()` sends without the reply link.
Both return the sent `Message`.

**`client.login()`** checks the token with the REST API (a wrong token rejects with
`TokenInvalid` here, before any connection), reads the instance's public index, connects to the
gateway and resolves with the token once `clientReady` has been emitted.

## Listeners can be async

Event listeners may be `async`. When one throws or its promise rejects, the client emits the error
as `Events.Error` (when something listens to it) and keeps going; the other listeners and later
events are not affected. Without an `error` listener the error is rethrown asynchronously, like an
uncaught exception.

## Presence

```ts
client.once(Events.ClientReady, async (ready) => {
  ready.user.setActivity('with the API'); // "Playing with the API"
  await ready.user.setPresence({ status: 'idle', customStatus: 'Type !help' });
});
```

Only "Playing" activities exist. The activity goes over the gateway and is sent again after every
reconnect; status and custom status are saved through the API. `new Client({ presence })` applies a
presence after the first `READY`.

## Stopping

```ts
process.on('SIGINT', async () => {
  await client.destroy();
  process.exit(0);
});
```

`destroy()` closes the connection, stops reconnecting and forgets the token. The caches are kept and
`login()` may be called again. `await using client = new Client(...)` destroys it at the end of the
scope.

## Deploying

One process and one connection are enough for any number of spaces: Strafe has no sharding. Run the
bot under a process manager or in a container, pass the token through the environment, and let the
client reconnect on its own after network trouble (it backs off up to a minute between attempts).
If the token is reset or the account is banned from the instance, the client emits
`Events.Invalidated` and stops for good; exit and alert someone.

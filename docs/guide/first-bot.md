# Your first bot

A bot that answers `!ping` with "Pong!" and the gateway latency (`examples/ping-pong.ts`):

<<< @/../examples/ping-pong.ts

## Run it

```sh
STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=your-token node bot.ts
```

Say `!ping` in a room the bot can see. If nothing happens, check that the room is not end-to-end
encrypted (a lock icon in the web client). Bots cannot read or answer there.

## Line by line

- `new Client({ instance })` creates the client without connecting. There are no intents: the bot
  receives every event about what it can see.
- `Events.ClientReady` fires once, after the first `READY` fills the caches. Its argument is a
  `Client<true>`, so `user` is not `null`. Reconnects emit `gatewayReady` and `reconnected`
  instead ([Events](./events.md)).
- `Events.MessageCreate` fires for every message the bot can see, including its own and system
  notices. Skip `message.author.bot` so bots don't answer each other, and skip
  `message.content === null`, which marks encrypted messages.
- `message.reply()` replies in the same room; `room.send()` sends without the reply link. Both
  return the sent `Message`.
- `client.login()` validates the token (rejecting with `TokenInvalid`), connects, and resolves once
  `clientReady` fires.

## Listeners can be async

If a listener throws or rejects, the client emits `Events.Error` and keeps going. With no `error`
listener, the error is rethrown as an uncaught exception.

## Presence

```ts
client.once(Events.ClientReady, async (ready) => {
  ready.user.setActivity('with the API'); // "Playing with the API"
  await ready.user.setPresence({ status: 'idle', customStatus: 'Type !help' });
});
```

Only "Playing" activities exist. The activity is re-sent after every reconnect. You can also pass
`new Client({ presence })`.

## Stopping

```ts
process.on('SIGINT', async () => {
  await client.destroy();
  process.exit(0);
});
```

`destroy()` closes the connection and forgets the token. The caches are kept and `login()` can be
called again. `await using client = new Client(...)` destroys it at the end of the scope.

## Deploying

Strafe has no sharding: one process serves any number of spaces. Run it under a process manager or
in a container, with the token in the environment. The client reconnects on its own, backing off up
to a minute. If the token is reset or the account is banned, it emits `Events.Invalidated` and
stops for good; exit and alert someone.

// REST without a gateway: post a message from a script, a cron job or a serverless function.
// No connection is opened and nothing is cached.
//
//   STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=... ROOM_ID=... node examples/rest-only.ts
import type { APIMessage, APISelfUser, RESTPostAPIRoomMessageJSONBody } from '@strafechat/strafe.js';
import { EmbedBuilder, REST, Routes } from '@strafechat/strafe.js';

const token = process.env.STRAFE_TOKEN;
const roomId = process.env.ROOM_ID;
if (token === undefined || roomId === undefined) throw new Error('Set STRAFE_TOKEN and ROOM_ID');

const rest = new REST({ instance: process.env.STRAFE_INSTANCE }).setToken(token);

const me = await rest.get<APISelfUser>(Routes.user());

// The wire format: `plaintext` is the message text (the library's `content`).
const body: RESTPostAPIRoomMessageJSONBody = {
  plaintext: `Nightly report from ${me.username}`,
  embeds: [new EmbedBuilder().setTitle('All systems normal').setColor('Green').setTimestamp().toJSON()],
};
const message = await rest.post<APIMessage>(Routes.roomMessages(roomId), { body });
console.log(`Posted ${message.id}`);

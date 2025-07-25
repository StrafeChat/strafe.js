import { Client } from "../src";
const client = new Client();

client.on("ready", () => {
  console.log(client.user?.displayName + " is online and ready!");
});

client.on("messageCreate", (message) => {
  if (message.author.id === client.user?.id) return;
  if (message.content === "ping") {
    message.room.send({ content: "Pong!" });
  }
});

client.on("error", (error) => {
  console.log(error);
});

client.login("bot token");

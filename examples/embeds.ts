// Embeds and files:
// - `!info` answers with an embed about the space;
// - `!roles` attaches a generated text file;
// - `!chart` uploads an image and shows it inside an embed with `attachment://`.
//
//   STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=... node examples/embeds.ts
//
// Embeds need the Embed Links permission, files need Attach Files, and neither works in an
// end-to-end encrypted room (the library refuses before sending anything).
import { AttachmentBuilder, Client, EmbedBuilder, Events, TimestampStyles, bold, time, userMention } from '@strafechat/strafe.js';

const client = new Client({ instance: process.env.STRAFE_INSTANCE });

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot === true || message.content === null || !message.inSpace()) return;
  const { space } = message;

  if (message.content === '!info') {
    const embed = new EmbedBuilder()
      .setTitle(space.name)
      .setDescription(space.description ?? 'No description.')
      .setColor('Blurple')
      .setThumbnail(space.iconURL())
      .addFields(
        { name: 'Owner', value: userMention(space.ownerId), inline: true },
        { name: 'Roles', value: String(space.roles.cache.size), inline: true },
        { name: 'Rooms', value: String(space.rooms.cache.size), inline: true },
        { name: 'Created', value: time(space.createdAt, TimestampStyles.RelativeTime) },
      )
      .setFooter({ text: `Asked by ${message.author.displayName ?? message.author.id}` })
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }

  if (message.content === '!roles') {
    // Any bytes work: a Buffer, a Blob, a stream, a local path, or an http(s) URL to download.
    const lines = space.roles.cache.map((role) => `${role.name}\t${role.hexColor}`);
    const file = new AttachmentBuilder(Buffer.from(`role\tcolor\n${lines.join('\n')}\n`), { name: 'roles.tsv' });
    await message.reply({ content: `${bold(String(lines.length))} roles:`, files: [file] });
    return;
  }

  if (message.content === '!chart') {
    // #region chart
    // A png, jpeg, gif or webp image next to this file. `attachment://<name>` in an embed points
    // at a file sent with the same message (image, thumbnail, author and footer icons).
    const chart = new AttachmentBuilder(new URL('./chart.png', import.meta.url), { name: 'chart.png' });
    const embed = new EmbedBuilder().setTitle('Messages this week').setImage('attachment://chart.png').setColor(0x57f287);
    await message.room.send({ embeds: [embed], files: [chart] });
    // #endregion chart
  }
});

await client.login();

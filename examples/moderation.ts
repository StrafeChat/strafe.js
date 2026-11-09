// Moderation commands with permission checks:
//   !kick @someone            (Kick Members)
//   !ban @someone [reason]    (Ban Members; the reason goes to the audit log)
//   !unban <user id>          (Ban Members)
//   !purge <1-100>            (Manage Messages)
//
//   STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=... node examples/moderation.ts
//
// Both the person and the bot need the permission, and both must outrank the target: kick, ban and
// nicknames follow the role hierarchy, as on Discord. The bot's managed role starts at the bottom
// of the list, so raise it above the roles it should moderate.
import type { Message, PermissionsString, SpaceMember } from '@strafechat/strafe.js';
import { BulkDeleteError, Client, Events, PermissionFlagsBits, StrafeAPIError } from '@strafechat/strafe.js';

const client = new Client({ instance: process.env.STRAFE_INSTANCE });
const prefix = '!';

/** Whether `actor` may act on `target`: the owner always, others only from a higher role. */
function outranks(actor: SpaceMember, target: SpaceMember): boolean {
  if (target.id === target.space.ownerId) return false;
  if (actor.id === actor.space.ownerId) return true;
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

async function run(message: Message<true>, command: string, args: string[]): Promise<void> {
  const { space } = message;
  // Member lists are not part of READY: fetch what you need. Both calls use the cache when they can.
  const caller = message.member ?? (await space.members.fetch(message.author.id));
  const me = space.members.me ?? (await space.members.fetchMe());

  const need = (permission: PermissionsString): boolean => {
    if (!caller.permissions.has(PermissionFlagsBits[permission])) {
      void message.reply(`You need the ${permission} permission.`);
      return false;
    }
    if (!me.permissions.has(PermissionFlagsBits[permission])) {
      void message.reply(`I need the ${permission} permission.`);
      return false;
    }
    return true;
  };

  if (command === 'kick' || command === 'ban') {
    if (!need(command === 'kick' ? 'KickMembers' : 'BanMembers')) return;
    const targetId = message.mentions.userIds[0];
    if (targetId === undefined) {
      await message.reply(`Usage: ${prefix}${command} @someone`);
      return;
    }
    const target = await space.members.fetch(targetId);
    if (!outranks(caller, target) || !outranks(me, target)) {
      await message.reply(`I cannot ${command} ${target.displayName}: they are not below both of us.`);
      return;
    }
    if (command === 'kick') {
      await target.kick(); // Strafe records no reason for kicks
    } else {
      const reason = args.slice(1).join(' ') || `Banned by ${caller.displayName}`;
      await target.ban({ reason });
    }
    await message.reply(`${target.displayName} was ${command === 'kick' ? 'kicked' : 'banned'}.`);
    return;
  }

  if (command === 'unban') {
    if (!need('BanMembers')) return;
    const id = args[0];
    if (id === undefined || !/^\d+$/.test(id)) {
      await message.reply(`Usage: ${prefix}unban <user id>`);
      return;
    }
    await space.members.unban(id);
    await message.reply(`Unbanned ${id}.`);
    return;
  }

  if (command === 'purge') {
    if (!need('ManageMessages')) return;
    const count = Number(args[0]);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      await message.reply(`Usage: ${prefix}purge <1-100>`);
      return;
    }
    // Strafe has no bulk-delete endpoint: this sends one DELETE per message, through the rate
    // limiter, so a large purge takes a moment.
    try {
      const deleted = await message.room.bulkDelete(count + 1); // the command message too
      await message.room.send(`Deleted ${String(deleted.size - 1)} messages.`);
    } catch (error) {
      if (!(error instanceof BulkDeleteError)) throw error;
      await message.room.send(`Deleted ${String(error.deleted.size)}, ${String(error.failed.size)} failed.`);
    }
  }
}

client.on(Events.MessageCreate, async (message) => {
  const { content } = message;
  if (message.author.bot === true || content === null || !content.startsWith(prefix) || !message.inSpace()) return;
  const [command = '', ...args] = content.slice(prefix.length).trim().split(/\s+/);
  try {
    await run(message, command.toLowerCase(), args);
  } catch (error) {
    // The server's answer: `status`, a `code` slug when it sends one, and its message.
    if (error instanceof StrafeAPIError) await message.reply(`That failed: ${error.message}`);
    else throw error;
  }
});

await client.login();

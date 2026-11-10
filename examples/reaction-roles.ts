// Reaction roles: `!rolemenu` (Manage Roles) posts a menu; reacting gives the role, removing the
// reaction takes it away.
//
//   STRAFE_INSTANCE=app.strafe.chat STRAFE_TOKEN=... node examples/reaction-roles.ts
//
// The bot needs Manage Roles, and its own highest role (the managed role it got when it was added,
// which starts at the bottom) must be above the roles it hands out: move it up in the space's role
// settings. Roles are matched by name here; create them first.
import type { MessageReaction, Space, User } from '@strafechat/strafe.js';
import { Client, Events, PermissionFlagsBits } from '@strafechat/strafe.js';

const client = new Client({ instance: process.env.STRAFE_INSTANCE });

/** Emoji (unicode, or a custom emoji's id) to role name. */
const menu = new Map<string, string>([
  ['🔴', 'Red'],
  ['🟢', 'Green'],
  ['🔵', 'Blue'],
]);

/** Ids of the menu messages. Keep them in a database to survive restarts. */
const menus = new Set<string>();

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot === true || message.content !== '!rolemenu' || !message.inSpace()) return;
  const caller = message.member ?? (await message.space.members.fetch(message.author.id));
  if (!caller.permissions.has(PermissionFlagsBits.ManageRoles)) return;

  const lines = [...menu].map(([emoji, role]) => `${emoji} ${role}`);
  const posted = await message.room.send(`React to get a role:\n${lines.join('\n')}`);
  menus.add(posted.id);
  for (const emoji of menu.keys()) await posted.react(emoji);
});

/** Finds the role a reaction stands for, if the reaction is on a menu. */
function roleFor(reaction: MessageReaction, user: User): { space: Space; roleId: string } | null {
  // The message may be partial (not cached): its id, room and space are still known.
  const { message } = reaction;
  if (user.bot === true || !menus.has(message.id) || !message.inSpace()) return null;
  const name = menu.get(reaction.emoji.id ?? reaction.emoji.name ?? '');
  const role = message.space.roles.cache.find((r) => r.name === name);
  return role ? { space: message.space, roleId: role.id } : null;
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const target = roleFor(reaction, user);
  if (!target) return;
  // Member lists are not in READY; fetch() uses the cache when it can.
  const member = await target.space.members.fetch(user.id);
  await member.roles.add(target.roleId);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const target = roleFor(reaction, user);
  if (!target) return;
  const member = await target.space.members.fetch(user.id);
  await member.roles.remove(target.roleId);
});

client.on(Events.Error, (error) => {
  // For example a 403 when the role is above the bot's own highest role.
  console.error(error);
});

await client.login();

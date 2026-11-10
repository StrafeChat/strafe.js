import type { Snowflake } from './Snowflake.js';

/**
 * Styles for {@link time}, rendered by every Strafe client the same way Discord's are.
 */
export const TimestampStyles = {
  /** Short time, e.g. `16:20`. */
  ShortTime: 't',
  /** Long time, e.g. `16:20:30`. */
  LongTime: 'T',
  /** Short date, e.g. `20/04/2026`. */
  ShortDate: 'd',
  /** Long date, e.g. `20 April 2026`. */
  LongDate: 'D',
  /** Short date and time, e.g. `20 April 2026 16:20`. */
  ShortDateTime: 'f',
  /** Long date and time, e.g. `Monday, 20 April 2026 16:20`. */
  LongDateTime: 'F',
  /** Relative, e.g. `2 months ago`. */
  RelativeTime: 'R',
} as const;

/** One of the {@link TimestampStyles} letters. */
export type TimestampStylesString = (typeof TimestampStyles)[keyof typeof TimestampStyles];

/**
 * Mentions a user: `<@id>`. Pings them when sent in plain text (not inside an embed).
 *
 * @param userId - The user's id on this instance.
 */
export function userMention<Id extends Snowflake>(userId: Id): `<@${Id}>` {
  return `<@${userId}>`;
}

/**
 * Mentions a role: `<@&id>`. Pings its members when the role is mentionable (or you hold Mention
 * Everyone).
 *
 * @param roleId - The role id.
 */
export function roleMention<Id extends Snowflake>(roleId: Id): `<@&${Id}>` {
  return `<@&${roleId}>`;
}

/**
 * Links a room: `<#id>`.
 *
 * @param roomId - The room id.
 */
export function roomMention<Id extends Snowflake>(roomId: Id): `<#${Id}>` {
  return `<#${roomId}>`;
}

/**
 * Formats a custom emoji: `<:name:id>`, or `<a:name:id>` when animated.
 *
 * @param emoji - The emoji's id, name and whether it is animated.
 */
export function formatEmoji(emoji: { id: Snowflake; name?: string | null; animated?: boolean | null }): string;
/**
 * Formats a custom emoji: `<:name:id>`, or `<a:name:id>` when animated.
 *
 * @param emojiId - The emoji id.
 * @param animated - Whether the emoji is animated.
 * @param name - The emoji name (clients fall back to `_` when it is omitted).
 */
export function formatEmoji(emojiId: Snowflake, animated?: boolean, name?: string): string;
export function formatEmoji(
  emoji: Snowflake | { id: Snowflake; name?: string | null; animated?: boolean | null },
  animated = false,
  name = '_',
): string {
  if (typeof emoji === 'object') {
    return `<${emoji.animated ? 'a' : ''}:${emoji.name ?? '_'}:${emoji.id}>`;
  }
  return `<${animated ? 'a' : ''}:${name}:${emoji}>`;
}

/**
 * A timestamp every reader sees in their own time zone and language: `<t:unix:style>`.
 *
 * @param date - A Date, or Unix time in SECONDS (like Discord's). Defaults to now.
 * @param style - One of {@link TimestampStyles}; the client's default when omitted.
 */
export function time(date?: Date | number, style?: TimestampStylesString): string {
  const seconds = date === undefined ? Math.floor(Date.now() / 1000) : date instanceof Date ? Math.floor(date.getTime() / 1000) : Math.floor(date);
  return style === undefined ? `<t:${seconds}>` : `<t:${seconds}:${style}>`;
}

/**
 * Wraps text in `**bold**`.
 *
 * @param content - Text to format.
 */
export function bold<C extends string>(content: C): `**${C}**` {
  return `**${content}**`;
}

/**
 * Wraps text in `*italic*`.
 *
 * @param content - Text to format.
 */
export function italic<C extends string>(content: C): `*${C}*` {
  return `*${content}*`;
}

/**
 * Wraps text in `__underline__`.
 *
 * @param content - Text to format.
 */
export function underline<C extends string>(content: C): `__${C}__` {
  return `__${content}__`;
}

/**
 * Wraps text in `~~strikethrough~~`.
 *
 * @param content - Text to format.
 */
export function strikethrough<C extends string>(content: C): `~~${C}~~` {
  return `~~${content}~~`;
}

/**
 * Wraps text in `||spoiler||` (hidden until clicked).
 *
 * @param content - Text to format.
 */
export function spoiler<C extends string>(content: C): `||${C}||` {
  return `||${content}||`;
}

/**
 * Wraps text in backticks (inline code).
 *
 * @param content - Text to format.
 */
export function inlineCode<C extends string>(content: C): `\`${C}\`` {
  return `\`${content}\``;
}

/**
 * A fenced code block, optionally with a language for highlighting.
 *
 * @param content - The code.
 */
export function codeBlock<C extends string>(content: C): `\`\`\`\n${C}\n\`\`\``;
/**
 * A fenced code block with a language for highlighting.
 *
 * @param language - Language name (`ts`, `go`, `json`...).
 * @param content - The code.
 */
export function codeBlock<L extends string, C extends string>(language: L, content: C): `\`\`\`${L}\n${C}\n\`\`\``;
export function codeBlock(language: string, content?: string): string {
  return content === undefined ? `\`\`\`\n${language}\n\`\`\`` : `\`\`\`${language}\n${content}\n\`\`\``;
}

/**
 * Quotes one line: `> text`.
 *
 * @param content - Text to quote.
 */
export function quote<C extends string>(content: C): `> ${C}` {
  return `> ${content}`;
}

/**
 * Quotes every line of a block of text.
 *
 * @param content - Text to quote.
 */
export function blockQuote(content: string): string {
  return content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

/**
 * A heading (`#`, `##` or `###`).
 *
 * @param content - Heading text.
 * @param level - 1 (largest) to 3.
 */
export function heading(content: string, level: 1 | 2 | 3 = 1): string {
  return `${'#'.repeat(level)} ${content}`;
}

/**
 * Small, muted text: `-# text`.
 *
 * @param content - Text to format.
 */
export function subtext<C extends string>(content: C): `-# ${C}` {
  return `-# ${content}`;
}

/**
 * A Markdown link: `[text](url)`, with an optional hover title.
 *
 * @param content - Link text.
 * @param url - Target URL.
 * @param title - Hover title.
 */
export function hyperlink(content: string, url: string | URL, title?: string): string {
  const href = url instanceof URL ? url.href : url;
  return title === undefined ? `[${content}](${href})` : `[${content}](${href} "${title}")`;
}

/**
 * Wraps a URL in `<>` so clients do not show a link preview for it.
 *
 * @param url - The URL.
 */
export function hideLinkEmbed(url: string | URL): string {
  return `<${url instanceof URL ? url.href : url}>`;
}

/**
 * Escapes Markdown so text shows literally (a backslash before each Markdown character).
 *
 * @param text - Text to escape.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\*_~|`>#[\]()-]/g, (char) => `\\${char}`);
}

/**
 * Makes mentions in `text` inert, so echoing user input cannot ping anyone.
 *
 * Strafe has no `allowedMentions`: the server finds `<@id>`, `<@!id>`, `<@&id>`, `@everyone` and
 * `@here` in the text of every message and notifies those people, whatever the request says. A
 * zero-width space after the `@` keeps the text readable and stops the server from matching it.
 *
 * @example
 * ```ts
 * await message.reply(escapeMentions(`You said: ${message.content}`));
 * ```
 * @param text - Text that may contain mentions.
 */
export function escapeMentions(text: string): string {
  return text.replace(/<@/g, '<@​').replace(/@(everyone|here)/g, '@​$1');
}

/**
 * All formatters in one object, for `import { Formatters } from '@strafechat/strafe.js'` users.
 */
export const Formatters = {
  userMention,
  roleMention,
  roomMention,
  formatEmoji,
  time,
  bold,
  italic,
  underline,
  strikethrough,
  spoiler,
  inlineCode,
  codeBlock,
  quote,
  blockQuote,
  heading,
  subtext,
  hyperlink,
  hideLinkEmbed,
  escapeMarkdown,
  escapeMentions,
  TimestampStyles,
} as const;

import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeRangeError, errorDetails } from '../errors/StrafeError.js';
import type { APIEmbed, APIEmbedAuthor, APIEmbedField, APIEmbedFooter, APIEmbedImage } from '../types/api/message.js';
import type { JSONEncodable, RestOrArray } from '../util/Util.js';
import { codePointLength, isJSONEncodable, normalizeArray } from '../util/Util.js';
import type { ColorResolvable } from './Colors.js';
import { resolveColor } from './Colors.js';

/**
 * Strafe's embed limits. They are Discord's numbers, counted in Unicode code points after trimming
 * (discord.js counts UTF-16 units, so an emoji-heavy text can pass there and fail here).
 */
export const EmbedLimits = {
  /** Embeds per message. */
  Embeds: 10,
  /** Title. */
  Title: 256,
  /** Description. */
  Description: 4096,
  /** Fields per embed. */
  Fields: 25,
  /** Field name. */
  FieldName: 256,
  /** Field value. */
  FieldValue: 1024,
  /** Footer text. */
  FooterText: 2048,
  /** Author name. */
  AuthorName: 256,
  /** Titles, descriptions, field names and values, footer texts and author names of every embed of a message together. */
  Total: 6000,
  /** Any URL, in bytes. */
  URLBytes: 2048,
} as const;

/** The author of an embed, camelCase like discord.js's `EmbedAuthorOptions`. */
export interface EmbedAuthorOptions {
  /** Name (required, at most 256 characters). */
  name: string;
  /** Link on the name (http or https). */
  url?: string | undefined;
  /** Icon: an http(s) URL or `attachment://<file name>`. */
  iconURL?: string | undefined;
}

/** The footer of an embed. */
export interface EmbedFooterOptions {
  /** Text (required, at most 2048 characters). */
  text: string;
  /** Icon: an http(s) URL or `attachment://<file name>`. */
  iconURL?: string | undefined;
}

/** An embed in camelCase, as discord.js's `EmbedData`; {@link EmbedBuilder} also takes the wire form. */
export interface EmbedData {
  /** Title. */
  title?: string;
  /** Description. */
  description?: string;
  /** Link on the title. */
  url?: string;
  /** Timestamp shown in the footer. */
  timestamp?: string | number | Date;
  /** Color, 0..0xFFFFFF. */
  color?: number;
  /** Footer. */
  footer?: EmbedFooterOptions & { proxyIconURL?: string };
  /** Large image. */
  image?: { url: string; proxyURL?: string; width?: number; height?: number };
  /** Thumbnail. */
  thumbnail?: { url: string; proxyURL?: string; width?: number; height?: number };
  /** Author. */
  author?: EmbedAuthorOptions & { proxyIconURL?: string };
  /** Fields. */
  fields?: APIEmbedField[];
}

function fail(path: string, reason: string): never {
  throw new StrafeRangeError(ErrorCodes.EmbedInvalid, path, reason, errorDetails({ path }));
}

function checkText(value: string, path: string, max: number, required: boolean): void {
  const length = codePointLength(value.trim());
  if (required && length === 0) fail(path, 'is required');
  if (length > max) fail(path, `can be at most ${max} characters`);
}

const encoder = new TextEncoder();

function checkURL(value: string, path: string, allowAttachment: boolean): void {
  const url = value.trim();
  if (url === '') return;
  if (allowAttachment && /^attachment:\/\//i.test(url)) {
    if (url.length === 'attachment://'.length) fail(path, 'must name an attachment');
    return;
  }
  if (encoder.encode(url).byteLength > EmbedLimits.URLBytes) fail(path, `can be at most ${EmbedLimits.URLBytes} bytes`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail(path, 'must be an http or https URL');
  }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.hostname === '') {
    fail(path, allowAttachment ? 'must be an http or https URL or attachment://<file name>' : 'must be an http or https URL');
  }
  if (parsed.username !== '' || parsed.password !== '') fail(path, 'must not contain a username or password');
}

function embedText(embed: APIEmbed): number {
  let total = 0;
  const add = (text: string | undefined): void => {
    if (text !== undefined) total += codePointLength(text.trim());
  };
  add(embed.title);
  add(embed.description);
  for (const field of embed.fields ?? []) {
    add(field.name);
    add(field.value);
  }
  add(embed.footer?.text);
  add(embed.author?.name);
  return total;
}

/**
 * Checks one embed the way the server does and throws the server's path and reason
 * (`embeds[0].fields[3].value: can be at most 1024 characters`) before any request is made.
 *
 * @param embed - The embed (wire form).
 * @param path - Prefix of error paths, e.g. `embeds[0]`.
 * @throws {@link StrafeRangeError} `EmbedInvalid` with `path` set.
 */
export function validateEmbed(embed: APIEmbed, path = 'embed'): void {
  if (embed.title !== undefined) checkText(embed.title, `${path}.title`, EmbedLimits.Title, false);
  if (embed.description !== undefined) checkText(embed.description, `${path}.description`, EmbedLimits.Description, false);
  if (embed.url !== undefined) checkURL(embed.url, `${path}.url`, false);
  if (embed.timestamp !== undefined && embed.timestamp.trim() !== '' && Number.isNaN(Date.parse(embed.timestamp))) {
    fail(`${path}.timestamp`, 'must be an RFC 3339 timestamp');
  }
  if (embed.color !== undefined && (!Number.isInteger(embed.color) || embed.color < 0 || embed.color > 0xffffff)) {
    fail(`${path}.color`, 'must be an integer from 0 to 16777215');
  }
  if (embed.author) {
    checkText(embed.author.name, `${path}.author.name`, EmbedLimits.AuthorName, true);
    if (embed.author.url !== undefined) checkURL(embed.author.url, `${path}.author.url`, false);
    if (embed.author.icon_url !== undefined) checkURL(embed.author.icon_url, `${path}.author.icon_url`, true);
  }
  const fields = embed.fields ?? [];
  if (fields.length > EmbedLimits.Fields) fail(`${path}.fields`, `an embed can have at most ${EmbedLimits.Fields} fields`);
  fields.forEach((field, index) => {
    checkText(field.name, `${path}.fields[${index}].name`, EmbedLimits.FieldName, true);
    checkText(field.value, `${path}.fields[${index}].value`, EmbedLimits.FieldValue, true);
  });
  for (const key of ['image', 'thumbnail'] as const) {
    const image = embed[key];
    if (!image) continue;
    if (image.url.trim() === '') fail(`${path}.${key}.url`, 'is required');
    checkURL(image.url, `${path}.${key}.url`, true);
  }
  if (embed.footer) {
    checkText(embed.footer.text, `${path}.footer.text`, EmbedLimits.FooterText, true);
    if (embed.footer.icon_url !== undefined) checkURL(embed.footer.icon_url, `${path}.footer.icon_url`, true);
  }
  const empty =
    (embed.title ?? '').trim() === '' &&
    (embed.description ?? '').trim() === '' &&
    fields.length === 0 &&
    !embed.author &&
    !embed.footer &&
    !embed.image &&
    !embed.thumbnail;
  if (empty) fail(path, 'has nothing to show: give it a title, description, fields, author, footer, image or thumbnail');
}

/**
 * Checks the embeds of one message: each embed ({@link validateEmbed}), at most 10, and at most
 * 6000 characters of text across all of them.
 *
 * @param embeds - The embeds (wire form).
 * @throws {@link StrafeRangeError} `EmbedInvalid` with `path` set.
 */
export function validateEmbeds(embeds: readonly APIEmbed[]): void {
  if (embeds.length > EmbedLimits.Embeds) fail('embeds', `a message can have at most ${EmbedLimits.Embeds} embeds`);
  let total = 0;
  embeds.forEach((embed, index) => {
    validateEmbed(embed, `embeds[${index}]`);
    total += embedText(embed);
  });
  if (total > EmbedLimits.Total) fail('embeds', `the embeds' text can total at most ${EmbedLimits.Total} characters`);
}

function timestampString(value: string | number | Date): string {
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

function image(data: { url: string; proxyURL?: string; proxy_url?: string; width?: number; height?: number }): APIEmbedImage {
  const out: APIEmbedImage = { url: data.url };
  const proxy = data.proxy_url ?? data.proxyURL;
  if (proxy !== undefined) out.proxy_url = proxy;
  if (data.width !== undefined) out.width = data.width;
  if (data.height !== undefined) out.height = data.height;
  return out;
}

/**
 * Turns camelCase {@link EmbedData} (or the wire form) into an {@link APIEmbed}.
 *
 * @param data - Either form.
 * @internal
 */
export function embedDataToAPI(data: APIEmbed | EmbedData): APIEmbed {
  const source = data as EmbedData & APIEmbed & {
    footer?: { text: string; iconURL?: string; icon_url?: string; proxyIconURL?: string; proxy_icon_url?: string };
    author?: { name: string; url?: string; iconURL?: string; icon_url?: string; proxyIconURL?: string; proxy_icon_url?: string };
  };
  const out: APIEmbed = {};
  if (source.type !== undefined) out.type = source.type;
  if (source.title !== undefined) out.title = source.title;
  if (source.description !== undefined) out.description = source.description;
  if (source.url !== undefined) out.url = source.url;
  if (source.timestamp !== undefined) out.timestamp = timestampString(source.timestamp);
  if (source.color !== undefined) out.color = source.color;
  if (source.footer) {
    const footer: APIEmbedFooter = { text: source.footer.text };
    const icon = source.footer.icon_url ?? source.footer.iconURL;
    if (icon !== undefined) footer.icon_url = icon;
    const proxy = source.footer.proxy_icon_url ?? source.footer.proxyIconURL;
    if (proxy !== undefined) footer.proxy_icon_url = proxy;
    out.footer = footer;
  }
  if (source.image) out.image = image(source.image);
  if (source.thumbnail) out.thumbnail = image(source.thumbnail);
  if (source.author) {
    const author: APIEmbedAuthor = { name: source.author.name };
    if (source.author.url !== undefined) author.url = source.author.url;
    const icon = source.author.icon_url ?? source.author.iconURL;
    if (icon !== undefined) author.icon_url = icon;
    const proxy = source.author.proxy_icon_url ?? source.author.proxyIconURL;
    if (proxy !== undefined) author.proxy_icon_url = proxy;
    out.author = author;
  }
  if (source.fields) out.fields = source.fields.map((field) => ({ ...field }));
  return out;
}

/**
 * Builds a rich embed within Strafe's limits ({@link EmbedLimits}). Setters check their own field
 * and throw {@link StrafeRangeError} `EmbedInvalid`; the whole message (count, 6000-character
 * total) is checked when it is sent.
 *
 * Only bots can send embeds, only in rooms that are not end-to-end encrypted, and only with the
 * Embed Links permission. External images are fetched through the instance's image proxy, so any
 * public URL works; `attachment://<file name>` shows a file sent with the same message.
 *
 * @remarks
 * Coming from discord.js: the same setters as its `EmbedBuilder`.
 *
 * @example
 * ```ts
 * const embed = new EmbedBuilder()
 *   .setTitle('Server status')
 *   .setColor('Green')
 *   .addFields({ name: 'Uptime', value: '3 days', inline: true })
 *   .setTimestamp();
 * await room.send({ embeds: [embed] });
 * ```
 */
export class EmbedBuilder implements JSONEncodable<APIEmbed> {
  /** The embed so far, in wire form. */
  public readonly data: APIEmbed;

  /**
   * @param data - Initial data, camelCase ({@link EmbedData}) or wire form ({@link APIEmbed}).
   */
  public constructor(data: APIEmbed | EmbedData = {}) {
    this.data = embedDataToAPI(data);
  }

  /**
   * A builder from an existing embed: a received {@link Embed}, another builder or wire data.
   *
   * @param other - The embed to copy.
   */
  public static from(other: APIEmbed | EmbedData | JSONEncodable<APIEmbed>): EmbedBuilder {
    return new EmbedBuilder(isJSONEncodable<APIEmbed>(other) ? other.toJSON() : other);
  }

  /**
   * Sets the title (at most 256 characters), or removes it with `null`.
   *
   * @param title - The title.
   */
  public setTitle(title: string | null): this {
    if (title === null) {
      delete this.data.title;
      return this;
    }
    checkText(title, 'title', EmbedLimits.Title, false);
    this.data.title = title;
    return this;
  }

  /**
   * Sets the description (at most 4096 characters), or removes it with `null`.
   *
   * @param description - The description.
   */
  public setDescription(description: string | null): this {
    if (description === null) {
      delete this.data.description;
      return this;
    }
    checkText(description, 'description', EmbedLimits.Description, false);
    this.data.description = description;
    return this;
  }

  /**
   * Sets the title's link (http or https), or removes it with `null`.
   *
   * @param url - The URL.
   */
  public setURL(url: string | null): this {
    if (url === null) {
      delete this.data.url;
      return this;
    }
    checkURL(url, 'url', false);
    this.data.url = url;
    return this;
  }

  /**
   * Sets the color: a {@link Colors} name, `'Random'`, `'#rrggbb'`, `[r, g, b]` or a number; `null` removes it.
   *
   * @param color - The color.
   */
  public setColor(color: ColorResolvable | null): this {
    if (color === null) {
      delete this.data.color;
      return this;
    }
    this.data.color = resolveColor(color);
    return this;
  }

  /**
   * Sets the author, or removes it with `null`.
   *
   * @param options - Name, link and icon.
   */
  public setAuthor(options: EmbedAuthorOptions | null): this {
    if (options === null) {
      delete this.data.author;
      return this;
    }
    const author: APIEmbedAuthor = { name: options.name };
    if (options.url !== undefined) author.url = options.url;
    if (options.iconURL !== undefined) author.icon_url = options.iconURL;
    validatePart({ author }, 'author');
    this.data.author = author;
    return this;
  }

  /**
   * Sets the footer, or removes it with `null`.
   *
   * @param options - Text and icon.
   */
  public setFooter(options: EmbedFooterOptions | null): this {
    if (options === null) {
      delete this.data.footer;
      return this;
    }
    const footer: APIEmbedFooter = { text: options.text };
    if (options.iconURL !== undefined) footer.icon_url = options.iconURL;
    validatePart({ footer }, 'footer');
    this.data.footer = footer;
    return this;
  }

  /**
   * Sets the large image (an http(s) URL or `attachment://<file name>`), or removes it with `null`.
   *
   * @param url - The image URL.
   */
  public setImage(url: string | null): this {
    if (url === null) {
      delete this.data.image;
      return this;
    }
    if (url.trim() === '') fail('image.url', 'is required');
    checkURL(url, 'image.url', true);
    this.data.image = { url };
    return this;
  }

  /**
   * Sets the thumbnail (an http(s) URL or `attachment://<file name>`), or removes it with `null`.
   *
   * @param url - The image URL.
   */
  public setThumbnail(url: string | null): this {
    if (url === null) {
      delete this.data.thumbnail;
      return this;
    }
    if (url.trim() === '') fail('thumbnail.url', 'is required');
    checkURL(url, 'thumbnail.url', true);
    this.data.thumbnail = { url };
    return this;
  }

  /**
   * Sets the timestamp (default now), or removes it with `null`.
   *
   * @param timestamp - A date or Unix milliseconds.
   */
  public setTimestamp(timestamp: Date | number | null = Date.now()): this {
    if (timestamp === null) {
      delete this.data.timestamp;
      return this;
    }
    this.data.timestamp = new Date(timestamp).toISOString();
    return this;
  }

  /**
   * Appends fields (at most 25 per embed; name at most 256 and value at most 1024 characters).
   *
   * @param fields - Fields, spread or as one array.
   */
  public addFields(...fields: RestOrArray<APIEmbedField>): this {
    const list = normalizeArray(fields);
    const next = [...(this.data.fields ?? []), ...list];
    checkFields(next);
    this.data.fields = next;
    return this;
  }

  /**
   * Removes, replaces or inserts fields, like `Array#splice`.
   *
   * @param index - Where to start.
   * @param deleteCount - How many fields to remove.
   * @param fields - Fields to insert there.
   */
  public spliceFields(index: number, deleteCount: number, ...fields: APIEmbedField[]): this {
    const next = [...(this.data.fields ?? [])];
    next.splice(index, deleteCount, ...fields);
    checkFields(next);
    this.data.fields = next;
    return this;
  }

  /**
   * Replaces every field.
   *
   * @param fields - Fields, spread or as one array.
   */
  public setFields(...fields: RestOrArray<APIEmbedField>): this {
    const next = normalizeArray(fields);
    checkFields(next);
    this.data.fields = next.map((field) => ({ ...field }));
    return this;
  }

  /** The number of characters that count toward the 6000 limit. */
  public get length(): number {
    return embedText(this.data);
  }

  /**
   * The wire form, ready to send. Fails if the embed has nothing to show.
   *
   * @throws {@link StrafeRangeError} `EmbedInvalid`.
   */
  public toJSON(): APIEmbed {
    validateEmbed(this.data, 'embed');
    return structuredClone(this.data);
  }
}

function validatePart(part: Pick<APIEmbed, 'author' | 'footer'>, _name: string): void {
  if (part.author) {
    checkText(part.author.name, 'author.name', EmbedLimits.AuthorName, true);
    if (part.author.url !== undefined) checkURL(part.author.url, 'author.url', false);
    if (part.author.icon_url !== undefined) checkURL(part.author.icon_url, 'author.icon_url', true);
  }
  if (part.footer) {
    checkText(part.footer.text, 'footer.text', EmbedLimits.FooterText, true);
    if (part.footer.icon_url !== undefined) checkURL(part.footer.icon_url, 'footer.icon_url', true);
  }
}

function checkFields(fields: readonly APIEmbedField[]): void {
  if (fields.length > EmbedLimits.Fields) fail('fields', `an embed can have at most ${EmbedLimits.Fields} fields`);
  fields.forEach((field, index) => {
    checkText(field.name, `fields[${index}].name`, EmbedLimits.FieldName, true);
    checkText(field.value, `fields[${index}].value`, EmbedLimits.FieldValue, true);
  });
}

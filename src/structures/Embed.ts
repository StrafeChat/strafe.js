import type { APIEmbed, APIEmbedField } from '../types/api/message.js';
import type { JSONEncodable } from '../util/Util.js';
import { codePointLength } from '../util/Util.js';

/** An embed's author as read. */
export interface EmbedAuthorData {
  /** Name. */
  name: string;
  /** Link on the name. */
  url: string | undefined;
  /** Icon URL as sent. */
  iconURL: string | undefined;
  /** Icon URL through the instance's image proxy (what clients load). */
  proxyIconURL: string | undefined;
}

/** An embed's footer as read. */
export interface EmbedFooterData {
  /** Text. */
  text: string;
  /** Icon URL as sent. */
  iconURL: string | undefined;
  /** Icon URL through the image proxy. */
  proxyIconURL: string | undefined;
}

/** An embed image or thumbnail as read. */
export interface EmbedAssetData {
  /** URL as sent. */
  url: string;
  /** URL through the image proxy. */
  proxyURL: string | undefined;
  /** Width, when known. */
  width: number | undefined;
  /** Height, when known. */
  height: number | undefined;
}

/**
 * A received embed (read-only), like discord.js's `Embed`. To change one, copy it:
 * `EmbedBuilder.from(message.embeds[0]).setTitle('New')`.
 */
export class Embed implements JSONEncodable<APIEmbed> {
  /** The wire data. */
  public readonly data: Readonly<APIEmbed>;

  /**
   * @param data - Wire data.
   */
  public constructor(data: APIEmbed) {
    this.data = { ...data };
  }

  /** Fields. */
  public get fields(): APIEmbedField[] {
    return this.data.fields ?? [];
  }

  /** Title. */
  public get title(): string | null {
    return this.data.title ?? null;
  }

  /** Description. */
  public get description(): string | null {
    return this.data.description ?? null;
  }

  /** Link on the title. */
  public get url(): string | null {
    return this.data.url ?? null;
  }

  /** Color. */
  public get color(): number | null {
    return this.data.color ?? null;
  }

  /** Color as `#rrggbb`. */
  public get hexColor(): string | null {
    return this.data.color === undefined ? null : `#${this.data.color.toString(16).padStart(6, '0')}`;
  }

  /** Timestamp (RFC 3339). */
  public get timestamp(): string | null {
    return this.data.timestamp ?? null;
  }

  /** Thumbnail. */
  public get thumbnail(): EmbedAssetData | null {
    const t = this.data.thumbnail;
    return t ? { url: t.url, proxyURL: t.proxy_url, width: t.width, height: t.height } : null;
  }

  /** Image. */
  public get image(): EmbedAssetData | null {
    const i = this.data.image;
    return i ? { url: i.url, proxyURL: i.proxy_url, width: i.width, height: i.height } : null;
  }

  /** Author. */
  public get author(): EmbedAuthorData | null {
    const a = this.data.author;
    return a ? { name: a.name, url: a.url, iconURL: a.icon_url, proxyIconURL: a.proxy_icon_url } : null;
  }

  /** Footer. */
  public get footer(): EmbedFooterData | null {
    const f = this.data.footer;
    return f ? { text: f.text, iconURL: f.icon_url, proxyIconURL: f.proxy_icon_url } : null;
  }

  /** Characters counted toward the 6000 limit. */
  public get length(): number {
    const count = (text: string | undefined): number => (text === undefined ? 0 : codePointLength(text.trim()));
    return (
      count(this.data.title) +
      count(this.data.description) +
      this.fields.reduce((total, field) => total + count(field.name) + count(field.value), 0) +
      count(this.data.footer?.text) +
      count(this.data.author?.name)
    );
  }

  /**
   * Whether two embeds hold the same data.
   *
   * @param other - The other embed.
   */
  public equals(other: Embed | APIEmbed): boolean {
    const data = other instanceof Embed ? other.data : other;
    return JSON.stringify(this.data) === JSON.stringify(data);
  }

  /** The wire form (proxy fields are dropped by the server if you send it back). */
  public toJSON(): APIEmbed {
    return structuredClone(this.data);
  }
}

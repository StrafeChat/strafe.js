import type { APIAttachment } from '../types/api/message.js';
import type { Snowflake } from '../util/Snowflake.js';

/**
 * A file on a received message. In an end-to-end encrypted room only the id, URL, size and
 * `encrypted` are known (the file itself is encrypted too).
 */
export class Attachment {
  /** The id (what `attachment://<id>` in an embed refers to). */
  public readonly id: Snowflake;
  /** File name as stored (the server replaces characters outside `A-Za-z0-9._-` with `_`). */
  public readonly name: string | null;
  /** MIME type. */
  public readonly contentType: string | null;
  /** Size in bytes. */
  public readonly size: number;
  /** Where the file is served (the instance's CDN). */
  public readonly url: string;
  /** Image width, when known. */
  public readonly width: number | null;
  /** Image height, when known. */
  public readonly height: number | null;
  /** Whether the file is end-to-end encrypted. */
  public readonly encrypted: boolean;

  /**
   * @param data - Wire data.
   */
  public constructor(data: APIAttachment) {
    this.id = data.id;
    this.name = data.filename ?? null;
    this.contentType = data.content_type ?? null;
    this.size = data.size;
    this.url = data.url;
    this.width = data.width ?? null;
    this.height = data.height ?? null;
    this.encrypted = data.encrypted === true;
  }

  /** The same as {@link Attachment.url} (Strafe serves attachments from one URL; kept for discord.js code). */
  public get proxyURL(): string {
    return this.url;
  }

  /** The wire form. */
  public toJSON(): APIAttachment {
    const out: APIAttachment = { id: this.id, size: this.size, url: this.url };
    if (this.name !== null) out.filename = this.name;
    if (this.contentType !== null) out.content_type = this.contentType;
    if (this.width !== null) out.width = this.width;
    if (this.height !== null) out.height = this.height;
    if (this.encrypted) out.encrypted = true;
    return out;
  }
}

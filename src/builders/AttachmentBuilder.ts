import type { BufferResolvable } from '../util/DataResolver.js';
import { basename } from '../util/DataResolver.js';
import type { JSONEncodable } from '../util/Util.js';

/** Options of an {@link AttachmentBuilder}. */
export interface AttachmentData {
  /** File name (what `attachment://<name>` in an embed refers to). */
  name?: string | undefined;
  /** Image width in pixels (kept by the server only together with `height`, each 1..20000). */
  width?: number | undefined;
  /** Image height in pixels. */
  height?: number | undefined;
}

/** A file to send, as plain data: `{ attachment, name }`. {@link AttachmentBuilder} produces the same. */
export interface AttachmentPayload extends AttachmentData {
  /** The file. */
  attachment: BufferResolvable;
}

/**
 * A file to send with a message. Files are uploaded to the room first (`POST /rooms/:id/attachments`)
 * and the message then names them; the library does both steps for you.
 *
 * @example
 * ```ts
 * const file = new AttachmentBuilder(new URL('./chart.png', import.meta.url), { name: 'chart.png' });
 * const embed = new EmbedBuilder().setTitle('Today').setImage('attachment://chart.png');
 * await room.send({ embeds: [embed], files: [file] });
 * ```
 */
export class AttachmentBuilder implements JSONEncodable<AttachmentPayload> {
  /** The file: bytes, a Blob, a stream, an http(s) URL, or a local file as a `file:` URL object (never a path string). */
  public attachment: BufferResolvable;
  /** File name. */
  public name: string | undefined;
  /** Image width. */
  public width: number | undefined;
  /** Image height. */
  public height: number | undefined;

  /**
   * @param attachment - The file.
   * @param data - Name and image size.
   */
  public constructor(attachment: BufferResolvable, data: AttachmentData = {}) {
    this.attachment = attachment;
    this.name = data.name ?? defaultName(attachment);
    this.width = data.width;
    this.height = data.height;
  }

  /**
   * Replaces the file.
   *
   * @param attachment - The file.
   * @param name - A new name, if any.
   */
  public setFile(attachment: BufferResolvable, name?: string): this {
    this.attachment = attachment;
    if (name !== undefined) this.name = name;
    return this;
  }

  /**
   * Sets the file name.
   *
   * @param name - The name.
   */
  public setName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Sets the image size the server records (both are needed).
   *
   * @param width - Width in pixels.
   * @param height - Height in pixels.
   */
  public setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  /** The plain form. */
  public toJSON(): AttachmentPayload {
    const out: AttachmentPayload = { attachment: this.attachment };
    if (this.name !== undefined) out.name = this.name;
    if (this.width !== undefined) out.width = this.width;
    if (this.height !== undefined) out.height = this.height;
    return out;
  }
}

function defaultName(attachment: BufferResolvable): string | undefined {
  if (typeof attachment === 'string' || attachment instanceof URL) return basename(attachment.toString());
  if (attachment instanceof Blob && typeof (attachment as Partial<File>).name === 'string') return (attachment as File).name;
  return undefined;
}

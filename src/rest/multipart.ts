import type { RawFile, RawFileData } from './types.js';

/**
 * Turns file data into a `Blob` without copying a `Blob` that is already one. A `ReadableStream`
 * is read to the end (Strafe needs the size up front).
 *
 * @param data - The bytes.
 * @param contentType - MIME type for the blob.
 */
export async function toBlob(data: RawFileData, contentType?: string): Promise<Blob> {
  const options = contentType === undefined ? undefined : { type: contentType };
  if (data instanceof Blob) {
    return contentType === undefined || data.type === contentType ? data : new Blob([data], options);
  }
  if (typeof data === 'string') return new Blob([data], options);
  if (data instanceof ArrayBuffer) return new Blob([data], options);
  if (ArrayBuffer.isView(data)) {
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Blob([view.slice()], options);
  }
  const blob = await new Response(data).blob();
  return contentType === undefined ? blob : new Blob([blob], options);
}

/**
 * Builds the `multipart/form-data` body of an upload. Each file goes in its `key` (default `file`,
 * which is what Strafe's upload routes read); each top-level field of `fields` becomes a text part
 * (Strafe has no `payload_json`).
 *
 * @param files - Files to attach.
 * @param fields - Extra form fields (`width`, `height`, `name`...); `undefined`/`null` are skipped.
 */
export async function buildFormData(files: readonly RawFile[], fields?: unknown): Promise<FormData> {
  const form = new FormData();
  for (const [index, file] of files.entries()) {
    const key = file.key ?? (files.length === 1 ? 'file' : `files[${index}]`);
    form.append(key, await toBlob(file.data, file.contentType), file.name);
  }
  if (fields !== undefined && fields !== null) {
    if (typeof fields !== 'object' || Array.isArray(fields)) {
      throw new TypeError('With files, body must be a plain object of form fields');
    }
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      form.append(key, formField(value));
    }
  }
  return form;
}

function formField(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
  return JSON.stringify(value, bigintReplacer);
}

/**
 * `JSON.stringify` replacer that writes bigints as JSON numbers (Strafe's wire type for permission
 * bits). Refuses values above `Number.MAX_SAFE_INTEGER` rather than silently losing precision.
 *
 * @param _key - Property name.
 * @param value - Property value.
 */
export function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value !== 'bigint') return value;
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${value} does not fit in a JSON number`);
  }
  return Number(value);
}

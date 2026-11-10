import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeError, StrafeTypeError, errorDetails } from '../errors/StrafeError.js';
import type { RawFileData } from '../rest/types.js';
import type { FetchLike } from '../rest/types.js';
import type * as NodeFS from 'node:fs';

/**
 * File data a send or upload accepts: bytes (`Uint8Array`/`Buffer`, `ArrayBuffer`), a `Blob` or
 * `File`, a `ReadableStream`, an `http(s)` URL as a string or `URL` (downloaded first), or a local
 * file as a `file:` `URL` object (read with `node:fs`, Node/Bun/Deno only).
 *
 * A string is never read as a local path, unlike discord.js: strings are often user input
 * (`files: [args[0]]`), and `/proc/self/environ` or `.env` would be posted to the room. Name local
 * files explicitly with `new URL('./chart.png', import.meta.url)` or `pathToFileURL(path)` from
 * `node:url`.
 */
export type BufferResolvable = Blob | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | URL | string;

/** A file, resolved and ready to upload. */
export interface ResolvedFile {
  /** File name. */
  name: string;
  /** The bytes. */
  data: RawFileData;
  /** MIME type, when known. */
  contentType?: string;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

/**
 * A MIME type for a file name, from its extension; `undefined` when unknown.
 *
 * @param name - File name.
 */
export function contentTypeFor(name: string): string | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext === undefined ? undefined : MIME[ext];
}

/**
 * The last path segment of a path or URL.
 *
 * @internal
 */
export function basename(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? path;
  const segments = clean.split(/[\\/]/).filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? 'file');
}

/**
 * Resolves {@link BufferResolvable} into bytes and a name.
 *
 * @param input - The file.
 * @param name - The name to use (default: from the URL or `File`, else `file.bin`).
 * @param fetchImpl - The `fetch` used to download URLs (default: the global one).
 * @throws {@link StrafeError} `FileInvalid` when a file or URL cannot be read;
 *   {@link StrafeTypeError} `FileInvalid` for a string that is not an `http(s)` URL (local files
 *   need a `file:` `URL` object) or a URL of another scheme.
 */
export async function resolveFile(input: BufferResolvable, name?: string, fetchImpl?: FetchLike): Promise<ResolvedFile> {
  if (input instanceof URL) {
    if (input.protocol === 'http:' || input.protocol === 'https:') return download(input.href, name, fetchImpl);
    if (input.protocol === 'file:') {
      const fileName = name ?? basename(input.pathname);
      return withType({ name: fileName, data: await readPath(input) }, contentTypeFor(fileName));
    }
    throw new StrafeTypeError(ErrorCodes.FileInvalid, `${input.protocol} URLs cannot be read (use http(s), or file: for a local file)`);
  }
  if (typeof input === 'string') {
    if (/^https?:\/\//i.test(input)) return download(input, name, fetchImpl);
    throw new StrafeTypeError(
      ErrorCodes.FileInvalid,
      `${JSON.stringify(input.length > 80 ? `${input.slice(0, 80)}...` : input)} is not an http(s) URL. A string is never read as a local path, ` +
        "since it may be user input; pass a file: URL instead, such as new URL('./file.png', import.meta.url) or pathToFileURL(path) from node:url",
    );
  }
  if (input instanceof Blob) {
    const fileName = name ?? (typeof (input as Partial<File>).name === 'string' && (input as File).name !== '' ? (input as File).name : 'file.bin');
    return withType({ name: fileName, data: input }, input.type === '' ? contentTypeFor(fileName) : input.type);
  }
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input) || isReadableStream(input)) {
    const fileName = name ?? 'file.bin';
    return withType({ name: fileName, data: input }, contentTypeFor(fileName));
  }
  throw new StrafeTypeError(ErrorCodes.FileInvalid, 'expected bytes, a Blob, a stream, an http(s) URL or a file: URL');
}

async function download(url: string, name: string | undefined, fetchImpl: FetchLike | undefined): Promise<ResolvedFile> {
  const fetcher: FetchLike = fetchImpl ?? ((target, init) => fetch(target, init));
  let response: Response;
  try {
    response = await fetcher(url, { method: 'GET' });
  } catch (error) {
    throw new StrafeError(ErrorCodes.FileInvalid, `${url} could not be downloaded`, errorDetails({ cause: error }));
  }
  if (!response.ok) throw new StrafeError(ErrorCodes.FileInvalid, `${url} answered ${response.status}`);
  const blob = await response.blob();
  const fileName = name ?? basename(new URL(url).pathname);
  return withType({ name: fileName, data: blob }, blob.type);
}

function withType(file: ResolvedFile, type: string | undefined): ResolvedFile {
  if (type !== undefined && type !== '') file.contentType = type;
  return file;
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

async function readPath(path: URL): Promise<Blob> {
  // Loaded lazily so the library has no `node:` import at module load (REST and builders also run
  // where there is no file system).
  let fs: typeof NodeFS;
  try {
    fs = await import('node:fs');
  } catch (error) {
    throw new StrafeError(ErrorCodes.FileInvalid, `${path.href}: this runtime has no file system`, errorDetails({ cause: error }));
  }
  try {
    if (typeof fs.openAsBlob === 'function') return await fs.openAsBlob(path);
    const bytes = await fs.promises.readFile(path);
    return new Blob([bytes]);
  } catch (error) {
    throw new StrafeError(ErrorCodes.FileInvalid, `${path.href} could not be read`, errorDetails({ cause: error }));
  }
}

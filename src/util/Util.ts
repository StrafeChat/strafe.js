import type { Snowflake } from './Snowflake.js';

/**
 * `A` when `T` is `true`, otherwise `B`. Used for values that only exist once the client is ready:
 * `Client<true>['user']` is a `ClientUser`, `Client<boolean>['user']` is `ClientUser | null`.
 */
export type If<T extends boolean, A, B = null> = T extends true ? A : T extends false ? B : A | B;

/** A value or a promise of it. */
export type Awaitable<T> = T | PromiseLike<T>;

/** Arguments given either spread or as one array: `addFields(a, b)` or `addFields([a, b])`. */
export type RestOrArray<T> = T[] | [T[]];

/** Anything with a `toJSON()` that returns `T`, such as a builder. */
export interface JSONEncodable<T> {
  /** The JSON form. */
  toJSON(): T;
}

/**
 * Flattens {@link RestOrArray} arguments.
 *
 * @param args - The spread arguments.
 */
export function normalizeArray<T>(args: RestOrArray<T>): T[] {
  const [first] = args;
  if (args.length === 1 && Array.isArray(first)) return [...first];
  return [...(args as T[])];
}

/**
 * Whether `value` has a `toJSON` method.
 *
 * @param value - Anything.
 */
export function isJSONEncodable<T = unknown>(value: unknown): value is JSONEncodable<T> {
  return typeof value === 'object' && value !== null && typeof (value as { toJSON?: unknown }).toJSON === 'function';
}

/**
 * Length in Unicode code points, which is how Strafe counts message and embed limits (an emoji
 * counts once, unlike `string.length`).
 *
 * @param text - The text.
 */
export function codePointLength(text: string): number {
  let count = 0;
  for (const _ of text) count++;
  return count;
}

/**
 * Parses an RFC 3339 timestamp; `null` for a missing value or Go's zero time.
 *
 * @internal
 */
export function parseTimestamp(value: string | null | undefined): number | null {
  if (value === undefined || value === null || value === '' || value.startsWith('0001-01-01')) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/**
 * `""` and `undefined` as `null`, for URL fields where the server sends `""` for "none".
 *
 * @internal
 */
export function emptyToNull(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value;
}

/** Things that resolve to an id: the id itself or an object with one. @internal */
export type IdResolvable = Snowflake | { id: Snowflake };

/**
 * The id of an id or an object with an `id`.
 *
 * @internal
 */
export function idOf(value: IdResolvable): Snowflake {
  return typeof value === 'string' ? value : value.id;
}

/**
 * Makes a URL absolute against a base (proxy URLs come as `/media/v1/...` when the instance has no
 * public URL configured).
 *
 * @internal
 */
export function absoluteURL(url: string | undefined, base: string): string | undefined {
  if (url === undefined || url === '') return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  // The proxy is mounted under the API base, so `/media/v1/...` means `<api>/media/v1/...`.
  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

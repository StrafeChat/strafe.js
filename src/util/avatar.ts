import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeRangeError } from '../errors/StrafeError.js';
import type { Snowflake } from './Snowflake.js';

/**
 * How many default avatars every instance serves: `<web>/avatars/default/0.png` to `7.png`, each a
 * 256 px PNG.
 */
export const DefaultAvatarCount = 8;

/**
 * Which default avatar a user gets: `(BigInt(id) >> 22n) % 8n`, the same rule as the web client
 * (discord.js's `calculateUserDefaultAvatarIndex`, with Strafe's eight images).
 *
 * Pass the id the user's HOME instance knows them by ({@link User.originId} for someone from another
 * instance), so every instance shows a person the same picture. Input that is not a decimal
 * snowflake gives `0` rather than throwing.
 *
 * @param userId - The user's id on their home instance, as a string or bigint.
 * @returns An index from 0 to 7.
 * @example
 * ```ts
 * calculateUserDefaultAvatarIndex('1310000000000000000'); // 7
 * ```
 */
export function calculateUserDefaultAvatarIndex(userId: Snowflake | bigint): number {
  let value: bigint;
  if (typeof userId === 'bigint') value = userId;
  else if (/^\d+$/.test(userId)) value = BigInt(userId);
  else return 0;
  if (value < 0n) return 0;
  return Number((value >> 22n) % BigInt(DefaultAvatarCount));
}

/**
 * The URL of a default avatar on an instance's web client (discord.js's `CDN#defaultAvatar`).
 * The images are the same on every instance, so the local web origin serves remote users' too.
 *
 * @param web - The web client's origin, e.g. `client.urls.web` (a trailing slash is ignored).
 * @param index - From {@link calculateUserDefaultAvatarIndex}.
 * @throws {@link StrafeRangeError} `InvalidArgument` when `index` is not an integer from 0 to 7.
 * @example
 * ```ts
 * buildDefaultAvatarURL('https://app.strafe.chat', 4); // 'https://app.strafe.chat/avatars/default/4.png'
 * ```
 */
export function buildDefaultAvatarURL(web: string, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= DefaultAvatarCount) {
    throw new StrafeRangeError(ErrorCodes.InvalidArgument, `Default avatar index must be an integer from 0 to ${DefaultAvatarCount - 1}, got ${index}`);
  }
  return `${web.replace(/\/+$/, '')}/avatars/default/${index}.png`;
}

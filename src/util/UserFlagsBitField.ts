import { UserFlags } from '../types/api/user.js';
import { BitField } from './BitField.js';

/** A badge name from {@link UserFlags}. */
export type UserFlagsString = keyof typeof UserFlags;

/**
 * A user's badges (`public_flags`), like discord.js's `UserFlagsBitField`.
 *
 * @example
 * ```ts
 * if (user.flags?.has('Staff')) console.log(`${user.tag} works on Strafe`);
 * ```
 */
export class UserFlagsBitField extends BitField<UserFlagsString> {
  /** Badge name to bit. */
  public static override Flags: Readonly<Record<UserFlagsString, number>> = UserFlags;
}

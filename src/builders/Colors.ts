import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeRangeError, StrafeTypeError } from '../errors/StrafeError.js';

/**
 * Named colors, for `setColor(Colors.Red)` or `setColor('Red')`.
 *
 * @remarks
 * Coming from discord.js: the same names and values as its `Colors`, so ported code works
 * unchanged.
 */
export const Colors = {
  /** `#000000` */
  Default: 0x000000,
  /** `#ffffff` */
  White: 0xffffff,
  /** `#1abc9c` */
  Aqua: 0x1abc9c,
  /** `#57f287` */
  Green: 0x57f287,
  /** `#3498db` */
  Blue: 0x3498db,
  /** `#fee75c` */
  Yellow: 0xfee75c,
  /** `#9b59b6` */
  Purple: 0x9b59b6,
  /** `#e91e63` */
  LuminousVividPink: 0xe91e63,
  /** `#eb459e` */
  Fuchsia: 0xeb459e,
  /** `#f1c40f` */
  Gold: 0xf1c40f,
  /** `#e67e22` */
  Orange: 0xe67e22,
  /** `#ed4245` */
  Red: 0xed4245,
  /** `#95a5a6` */
  Grey: 0x95a5a6,
  /** `#34495e` */
  Navy: 0x34495e,
  /** `#11806a` */
  DarkAqua: 0x11806a,
  /** `#1f8b4c` */
  DarkGreen: 0x1f8b4c,
  /** `#206694` */
  DarkBlue: 0x206694,
  /** `#71368a` */
  DarkPurple: 0x71368a,
  /** `#ad1457` */
  DarkVividPink: 0xad1457,
  /** `#c27c0e` */
  DarkGold: 0xc27c0e,
  /** `#a84300` */
  DarkOrange: 0xa84300,
  /** `#992d22` */
  DarkRed: 0x992d22,
  /** `#979c9f` */
  DarkGrey: 0x979c9f,
  /** `#7f8c8d` */
  DarkerGrey: 0x7f8c8d,
  /** `#bcc0c0` */
  LightGrey: 0xbcc0c0,
  /** `#2c3e50` */
  DarkNavy: 0x2c3e50,
  /** `#5865f2` */
  Blurple: 0x5865f2,
  /** `#99aab5` */
  Greyple: 0x99aab5,
  /** `#2c2f33` */
  DarkButNotBlack: 0x2c2f33,
  /** `#23272a` */
  NotQuiteBlack: 0x23272a,
} as const;

/** A color name from {@link Colors}. */
export type ColorName = keyof typeof Colors;

/** `#rrggbb` (the `#` is optional). */
export type HexColorString = `#${string}`;

/**
 * Anything {@link resolveColor} understands: a {@link Colors} name, `'Random'`, a hex string, an
 * integer 0..0xFFFFFF or `[r, g, b]`.
 */
export type ColorResolvable = ColorName | 'Random' | HexColorString | number | readonly [red: number, green: number, blue: number];

/**
 * Turns a {@link ColorResolvable} into the integer Strafe expects.
 *
 * @param color - The color.
 * @throws {@link StrafeRangeError} `ColorInvalid` for a value out of range, {@link StrafeTypeError} for an unknown name.
 *
 * @example
 * ```ts
 * resolveColor('#ff8800'); // 0xff8800
 * resolveColor([255, 136, 0]); // 0xff8800
 * ```
 */
export function resolveColor(color: ColorResolvable): number {
  let value: number;
  if (typeof color === 'string') {
    if (color === 'Random') return Math.floor(Math.random() * 0x1000000);
    if (Object.hasOwn(Colors, color)) return Colors[color as ColorName];
    const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color);
    if (!hex) throw new StrafeTypeError(ErrorCodes.ColorInvalid, color);
    let digits = hex[1] ?? '';
    if (digits.length === 3) digits = digits.replace(/./g, '$&$&');
    value = Number.parseInt(digits, 16);
  } else if (Array.isArray(color)) {
    const [r, g, b] = color as readonly [number, number, number];
    for (const part of [r, g, b]) {
      if (!Number.isInteger(part) || part < 0 || part > 255) throw new StrafeRangeError(ErrorCodes.ColorInvalid, color);
    }
    value = (r << 16) + (g << 8) + b;
  } else {
    value = color as number;
  }
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) throw new StrafeRangeError(ErrorCodes.ColorInvalid, color);
  return value;
}

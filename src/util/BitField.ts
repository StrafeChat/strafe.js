import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeRangeError } from '../errors/StrafeError.js';

/** A nested readonly array, for resolvables like `[['A', 'B'], 'C']`. */
export type RecursiveReadonlyArray<T> = readonly (T | RecursiveReadonlyArray<T>)[];

/**
 * Anything {@link BitField.resolve} accepts: a flag name, a number/bigint, a numeric string,
 * another bitfield, or an array of those.
 */
export type BitFieldResolvable<S extends string, N extends number | bigint> =
  | RecursiveReadonlyArray<S | N | `${bigint}` | Readonly<BitField<S, N>>>
  | S
  | N
  | `${bigint}`
  | Readonly<BitField<S, N>>;

/** The static side every bitfield class provides. */
interface BitFieldStatics<N extends number | bigint> {
  Flags: Readonly<Record<string, N>>;
  DefaultBit: N;
  resolve(bit?: unknown): N;
  new (bits?: unknown): BitField<string, N>;
}

/**
 * A set of flags packed into a number or bigint. {@link PermissionsBitField} is the one most bots
 * use.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `BitField`.
 *
 * @typeParam S - Flag names.
 * @typeParam N - `number` or `bigint`.
 */
export class BitField<S extends string, N extends number | bigint = number> {
  /** Flag name to bit. Subclasses replace this. */
  public static Flags: Readonly<Record<string, number | bigint>> = {};

  /** The empty value (`0` or `0n`); decides whether the field is a number or a bigint. */
  public static DefaultBit: number | bigint = 0;

  /** The raw bits. */
  public bitfield: N;

  /**
   * @param bits - Initial bits; defaults to none.
   */
  public constructor(bits?: BitFieldResolvable<S, N>) {
    this.bitfield = this.statics.resolve(bits ?? this.statics.DefaultBit);
  }

  private get statics(): BitFieldStatics<N> {
    return this.constructor as unknown as BitFieldStatics<N>;
  }

  /**
   * Whether any of `bit` is set.
   *
   * @param bit - Bits to check.
   */
  public any(bit: BitFieldResolvable<S, N>): boolean {
    return (this.bitfield & (this.statics.resolve(bit) as never)) !== this.statics.DefaultBit;
  }

  /**
   * Whether this bitfield equals `bit` exactly.
   *
   * @param bit - Bits to compare with.
   */
  public equals(bit: BitFieldResolvable<S, N>): boolean {
    return this.bitfield === this.statics.resolve(bit);
  }

  /**
   * Whether every bit of `bit` is set.
   *
   * @param bit - Bits to check.
   * @param _hasParams - Used by subclasses (e.g. `checkAdmin`).
   */
  public has(bit: BitFieldResolvable<S, N>, ..._hasParams: unknown[]): boolean {
    const resolved = this.statics.resolve(bit);
    return (this.bitfield & (resolved as never)) === resolved;
  }

  /**
   * The names of the flags in `bits` that this bitfield lacks.
   *
   * @param bits - Bits that are needed.
   * @param hasParams - Passed to `has` (e.g. `checkAdmin`).
   */
  public missing(bits: BitFieldResolvable<S, N>, ...hasParams: unknown[]): S[] {
    return new this.statics(bits).remove(this).toArray(...hasParams) as S[];
  }

  /** Freezes the bitfield; `add`/`remove` then return a new one. */
  public freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /**
   * Sets bits (on a frozen bitfield, returns a new one instead).
   *
   * @param bits - Bits to add.
   */
  public add(...bits: BitFieldResolvable<S, N>[]): this {
    let total = this.statics.DefaultBit;
    for (const bit of bits) total = (total | (this.statics.resolve(bit) as never)) as N;
    if (Object.isFrozen(this)) return new this.statics((this.bitfield | (total as never))) as this;
    this.bitfield = (this.bitfield | (total as never)) as N;
    return this;
  }

  /**
   * Clears bits (on a frozen bitfield, returns a new one instead).
   *
   * @param bits - Bits to remove.
   */
  public remove(...bits: BitFieldResolvable<S, N>[]): this {
    let total = this.statics.DefaultBit;
    for (const bit of bits) total = (total | (this.statics.resolve(bit) as never)) as N;
    const next = (this.bitfield & ~(total as never)) as N;
    if (Object.isFrozen(this)) return new this.statics(next) as this;
    this.bitfield = next;
    return this;
  }

  /**
   * Every flag name mapped to whether it is set.
   *
   * @param hasParams - Passed to `has`.
   */
  public serialize(...hasParams: unknown[]): Record<S, boolean> {
    const serialized: Partial<Record<S, boolean>> = {};
    for (const [flag, bit] of Object.entries(this.statics.Flags)) {
      if (Number.isNaN(Number(flag))) serialized[flag as S] = this.has(bit, ...hasParams);
    }
    return serialized as Record<S, boolean>;
  }

  /**
   * The names of the set flags.
   *
   * @param hasParams - Passed to `has`.
   */
  public toArray(...hasParams: unknown[]): S[] {
    return [...this.iterate(hasParams)];
  }

  /** The bits as a JSON number (Strafe sends and accepts numbers, never strings). */
  public toJSON(): number {
    return toSafeNumber(this.bitfield);
  }

  /** The raw bits. */
  public valueOf(): N {
    return this.bitfield;
  }

  /** Iterates the names of the set flags (the same names as {@link BitField.toArray}). */
  public *[Symbol.iterator](): IterableIterator<S> {
    yield* this.toArray();
  }

  private *iterate(hasParams: unknown[]): IterableIterator<S> {
    for (const [flag, bit] of Object.entries(this.statics.Flags)) {
      if (Number.isNaN(Number(flag)) && this.has(bit, ...hasParams)) yield flag as S;
    }
  }

  /**
   * Turns a resolvable into raw bits.
   *
   * @param bit - Flag name, number/bigint, numeric string, bitfield or array of those.
   * @throws {@link StrafeRangeError} with `BitFieldInvalid` for an unknown name or a negative number.
   */
  public static resolve(bit?: unknown): number | bigint {
    const { DefaultBit } = this;
    if (bit === undefined) return DefaultBit;
    if (typeof bit === typeof DefaultBit && (bit as number | bigint) >= DefaultBit) return bit as number | bigint;
    if (typeof DefaultBit === 'bigint' && typeof bit === 'number' && Number.isInteger(bit) && bit >= 0) return BigInt(bit);
    if (typeof DefaultBit === 'number' && typeof bit === 'bigint' && bit >= 0n && bit <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(bit);
    }
    if (bit instanceof BitField) return this.resolve((bit as BitField<string, number | bigint>).bitfield);
    if (Array.isArray(bit)) {
      let total = DefaultBit;
      for (const part of bit as unknown[]) total = ((total as never) | (this.resolve(part) as never));
      return total;
    }
    if (typeof bit === 'string') {
      if (/^\d+$/.test(bit)) return typeof DefaultBit === 'bigint' ? BigInt(bit) : Number(bit);
      const flag = this.Flags[bit];
      if (flag !== undefined) return flag;
    }
    throw new StrafeRangeError(ErrorCodes.BitFieldInvalid, bit);
  }
}

function toSafeNumber(value: number | bigint): number {
  if (typeof value === 'number') return value;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new StrafeRangeError(ErrorCodes.InvalidArgument, `Bitfield ${value} does not fit in a JSON number`);
  }
  return Number(value);
}

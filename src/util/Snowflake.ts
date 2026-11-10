/**
 * An id as Strafe sends it: a decimal string of a 64-bit snowflake (e.g. `"2102226824774811648"`).
 *
 * Ids are larger than `Number.MAX_SAFE_INTEGER`, so keep them as strings. They are local to the
 * instance that minted them: a person from another instance has a different id on each instance
 * (see `User#handle` for the stable `name@domain` form).
 */
export type Snowflake = string;

/** The parts of a snowflake, as returned by {@link SnowflakeUtil.deconstruct}. */
export interface DeconstructedSnowflake {
  /** The id as a bigint. */
  id: bigint;
  /** Milliseconds since the Unix epoch when the id was minted. */
  timestamp: number;
  /** The id of the server node that minted it (10 bits). */
  nodeId: number;
  /** Per-millisecond sequence number (12 bits). */
  increment: number;
  /** The epoch the timestamp is relative to. */
  epoch: number;
}

/** Options for {@link SnowflakeUtil.generate}. */
export interface SnowflakeGenerateOptions {
  /** Time to encode; defaults to now. */
  timestamp?: number | Date;
  /** Node id (0-1023); defaults to 0. */
  nodeId?: number;
  /** Sequence number (0-4095); defaults to an internal counter. */
  increment?: number;
}

const NODE_BITS = 10n;
const STEP_BITS = 12n;
const TIME_SHIFT = NODE_BITS + STEP_BITS;

let counter = 0n;

/**
 * Helpers for Strafe's snowflake ids.
 *
 * Strafe mints ids with `bwmarrin/snowflake`'s defaults: epoch 1288834974657 (2010-11-04, NOT
 * Discord's 2015 epoch), 10 node bits and 12 sequence bits. Copying discord.js's `SnowflakeUtil`
 * would give dates five years off.
 *
 * @example
 * ```ts
 * SnowflakeUtil.timestampFrom('2102226824774811648'); // 1790044907169 (2026-09-22T02:41:47.169Z)
 * ```
 */
export class SnowflakeUtil {
  private constructor() {
    // static only
  }

  /** Strafe's snowflake epoch in milliseconds (2010-11-04T01:42:54.657Z). */
  public static readonly EPOCH = 1288834974657;

  /** {@link SnowflakeUtil.EPOCH} as a bigint. */
  public static readonly EPOCH_BIGINT = 1288834974657n;

  /**
   * Splits an id into its timestamp, node and sequence parts.
   *
   * @param id - A snowflake (string or bigint).
   */
  public static deconstruct(id: Snowflake | bigint): DeconstructedSnowflake {
    const value = typeof id === 'bigint' ? id : BigInt(id);
    return {
      id: value,
      timestamp: Number((value >> TIME_SHIFT) + SnowflakeUtil.EPOCH_BIGINT),
      nodeId: Number((value >> STEP_BITS) & ((1n << NODE_BITS) - 1n)),
      increment: Number(value & ((1n << STEP_BITS) - 1n)),
      epoch: SnowflakeUtil.EPOCH,
    };
  }

  /**
   * The Unix time in milliseconds at which `id` was minted.
   *
   * @param id - A snowflake.
   */
  public static timestampFrom(id: Snowflake | bigint): number {
    const value = typeof id === 'bigint' ? id : BigInt(id);
    return Number((value >> TIME_SHIFT) + SnowflakeUtil.EPOCH_BIGINT);
  }

  /**
   * The date at which `id` was minted.
   *
   * @param id - A snowflake.
   */
  public static dateFrom(id: Snowflake | bigint): Date {
    return new Date(SnowflakeUtil.timestampFrom(id));
  }

  /**
   * Builds a snowflake for a moment in time. Useful as a pagination cursor
   * (`room.messages.fetch({ after: SnowflakeUtil.generate({ timestamp: yesterday }) })`); it is not
   * an id the server knows.
   *
   * @param options - Time, node and sequence.
   */
  public static generate(options: SnowflakeGenerateOptions = {}): Snowflake {
    const time = options.timestamp instanceof Date ? options.timestamp.getTime() : (options.timestamp ?? Date.now());
    const node = BigInt(options.nodeId ?? 0) & ((1n << NODE_BITS) - 1n);
    let step: bigint;
    if (options.increment === undefined) {
      step = counter;
      counter = (counter + 1n) & ((1n << STEP_BITS) - 1n);
    } else {
      step = BigInt(options.increment) & ((1n << STEP_BITS) - 1n);
    }
    const ms = BigInt(Math.trunc(time)) - SnowflakeUtil.EPOCH_BIGINT;
    if (ms < 0n) throw new RangeError('Cannot generate a snowflake before the Strafe epoch (2010-11-04)');
    return ((ms << TIME_SHIFT) | (node << STEP_BITS) | step).toString();
  }

  /**
   * Compares two ids by age: negative when `a` is older, positive when newer, 0 when equal.
   * Works as an `Array#sort` / `Collection#sort` comparator.
   *
   * @param a - First id.
   * @param b - Second id.
   */
  public static compare(a: Snowflake, b: Snowflake): number {
    const x = BigInt(a);
    const y = BigInt(b);
    return x === y ? 0 : x < y ? -1 : 1;
  }

  /**
   * Whether `value` looks like a snowflake (a decimal string of up to 20 digits).
   *
   * @param value - Anything.
   */
  public static isSnowflake(value: unknown): value is Snowflake {
    return typeof value === 'string' && /^\d{1,20}$/.test(value);
  }
}

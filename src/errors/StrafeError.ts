import type { ErrorCodes} from './ErrorCodes.js';
import { ErrorMessages } from './ErrorCodes.js';

/** Extra fields a library error may carry; pass as the last constructor argument via {@link errorDetails}. */
export interface StrafeErrorDetails {
  /** Where in the payload the problem is, e.g. `embeds[0].fields[3].value`. */
  path?: string;
  /** The underlying error. */
  cause?: unknown;
}

const DETAILS = Symbol('strafe.errorDetails');

/**
 * Bundles {@link StrafeErrorDetails} so a library error can take them as its last argument.
 *
 * @example
 * ```ts
 * throw new StrafeError(ErrorCodes.EmbedInvalid, 'embeds[0].title', 'too long', errorDetails({ path: 'embeds[0].title' }));
 * ```
 * @param details - Path and cause.
 */
export function errorDetails(details: StrafeErrorDetails): StrafeErrorDetails {
  return Object.assign({ [DETAILS]: true }, details);
}

function isDetails(value: unknown): value is StrafeErrorDetails {
  return typeof value === 'object' && value !== null && DETAILS in value;
}

function split(args: unknown[]): { rest: unknown[]; details: StrafeErrorDetails | undefined } {
  const last = args.at(-1);
  return isDetails(last) ? { rest: args.slice(0, -1), details: last } : { rest: args, details: undefined };
}

function format(code: ErrorCodes, args: unknown[]): string {
  const formatter = ErrorMessages[code] as string | ((...a: unknown[]) => string);
  return typeof formatter === 'function' ? formatter(...args) : formatter;
}

/**
 * An error raised by the library itself (not by the server). `code` is one of {@link ErrorCodes};
 * the message is filled in from the code and the arguments.
 *
 * @example
 * ```ts
 * if (error instanceof StrafeError && error.code === ErrorCodes.RoomEncrypted) console.log('skip encrypted room');
 * ```
 */
export class StrafeError extends Error {
  /** What went wrong. */
  public readonly code: ErrorCodes;
  /** Where in the payload the problem is, when known. */
  public readonly path: string | undefined;

  /**
   * @param code - The error code.
   * @param args - Values for the code's message, optionally followed by {@link errorDetails}.
   */
  public constructor(code: ErrorCodes, ...args: unknown[]) {
    const { rest, details } = split(args);
    super(format(code, rest), details?.cause === undefined ? undefined : { cause: details.cause });
    this.code = code;
    this.path = details?.path;
  }

  /** `StrafeError [Code]`, so logs show the code. */
  public override get name(): string {
    return `StrafeError [${this.code}]`;
  }
}

/** A library error for an argument of the wrong type. Same fields as {@link StrafeError}. */
export class StrafeTypeError extends TypeError {
  /** What went wrong. */
  public readonly code: ErrorCodes;
  /** Where in the payload the problem is, when known. */
  public readonly path: string | undefined;

  /**
   * @param code - The error code.
   * @param args - Values for the code's message, optionally followed by {@link errorDetails}.
   */
  public constructor(code: ErrorCodes, ...args: unknown[]) {
    const { rest, details } = split(args);
    super(format(code, rest), details?.cause === undefined ? undefined : { cause: details.cause });
    this.code = code;
    this.path = details?.path;
  }

  /** `StrafeTypeError [Code]`. */
  public override get name(): string {
    return `StrafeTypeError [${this.code}]`;
  }
}

/** A library error for a value out of range (too long, too many, unknown flag). Same fields as {@link StrafeError}. */
export class StrafeRangeError extends RangeError {
  /** What went wrong. */
  public readonly code: ErrorCodes;
  /** Where in the payload the problem is, when known. */
  public readonly path: string | undefined;

  /**
   * @param code - The error code.
   * @param args - Values for the code's message, optionally followed by {@link errorDetails}.
   */
  public constructor(code: ErrorCodes, ...args: unknown[]) {
    const { rest, details } = split(args);
    super(format(code, rest), details?.cause === undefined ? undefined : { cause: details.cause });
    this.code = code;
    this.path = details?.path;
  }

  /** `StrafeRangeError [Code]`. */
  public override get name(): string {
    return `StrafeRangeError [${this.code}]`;
  }
}

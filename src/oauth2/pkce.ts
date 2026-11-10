import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeRangeError, StrafeError } from '../errors/StrafeError.js';

/** A PKCE (RFC 7636) verifier and its S256 challenge, from {@link createPKCE}. */
export interface PKCEPair {
  /**
   * The secret. Keep it with the login attempt (a session, an HTTP-only cookie) and pass it to
   * {@link OAuth2Client.exchangeCode}; never put it in the authorization URL.
   */
  verifier: string;
  /** `base64url(SHA-256(verifier))`, for the authorization URL. */
  challenge: string;
  /** Always `S256`: Strafe refuses `plain`. */
  method: 'S256';
}

/** Options of {@link createPKCE}. */
export interface CreatePKCEOptions {
  /** Length of the verifier, 43 to 128 characters. Default 64. */
  length?: number;
}

/** RFC 7636's grammar for a verifier and an S256 challenge: 43-128 of `[A-Za-z0-9-._~]`. */
const PKCE_GRAMMAR = /^[A-Za-z0-9\-._~]{43,128}$/;

/**
 * Whether a string is a valid PKCE verifier or S256 challenge (43-128 characters of
 * `[A-Za-z0-9-._~]`, the grammar Strafe checks).
 *
 * @param value - The verifier or challenge.
 */
export function isValidPKCEString(value: string): boolean {
  return PKCE_GRAMMAR.test(value);
}

/**
 * Creates a PKCE verifier and its S256 challenge with WebCrypto (Node.js, Bun, Deno and browsers).
 *
 * PKCE makes an authorization code useless to anyone who intercepts the redirect, because
 * redeeming it needs the verifier. Strafe supports it on every authorization (S256 only). It does
 * not make public clients possible: the token endpoint still needs the client secret, so the code
 * exchange always happens on your server.
 *
 * @param options - Verifier length.
 * @throws {@link StrafeRangeError} `InvalidArgument` for a length outside 43-128.
 * @example
 * ```ts
 * const pkce = await createPKCE();
 * session.verifier = pkce.verifier;
 * const url = oauth.generateAuthURL({ scopes: [OAuth2Scopes.Identify], state, codeChallenge: pkce.challenge });
 * ```
 */
export async function createPKCE(options: CreatePKCEOptions = {}): Promise<PKCEPair> {
  const length = options.length ?? 64;
  if (!Number.isInteger(length) || length < 43 || length > 128) {
    throw new StrafeRangeError(ErrorCodes.InvalidArgument, `A PKCE verifier is 43 to 128 characters long (got ${String(length)}).`);
  }
  const verifier = base64url(randomBytes(Math.ceil((length * 3) / 4))).slice(0, length);
  return { verifier, challenge: await pkceChallenge(verifier), method: 'S256' };
}

/**
 * The S256 challenge of a verifier: `base64url(SHA-256(verifier))` without padding.
 *
 * @param verifier - A PKCE verifier.
 * @throws {@link StrafeRangeError} `InvalidArgument` when the verifier breaks RFC 7636's grammar.
 */
export async function pkceChallenge(verifier: string): Promise<string> {
  if (!isValidPKCEString(verifier)) {
    throw new StrafeRangeError(ErrorCodes.InvalidArgument, 'A PKCE verifier is 43 to 128 characters of A-Z, a-z, 0-9, "-", ".", "_" and "~".');
  }
  const digest = await webCrypto().subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/**
 * Creates a random `state` value for an authorization URL (base64url, 128 bits by default). Store it
 * with the login attempt and compare it when the person comes back, so a forged redirect is
 * refused ({@link OAuth2Client.parseCallback} does the comparison).
 *
 * @param bytes - Random bytes to use (default 16).
 */
export function createState(bytes = 16): string {
  if (!Number.isInteger(bytes) || bytes < 8 || bytes > 256) {
    throw new StrafeRangeError(ErrorCodes.InvalidArgument, `createState() takes 8 to 256 bytes (got ${String(bytes)}).`);
  }
  return base64url(randomBytes(bytes));
}

/** The part of WebCrypto PKCE needs (typed here so the library does not depend on the DOM lib). */
interface WebCryptoLike {
  getRandomValues(array: Uint8Array): Uint8Array;
  subtle?: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
}

function webCrypto(): WebCryptoLike & { subtle: NonNullable<WebCryptoLike['subtle']> } {
  const crypto = (globalThis as { crypto?: WebCryptoLike }).crypto;
  const subtle = crypto?.subtle;
  if (crypto === undefined || subtle === undefined) throw new StrafeError(ErrorCodes.UnsupportedRuntime, 'crypto.subtle');
  return { getRandomValues: (array) => crypto.getRandomValues(array), subtle };
}

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  webCrypto().getRandomValues(bytes);
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

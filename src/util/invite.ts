import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeTypeError } from '../errors/StrafeError.js';

/** An invite code taken apart by {@link parseInviteCode}. */
export interface InviteCodeParts {
  /** The code itself. */
  code: string;
  /** The instance hosting the space, for a `code@domain` invite; `null` for a plain code. */
  domain: string | null;
  /** The host of the link the code came from, or `null` when the input was not a link. */
  linkHost: string | null;
}

const CODE = /^[A-Za-z0-9]{1,64}$/;
const DOMAIN = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/;

/**
 * Takes an invite apart: a code (`abc123`), a federated code (`abc123@chat.example.org`, for a
 * space hosted on another instance), or a link (`https://app.strafe.chat/invite/abc123`, also
 * without the scheme, with or without the `@domain`, the `@` possibly percent-encoded). Same code
 * grammar as the web client.
 *
 * A link's host is returned as {@link InviteCodeParts.linkHost} and not merged into the code:
 * whether it is this instance or another one depends on who asks ({@link Client.fetchInvite}
 * decides that).
 *
 * @param input - Code, `code@domain` or link.
 * @throws {@link StrafeTypeError} `InviteInvalid` when the input is none of those.
 * @example
 * ```ts
 * parseInviteCode('https://app.strafe.chat/invite/abc123');
 * // { code: 'abc123', domain: null, linkHost: 'app.strafe.chat' }
 * ```
 */
export function parseInviteCode(input: string): InviteCodeParts {
  if (typeof input !== 'string') throw new StrafeTypeError(ErrorCodes.InviteInvalid, String(input));
  const raw = input.trim();
  let candidate = raw;
  let linkHost: string | null = null;
  const link = /^(?:(?:([a-z][a-z0-9+.-]*):\/\/)?([^/?#\s]+))?(?:\/[^?#\s]*)?\/invite\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(raw);
  if (link !== null) {
    if (link[2] !== undefined) {
      try {
        linkHost = new URL(`${link[1] ?? 'https'}://${link[2]}`).host.toLowerCase();
      } catch {
        throw new StrafeTypeError(ErrorCodes.InviteInvalid, raw);
      }
    }
    try {
      candidate = decodeURIComponent(link[3] ?? '');
    } catch {
      throw new StrafeTypeError(ErrorCodes.InviteInvalid, raw);
    }
  }
  const at = candidate.lastIndexOf('@');
  const code = at >= 0 ? candidate.slice(0, at) : candidate;
  const domain = at >= 0 ? candidate.slice(at + 1).toLowerCase() : null;
  if (!CODE.test(code) || (domain !== null && !DOMAIN.test(domain))) throw new StrafeTypeError(ErrorCodes.InviteInvalid, raw);
  return { code, domain, linkHost };
}

/**
 * Writes an invite code the way the API and people expect it: `code`, or `code@domain` for a space
 * on another instance.
 *
 * @param parts - The code and its instance.
 */
export function formatInviteCode(parts: Pick<InviteCodeParts, 'code' | 'domain'>): string {
  return parts.domain === null || parts.domain === '' ? parts.code : `${parts.code}@${parts.domain}`;
}

/**
 * The link to an invite: `<web origin>/invite/<code>` (the `@` of a federated code is encoded).
 *
 * @param code - Code or `code@domain`.
 * @param web - The web client's origin of the instance the link is for.
 */
export function inviteURL(code: string, web: string): string {
  return `${web.replace(/\/+$/, '')}/invite/${encodeURIComponent(code)}`;
}

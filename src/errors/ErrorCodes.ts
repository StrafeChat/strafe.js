/**
 * Codes of errors the library raises itself (as opposed to errors the server returns, which are
 * {@link StrafeAPIError}s). Compare `error.code` against these.
 *
 * @example
 * ```ts
 * try { await room.send('hi'); }
 * catch (error) { if (error instanceof StrafeError && error.code === ErrorCodes.RoomEncrypted) { ... } }
 * ```
 */
export enum ErrorCodes {
  /** No token was given to `login()`/`setToken()` and `STRAFE_TOKEN` is not set. */
  TokenMissing = 'TokenMissing',
  /** The server refused the token (REST 401 or a gateway handshake 401). */
  TokenInvalid = 'TokenInvalid',
  /** The gateway sent `SESSION_REVOKED` (bot token reset, instance ban). The client will not reconnect. */
  SessionRevoked = 'SessionRevoked',
  /** Something that needs a logged-in, ready client was called too early. */
  ClientNotReady = 'ClientNotReady',
  /** No instance was given and `STRAFE_INSTANCE` is not set. */
  InstanceMissing = 'InstanceMissing',
  /** The instance URL could not be parsed. */
  InvalidInstanceURL = 'InvalidInstanceURL',
  /** Discovery could not find a Strafe API at the instance. */
  InstanceUnreachable = 'InstanceUnreachable',
  /** The runtime lacks `fetch`, `WebSocket`, `FormData` or `Blob`, and none was injected. */
  UnsupportedRuntime = 'UnsupportedRuntime',

  /** The room is end-to-end encrypted; a bot can neither read nor post there. Refused before any request. */
  RoomEncrypted = 'RoomEncrypted',
  /** 1:1 PMs are always end-to-end encrypted, so a bot cannot send one. */
  PMsEncrypted = 'PMsEncrypted',
  /** The room cannot hold messages (a section, or a voice room without text). */
  RoomNotTextBased = 'RoomNotTextBased',
  /** An embed breaks Strafe's limits; `path` says where (`embeds[0].fields[3].value`). Refused before any request. */
  EmbedInvalid = 'EmbedInvalid',
  /** More than 10 embeds, 10 attachments or 4000 characters in one message. */
  MessageTooLarge = 'MessageTooLarge',
  /** A message needs content, embeds or files. */
  MessageEmpty = 'MessageEmpty',
  /** `bulkDelete()` was asked for more than 100 messages. */
  BulkDeleteLimit = 'BulkDeleteLimit',
  /** An option discord.js has but Strafe cannot honour (e.g. `allowedMentions`). */
  Unsupported = 'Unsupported',

  /** A value could not be turned into a bitfield (unknown flag name, negative number). */
  BitFieldInvalid = 'BitFieldInvalid',
  /** A color could not be resolved (unknown name, out of 0..0xFFFFFF). */
  ColorInvalid = 'ColorInvalid',
  /** An emoji could not be resolved to a unicode emoji or a custom emoji id. */
  EmojiInvalid = 'EmojiInvalid',
  /**
   * An id that would go into a request path is not a Strafe id (a decimal snowflake, or `@me`).
   * Refused before any request, so input like `../rooms/1` can never reach another endpoint.
   */
  IdInvalid = 'IdInvalid',
  /** A path given to `rest.get/post/...` has a `.` or `..` segment or a backslash. Refused before any request. */
  RouteInvalid = 'RouteInvalid',
  /** An argument has the wrong type. */
  InvalidType = 'InvalidType',
  /** A value is out of range or otherwise invalid. */
  InvalidArgument = 'InvalidArgument',
  /** A file could not be read or is not a supported source. */
  FileInvalid = 'FileInvalid',
  /** An object is not cached and cannot be fetched (there is no endpoint for it). */
  NotFound = 'NotFound',

  /** `connect()` was called while a gateway connection is open. */
  WSConnectionExists = 'WSConnectionExists',
  /** A gateway frame was sent while the socket is not open. */
  WSNotOpen = 'WSNotOpen',
  /** The gateway refused the handshake (the HTTP status and message are in the error). */
  GatewayHandshakeRejected = 'GatewayHandshakeRejected',
  /** `destroy()` was called while `login()` was still connecting. */
  ClientDestroyed = 'ClientDestroyed',
  /** `login()` could not open a gateway connection after `ws.loginAttempts` tries. */
  GatewayUnreachable = 'GatewayUnreachable',

  /** The request was aborted through its `signal`, or timed out. */
  RequestAborted = 'RequestAborted',

  /** An OAuth2 call needs the application's client secret, and the {@link OAuth2Client} has none. */
  OAuth2ClientSecretMissing = 'OAuth2ClientSecretMissing',
  /** An authorization needs a `redirectUri` (every scope but a lone `bot` issues a code). */
  OAuth2RedirectURIMissing = 'OAuth2RedirectURIMissing',
  /** An authorization asked for no scopes, more than 10, or a malformed one. */
  OAuth2ScopesInvalid = 'OAuth2ScopesInvalid',
  /** The person declined on the consent page (`?error=access_denied` on the redirect). */
  OAuth2AccessDenied = 'OAuth2AccessDenied',
  /** The redirect's `state` is not the one the login started with (a forged or stale redirect). */
  OAuth2StateMismatch = 'OAuth2StateMismatch',
  /** The redirect carries neither a `code` nor an `error`. */
  OAuth2CodeMissing = 'OAuth2CodeMissing',
  /** An invite code or link could not be read. */
  InviteInvalid = 'InviteInvalid',
}

/** A message, or a function that builds one from an error's arguments. */
export type MessageFormatter = string | ((...args: never[]) => string);

/** Human-readable messages for each {@link ErrorCodes} value. */
export const ErrorMessages: Record<ErrorCodes, MessageFormatter> = {
  [ErrorCodes.TokenMissing]:
    'No token given. Pass it to client.login(token) / rest.setToken(token), or set the STRAFE_TOKEN environment variable.',
  [ErrorCodes.TokenInvalid]: 'The instance refused this token. Check that it is the bot token from the developer portal.',
  [ErrorCodes.SessionRevoked]: (reason: string) => `The session was revoked by the instance (${reason}). Log in again with a new token.`,
  [ErrorCodes.ClientNotReady]: (action: string) => `The client needs to be logged in and ready to ${action}.`,
  [ErrorCodes.InstanceMissing]:
    "No Strafe instance given. Pass one (new Client({ instance: 'app.strafe.chat' })) or set the STRAFE_INSTANCE environment variable. There is no default: every instance is independent.",
  [ErrorCodes.InvalidInstanceURL]: (input: string) => `"${input}" is not a valid instance (expected a domain like app.strafe.chat or a URL).`,
  [ErrorCodes.InstanceUnreachable]: (input: string, detail?: string) =>
    `Could not find a Strafe API at ${input}${detail ? ` (${detail})` : ''}. Pass rest.api / ws.gateway explicitly for an unusual layout.`,
  [ErrorCodes.UnsupportedRuntime]: (missing: string) =>
    `This runtime has no global ${missing}. Use Node.js >= 22.12, Bun or Deno 2.5+, or inject one through the options.`,
  [ErrorCodes.RoomEncrypted]:
    'This room is end-to-end encrypted. Bots have no encryption keys, so they cannot read or post here; the server would refuse it too.',
  [ErrorCodes.PMsEncrypted]:
    'Private messages between two people are always end-to-end encrypted on Strafe, so a bot cannot send one. Reply in a space room instead.',
  [ErrorCodes.RoomNotTextBased]: 'This room cannot hold messages.',
  [ErrorCodes.EmbedInvalid]: (path: string, reason: string) => `${path}: ${reason}`,
  [ErrorCodes.MessageTooLarge]: (detail: string) => `The message is too large: ${detail}.`,
  [ErrorCodes.MessageEmpty]: 'A message needs content, embeds or files.',
  [ErrorCodes.BulkDeleteLimit]: 'bulkDelete() deletes at most 100 messages per call (one request each: Strafe has no bulk endpoint).',
  [ErrorCodes.Unsupported]: (what: string, why: string) => `${what} is not supported by Strafe: ${why}`,
  [ErrorCodes.BitFieldInvalid]: (bit: unknown) => `Invalid bitfield flag or number: ${formatValue(bit)}.`,
  [ErrorCodes.ColorInvalid]: (color: unknown) => `Invalid color: ${formatValue(color)} (use a name from Colors, '#rrggbb', [r, g, b] or 0..0xFFFFFF).`,
  [ErrorCodes.EmojiInvalid]: (emoji: unknown) => `Invalid emoji: ${formatValue(emoji)} (use a unicode emoji, <:name:id>, an id or an Emoji).`,
  [ErrorCodes.IdInvalid]: (id: unknown) =>
    `Invalid id: ${formatValue(id)}. Strafe ids are decimal snowflakes (like "2102226824774811648"), or "@me" for yourself.`,
  [ErrorCodes.RouteInvalid]: (route: string) =>
    `Invalid route "${route}": a path segment is "." or ".." or holds a backslash. Build paths with Routes, which checks ids.`,
  [ErrorCodes.InvalidType]: (name: string, expected: string) => `${name} must be ${expected}.`,
  [ErrorCodes.InvalidArgument]: (detail: string) => detail,
  [ErrorCodes.FileInvalid]: (detail: string) => `Could not read the file: ${detail}.`,
  [ErrorCodes.NotFound]: (what: string) => `${what} is not cached and cannot be fetched.`,
  [ErrorCodes.WSConnectionExists]: 'A gateway connection is already open.',
  [ErrorCodes.WSNotOpen]: 'The gateway connection is not open.',
  [ErrorCodes.GatewayHandshakeRejected]: (status: number, message: string) => `The gateway refused the connection (${status}): ${message}`,
  [ErrorCodes.ClientDestroyed]: 'The client was destroyed before it became ready.',
  [ErrorCodes.GatewayUnreachable]: (url: string, attempts: number) =>
    `Could not connect to the gateway at ${url} (${attempts} attempts failed). Check that the instance's gateway is up, or pass ws.gateway explicitly.`,
  [ErrorCodes.RequestAborted]: (method: string, url: string) => `${method} ${url} was aborted or timed out.`,
  [ErrorCodes.OAuth2ClientSecretMissing]: (action: string) =>
    `${action} needs the application's client secret (Strafe's token endpoint requires it, even with PKCE). Pass clientSecret to the OAuth2Client on your server; never ship it to a browser.`,
  [ErrorCodes.OAuth2RedirectURIMissing]:
    'A redirectUri is required unless the only scope is bot. It must exactly match one of the redirect URIs registered on the application.',
  [ErrorCodes.OAuth2ScopesInvalid]: (scopes: string) =>
    `Invalid OAuth2 scopes "${scopes}": ask for 1 to 10 scopes, such as OAuth2Scopes.Identify, Email, Spaces, SpacesJoin or Bot.`,
  [ErrorCodes.OAuth2AccessDenied]: 'The person declined the authorization.',
  [ErrorCodes.OAuth2StateMismatch]: 'The OAuth2 state does not match the one this login started with; the redirect was forged or is stale.',
  [ErrorCodes.OAuth2CodeMissing]: 'The OAuth2 redirect has no code.',
  [ErrorCodes.InviteInvalid]: (input: string) => `"${input}" is not an invite code (code, code@domain) or invite link.`,
};

function formatValue(value: unknown): string {
  if (typeof value === 'bigint') return `${value}n`;
  try {
    const json = JSON.stringify(value) as string | undefined;
    return json ?? String(value);
  } catch {
    return String(value);
  }
}

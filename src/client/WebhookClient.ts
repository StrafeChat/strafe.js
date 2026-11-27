import { ErrorCodes } from '../errors/ErrorCodes.js';
import { StrafeTypeError } from '../errors/StrafeError.js';
import { REST } from '../rest/REST.js';
import type { RESTOptions } from '../rest/types.js';
import type { APIMessage } from '../types/api/message.js';
import type { APIWebhook, RESTPatchAPIWebhookJSONBody } from '../types/api/webhook.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import { resolveInstanceURLs } from '../util/instance.js';
import type { Snowflake } from '../util/Snowflake.js';
import type {
  WebhookCredentials,
  WebhookFetchMessageOptions,
  WebhookMessageCreateOptions,
  WebhookMessageEditOptions,
} from '../structures/WebhookPayload.js';
import {
  deleteWebhookMessage,
  editWebhookMessage,
  executeWebhook,
  fetchWebhookMessage,
  resolveImageDataURI,
  webhookRoute,
} from '../structures/WebhookPayload.js';

/** A webhook's id and token, or its URL, for {@link WebhookClient}. */
export type WebhookClientData = { id: Snowflake; token: string } | { url: string };

/** Options of a {@link WebhookClient}. */
export interface WebhookClientOptions {
  /**
   * The instance (a domain or URL), for `{ id, token }` or a URL that is only a path
   * (`/webhooks/<id>/<token>`, what an instance without a public address hands out). Defaults to
   * `STRAFE_INSTANCE`. A full URL carries its own instance.
   */
  instance?: string | undefined;
  /** REST options (retries, timeouts, `api`, fetch injection). */
  rest?: Partial<RESTOptions> | undefined;
  /**
   * Put the token in the path (`POST /webhooks/<id>/<token>`, Discord's form) instead of the
   * `Authorization: Webhook <token>` header. Default `false`: the header keeps the token out of
   * URLs, proxies' access logs and the URLs in this library's errors.
   */
  tokenInURL?: boolean | undefined;
}

/** What `webhookClient.edit()` takes (with the token only the name and avatar can change). */
export interface WebhookClientEditOptions {
  /** New name. */
  name?: string | undefined;
  /** New avatar (a file, URL or `data:` URI), or `null` to remove it. */
  avatar?: BufferResolvable | null | undefined;
}

const WEBHOOK_URL = /^(.*)\/webhooks\/(\d{1,20})\/([A-Za-z0-9_.-]+)\/?$/;

/**
 * Parses a webhook URL (`https://<instance>/api/webhooks/<id>/<token>`, or a bare
 * `/webhooks/<id>/<token>` path) into its API base, id and token.
 *
 * @param url - The URL, as create and token resets return it.
 * @throws {@link StrafeTypeError} `WebhookURLInvalid`.
 * @example
 * ```ts
 * parseWebhookURL('https://chat.example/api/webhooks/1310000000000000001/swh_abc');
 * // { api: 'https://chat.example/api', id: '1310000000000000001', token: 'swh_abc' }
 * ```
 */
export function parseWebhookURL(url: string): { api: string | null; id: Snowflake; token: string } {
  const trimmed = typeof url === 'string' ? (url.trim().split(/[?#]/)[0] ?? '') : '';
  // The error names the URL without its last segment: it may be the token.
  const shown = trimmed.replace(/\/[^/]+$/, '/[token]');
  const match = WEBHOOK_URL.exec(trimmed);
  if (!match) throw new StrafeTypeError(ErrorCodes.WebhookURLInvalid, shown);
  const [, base = '', id = '', token = ''] = match;
  if (base === '') return { api: null, id, token };
  if (!/^https?:\/\/[^/]+/i.test(base)) throw new StrafeTypeError(ErrorCodes.WebhookURLInvalid, shown);
  return { api: base, id, token };
}

/**
 * Posts through a webhook with nothing but its token: no bot, no login, no gateway. Everything a
 * token allows: send (with `username`, `avatarURL`, embeds, files, `allowedMentions`, `threadId`,
 * `wait`), and fetch, edit and delete the webhook's own messages and the webhook itself.
 *
 * Answers are wire objects ({@link APIMessage}, {@link APIWebhook}): there is no cache to put a
 * structure in.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `WebhookClient`, taking `{ id, token }` or `{ url }`.
 *
 * @example
 * ```ts
 * const hook = new WebhookClient({ url: process.env.STRAFE_WEBHOOK_URL! });
 * const message = await hook.send({ content: 'Build #42 passed', username: 'CI', allowedMentions: { parse: [] } });
 * await hook.editMessage(message.id, { content: 'Build #42 passed (retried)' });
 * ```
 */
export class WebhookClient {
  /** The webhook's id. */
  public readonly id: Snowflake;
  /** The REST client the requests go through (its own queues and rate limits). */
  declare public readonly rest: REST;
  /** Whether the token goes in the path rather than the header. */
  public readonly tokenInURL: boolean;
  #token: string;

  /**
   * @param data - `{ id, token }`, or `{ url }` as create and token resets return it.
   * @param options - Instance, REST options, where the token goes.
   * @throws {@link StrafeTypeError} `WebhookURLInvalid` for a URL that is not a webhook's;
   *   {@link StrafeError} `InstanceMissing` for `{ id, token }` (or a path-only URL) without an instance.
   */
  public constructor(data: WebhookClientData, options: WebhookClientOptions = {}) {
    let api: string | null = options.rest?.api ?? null;
    let id: Snowflake;
    let token: string;
    if ('url' in data) {
      const parsed = parseWebhookURL(data.url);
      id = parsed.id;
      token = parsed.token;
      api ??= parsed.api;
    } else {
      id = data.id;
      token = data.token.replace(/^Webhook\s+/i, '').trim();
    }
    if (!/^\d{1,20}$/.test(id)) throw new StrafeTypeError(ErrorCodes.IdInvalid, id);
    api ??= resolveInstanceURLs(options.instance).api;
    this.id = id;
    this.#token = token;
    this.tokenInURL = options.tokenInURL ?? false;
    Object.defineProperty(this, 'rest', { value: new REST({ ...options.rest, api }), enumerable: false, writable: false });
  }

  /** The token. Treat it like a password. */
  public get token(): string {
    return this.#token;
  }

  /** The execute URL with the token in it (Discord's form). Treat it like a password. */
  public get url(): string {
    return `${this.rest.api}/webhooks/${this.id}/${this.#token}`;
  }

  private get credentials(): WebhookCredentials {
    return { id: this.id, token: this.#token, tokenInURL: this.tokenInURL };
  }

  /**
   * Posts a message.
   *
   * @param options - Text or {@link WebhookMessageCreateOptions}.
   * @returns The message (`wait` defaults to `true`), or `undefined` with `wait: false`.
   * @example
   * ```ts
   * await hook.send({ content: 'Deploy finished', embeds: [new EmbedBuilder().setTitle('v1.2.0')], files: [new URL('./notes.txt', import.meta.url)] });
   * ```
   */
  public send(options: WebhookMessageCreateOptions & { wait: false }): Promise<undefined>;
  public send(options: string | WebhookMessageCreateOptions): Promise<APIMessage>;
  public send(options: string | WebhookMessageCreateOptions): Promise<APIMessage | undefined> {
    return executeWebhook(this.rest, this.credentials, options);
  }

  /**
   * Fetches a message this webhook posted.
   *
   * @param messageId - The message.
   * @param options - The thread it is in.
   */
  public fetchMessage(messageId: Snowflake, options: WebhookFetchMessageOptions = {}): Promise<APIMessage> {
    return fetchWebhookMessage(this.rest, this.credentials, messageId, options);
  }

  /**
   * Edits a message this webhook posted.
   *
   * @param messageId - The message.
   * @param options - Text or {@link WebhookMessageEditOptions}.
   */
  public editMessage(messageId: Snowflake, options: string | WebhookMessageEditOptions): Promise<APIMessage> {
    return editWebhookMessage(this.rest, this.credentials, messageId, options);
  }

  /**
   * Deletes a message this webhook posted.
   *
   * @param messageId - The message.
   * @param options - The thread it is in.
   */
  public deleteMessage(messageId: Snowflake, options: WebhookFetchMessageOptions = {}): Promise<void> {
    return deleteWebhookMessage(this.rest, this.credentials, messageId, options);
  }

  /** Fetches the webhook (without its creator: token reads leave it out). */
  public fetch(): Promise<APIWebhook> {
    const { route, auth } = webhookRoute(this.credentials);
    return this.rest.get<APIWebhook>(route, auth === undefined ? {} : { auth });
  }

  /**
   * Renames the webhook or changes its avatar.
   *
   * @param options - Name and avatar.
   */
  public async edit(options: WebhookClientEditOptions): Promise<APIWebhook> {
    const body: RESTPatchAPIWebhookJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.avatar === null) body.avatar = null;
    else if (options.avatar !== undefined) body.avatar = await resolveImageDataURI(options.avatar, this.rest.options.makeRequest);
    const { route, auth } = webhookRoute(this.credentials);
    return this.rest.patch<APIWebhook>(route, { body, ...(auth === undefined ? {} : { auth }) });
  }

  /**
   * Deletes the webhook. Anyone holding the token may: that is how a leaked URL is killed.
   */
  public async delete(): Promise<void> {
    const { route, auth } = webhookRoute(this.credentials);
    await this.rest.delete(route, auth === undefined ? {} : { auth });
  }

  /** Does nothing (there is no connection to close); kept for discord.js compatibility. */
  public destroy(): void {
    // Nothing to close.
  }

  /** `{ id }`: never the token. */
  public toJSON(): { id: Snowflake } {
    return { id: this.id };
  }
}

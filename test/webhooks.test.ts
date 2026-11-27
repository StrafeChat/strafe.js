import { describe, expect, it } from 'vitest';
import { WebhookClient, parseWebhookURL } from '../src/client/WebhookClient.js';
import { StrafeAPIError, WebhookAPIError } from '../src/errors/APIErrors.js';
import { ErrorCodes } from '../src/errors/ErrorCodes.js';
import { Routes, majorParameter, routeTemplate } from '../src/rest/Routes.js';
import type { RateLimitData } from '../src/rest/types.js';
import { OverwriteType } from '../src/structures/PermissionOverwrites.js';
import type { TextRoom } from '../src/structures/rooms/TextRoom.js';
import { Webhook } from '../src/structures/Webhook.js';
import type { APIWebhook } from '../src/types/api/webhook.js';
import { WebhookMessageFlags, WebhookType } from '../src/types/api/webhook.js';
import { PermissionFlagsBits as P, PermissionsBitField, computeRoomPermissions } from '../src/util/PermissionsBitField.js';
import { BOT_ID, EVERYONE_ID, OWNER_ID, SPACE_ID, TEXT_ID, VOICE_ID, fakeAPI, message, role, setup } from './helpers.js';

const HOOK_ID = '1310000000000000001';
const TOKEN = 'swh_abcDEF123-_x';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function apiWebhook(extra: { [K in keyof APIWebhook]?: APIWebhook[K] | undefined } = {}): APIWebhook {
  const hook: Record<string, unknown> = {
    id: HOOK_ID,
    type: WebhookType.Incoming,
    space_id: SPACE_ID,
    room_id: TEXT_ID,
    name: 'CI',
    avatar: null,
    application_id: null,
    creator: { id: OWNER_ID, username: 'owner', display_name: 'The Owner', avatar: '', bot: false },
    mass_mentions: false,
    disabled_reason: null,
    created_at: '2026-11-17T12:00:00Z',
    last_used_at: null,
    ...extra,
  };
  if (hook.creator === undefined) delete hook.creator;
  return hook as unknown as APIWebhook;
}

/** A webhook message as the server writes it: the webhook's author shape, webhook_id and masquerade. */
function webhookMessage(id: string, extra: Record<string, unknown> = {}) {
  return message(id, {
    sender_id: HOOK_ID,
    plaintext: 'Build #42 passed',
    author: { id: HOOK_ID, username: 'CI', display_name: 'CI', avatar: '', banner: '', bio: '', about_me: '', pronouns: '', bot: true, public_flags: 0, webhook: true },
    webhook_id: HOOK_ID,
    masquerade: { kind: 'webhook', name: 'CI', avatar: '/media/v1/external/sig/abc', via: { webhook: { id: HOOK_ID, name: 'CI' } } },
    ...extra,
  });
}

function headersOf(fetch: { mock: { calls: unknown[][] } }, index: number): Record<string, string> {
  return ((fetch.mock.calls[index]?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
}

function room(client: ReturnType<typeof setup>['client']): TextRoom {
  return client.rooms.cache.get(TEXT_ID) as TextRoom;
}

describe('permissions past bit 30', () => {
  it('has Manage Webhooks and Masquerade, and writes them as strings', async () => {
    expect(P.ManageWebhooks).toBe(1n << 31n);
    expect(P.Masquerade).toBe(1n << 32n);
    expect(new PermissionsBitField([P.ManageWebhooks, P.Masquerade]).toWire()).toBe('6442450944');
    expect(PermissionsBitField.toWire(['ManageWebhooks', 'SendMessages'])).toBe('2147483650');

    const { api, space } = setup();
    api.on('POST /spaces/:id/roles', (call: { body: { permissions: string } }) => role('3000000000000000010', 1, Number(call.body.permissions)));
    const created = await space.roles.create({ name: 'Bridges', permissions: [P.ManageWebhooks, P.Masquerade, P.SendMessages] });
    expect(api.last('POST').body).toMatchObject({ permissions: '6442450946' });
    // Read back from a JSON number above 2^31 (exact below 2^53).
    expect(created.permissions.has(P.Masquerade)).toBe(true);

    api.on('PUT /spaces/:id/rooms/:id/overrides/:id', undefined);
    const text = room(space.client);
    await text.permissionOverwrites.create(EVERYONE_ID, { Masquerade: true, ManageWebhooks: false }, { type: OverwriteType.Role });
    expect(api.last('PUT').body).toEqual({ allow: '4294967296', deny: '2147483648' });
  });

  it('reads permission strings and drops Masquerade without Send Messages', () => {
    expect(new PermissionsBitField('6442450944').has(P.ManageWebhooks)).toBe(true);
    const space = { ownerId: OWNER_ID, everyoneRoleId: EVERYONE_ID, rolePermissions: new Map([[EVERYONE_ID, P.ViewRoom | P.Masquerade]]) };
    const roomData = { type: 3, permissionsSynced: false, roleOverwrites: [], userOverwrites: [], parent: null };
    expect(computeRoomPermissions(space, roomData, { id: BOT_ID, roleIds: [] }) & P.Masquerade).toBe(0n);
    space.rolePermissions.set(EVERYONE_ID, P.ViewRoom | P.SendMessages | P.Masquerade);
    expect(computeRoomPermissions(space, roomData, { id: BOT_ID, roleIds: [] }) & P.Masquerade).toBe(P.Masquerade);
    expect(PermissionsBitField.AllRoom & (P.ManageWebhooks | P.Masquerade)).toBe(P.ManageWebhooks | P.Masquerade);
  });
});

describe('routes', () => {
  it('builds webhook routes and keeps tokens out of bucket keys', () => {
    expect(Routes.webhook(HOOK_ID)).toBe(`/webhooks/${HOOK_ID}`);
    expect(Routes.webhook(HOOK_ID, TOKEN)).toBe(`/webhooks/${HOOK_ID}/${TOKEN}`);
    expect(Routes.webhookMessage(HOOK_ID, '9', TOKEN)).toBe(`/webhooks/${HOOK_ID}/${TOKEN}/messages/9`);
    expect(() => Routes.webhook(HOOK_ID, '../rooms')).toThrow();
    expect(routeTemplate(`/webhooks/${HOOK_ID}/${TOKEN}/messages/9`)).toBe('/webhooks/:id/:token/messages/:id');
    expect(routeTemplate(`/webhooks/${HOOK_ID}/token`)).toBe('/webhooks/:id/token');
    expect(routeTemplate('/bridges/1/messages/external/abc/reactions/%F0%9F%91%8D/u1')).toBe('/bridges/:id/messages/external/:external/reactions/:emoji/:external');
    expect(majorParameter(`/webhooks/${HOOK_ID}`)).toBe(HOOK_ID);
    expect(majorParameter('/bridges/77/messages')).toBe('77');
  });
});

describe('Webhook (bot client)', () => {
  it('creates a webhook with an avatar and keeps its token out of JSON', async () => {
    const { api, client } = setup();
    api.on('POST /rooms/:id/webhooks', apiWebhook({ token: TOKEN, url: `https://chat.example/api/webhooks/${HOOK_ID}/${TOKEN}` }));
    const hook = await room(client).createWebhook({ name: 'CI', avatar: PNG, massMentions: false, reason: 'builds' });
    expect(api.last().path).toBe(`/rooms/${TEXT_ID}/webhooks`);
    const body = api.last().body as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'CI', mass_mentions: false, reason: 'builds' });
    expect(body.avatar).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
    expect(hook).toBeInstanceOf(Webhook);
    expect(hook.token).toBe(TOKEN);
    expect(hook.url).toBe(`https://chat.example/api/webhooks/${HOOK_ID}/${TOKEN}`);
    expect(hook.owner?.id).toBe(OWNER_ID);
    expect(hook.room?.id).toBe(TEXT_ID);
    expect(JSON.stringify(hook)).not.toContain(TOKEN);
    expect(Object.keys(hook)).not.toContain('_token');
  });

  it('lists, edits, moves, resets and deletes webhooks', async () => {
    const { api, client, space } = setup();
    api.on('GET /rooms/:id/webhooks', [apiWebhook()]);
    api.on('GET /spaces/:id/webhooks', [apiWebhook(), apiWebhook({ id: '1310000000000000002', room_id: VOICE_ID })]);
    const listed = await room(client).fetchWebhooks();
    expect([...listed.keys()]).toEqual([HOOK_ID]);
    expect(listed.get(HOOK_ID)?.token).toBeNull();
    expect((await space.fetchWebhooks()).size).toBe(2);

    const hook = listed.get(HOOK_ID)!;
    api.on('PATCH /webhooks/:id', (call: { body: { name: string; room_id: string } }) => apiWebhook({ name: call.body.name, room_id: call.body.room_id }));
    await hook.edit({ name: 'CI bot', room: VOICE_ID, avatar: null });
    expect(api.last().body).toEqual({ name: 'CI bot', room_id: VOICE_ID, avatar: null });
    expect(hook.roomId).toBe(VOICE_ID);

    api.on('POST /webhooks/:id/token', apiWebhook({ token: 'swh_new' }));
    await hook.resetToken('leaked');
    expect(api.last().body).toEqual({ reason: 'leaked' });
    expect(hook.token).toBe('swh_new');

    api.on('DELETE /webhooks/:id', undefined);
    await hook.delete('done');
    expect(api.last()).toMatchObject({ method: 'DELETE', path: `/webhooks/${HOOK_ID}`, body: { reason: 'done' } });
  });

  it('executes with the Webhook header and caches the masqueraded message without a user', async () => {
    const { api, client } = setup();
    api.on('POST /rooms/:id/webhooks', apiWebhook({ token: TOKEN }));
    const hook = await room(client).createWebhook({ name: 'CI' });
    api.on('POST /webhooks/:id', webhookMessage('7000000000000000001'));
    const sent = await hook.send({
      content: 'Build #42 passed',
      username: 'CI',
      avatarURL: 'https://ci.example/logo.png',
      allowedMentions: { parse: [], repliedUser: false },
      flags: WebhookMessageFlags.SuppressNotifications,
      threadId: undefined,
    });
    const call = api.last();
    expect(call.path).toBe(`/webhooks/${HOOK_ID}`);
    expect(call.query.get('wait')).toBe('true');
    expect(call.body).toEqual({ content: 'Build #42 passed', username: 'CI', avatar_url: 'https://ci.example/logo.png', allowed_mentions: { parse: [], replied_user: false }, flags: 4096 });
    expect(headersOf(api.fetch, api.calls.length - 1).Authorization).toBe(`Webhook ${TOKEN}`);

    expect(sent.webhookId).toBe(HOOK_ID);
    expect(sent.isWebhook).toBe(true);
    expect(sent.isBridged).toBe(false);
    expect(sent.author.username).toBe('CI');
    expect(sent.author.bot).toBe(true);
    expect(client.users.cache.has(HOOK_ID)).toBe(false);
    expect(sent.member).toBeNull();
    expect(sent.editable).toBe(false);
    expect(sent.masquerade).toMatchObject({ kind: 'webhook', name: 'CI', avatarURL: 'https://chat.example/api/media/v1/external/sig/abc', webhook: { id: HOOK_ID, name: 'CI' }, bridge: null });
    expect(room(client).messages.cache.get(sent.id)).toBe(sent);
  });

  it('needs a token unless the bot made it', async () => {
    const { api, client } = setup();
    const foreign = new Webhook(client, apiWebhook());
    await expect(foreign.send('hi')).rejects.toMatchObject({ code: ErrorCodes.WebhookTokenMissing });

    const owned = new Webhook(client, apiWebhook({ application_id: BOT_ID }));
    expect(owned.ownedByClient).toBe(true);
    api.on('POST /webhooks/:id', webhookMessage('7000000000000000002'));
    await owned.send('from the bot that made it');
    expect(headersOf(api.fetch, api.calls.length - 1).Authorization).toBe('Bot test-token');

    api.on('PATCH /webhooks/:id/messages/:id', webhookMessage('7000000000000000002', { plaintext: 'edited' }));
    const edited = await owned.editMessage('7000000000000000002', { content: 'edited', attachments: [] });
    expect(api.last().body).toEqual({ content: 'edited', attachments: [] });
    expect(edited.content).toBe('edited');
  });

  it('fetches a webhook by id and token', async () => {
    const { api, client } = setup();
    api.on('GET /webhooks/:id', apiWebhook({ creator: undefined }));
    const hook = await client.fetchWebhook(HOOK_ID, TOKEN);
    expect(headersOf(api.fetch, 0).Authorization).toBe(`Webhook ${TOKEN}`);
    expect(hook.token).toBe(TOKEN);
  });
});

describe('WebhookClient', () => {
  it('parses webhook URLs', () => {
    expect(parseWebhookURL(`https://chat.example/api/webhooks/${HOOK_ID}/${TOKEN}`)).toEqual({ api: 'https://chat.example/api', id: HOOK_ID, token: TOKEN });
    expect(parseWebhookURL(`/webhooks/${HOOK_ID}/${TOKEN}`)).toEqual({ api: null, id: HOOK_ID, token: TOKEN });
    expect(() => parseWebhookURL('https://chat.example/api/rooms/1')).toThrow(expect.objectContaining({ code: ErrorCodes.WebhookURLInvalid }));
    try {
      parseWebhookURL(`https://chat.example/api/nothooks/${HOOK_ID}/${TOKEN}`);
    } catch (error) {
      expect(String(error)).not.toContain(TOKEN);
    }
  });

  it('sends from a URL with no bot token, files and embeds as multipart', async () => {
    const api = fakeAPI();
    api.on('POST /webhooks/:id', webhookMessage('7000000000000000003'));
    const hook = new WebhookClient({ url: `https://chat.example/api/webhooks/${HOOK_ID}/${TOKEN}` }, { rest: { makeRequest: api.fetch, retries: 0 } });
    expect(hook.id).toBe(HOOK_ID);
    expect(hook.url).toBe(`https://chat.example/api/webhooks/${HOOK_ID}/${TOKEN}`);
    expect(JSON.stringify(hook)).toBe(`{"id":"${HOOK_ID}"}`);
    const sent = await hook.send({
      content: 'Coverage',
      embeds: [{ title: 'Coverage', image: { url: 'attachment://coverage.png' } }],
      files: [{ attachment: PNG, name: 'coverage.png' }],
      threadId: '4000000000000000006',
    });
    expect(sent.id).toBe('7000000000000000003');
    const call = api.last();
    expect(call.query.get('thread_id')).toBe('4000000000000000006');
    expect(call.form).not.toBeNull();
    expect(JSON.parse(call.form!.get('payload_json') as string)).toEqual({ content: 'Coverage', embeds: [{ title: 'Coverage', image: { url: 'attachment://coverage.png' } }] });
    expect((call.form!.get('files[0]') as File).name).toBe('coverage.png');
    expect(headersOf(api.fetch, 0).Authorization).toBe(`Webhook ${TOKEN}`);
  });

  it('puts the token in the path when asked, and returns nothing with wait: false', async () => {
    const api = fakeAPI();
    api.on('POST /webhooks/:id/:token', undefined);
    const hook = new WebhookClient({ id: HOOK_ID, token: TOKEN }, { instance: 'https://chat.example', tokenInURL: true, rest: { makeRequest: api.fetch, retries: 0 } });
    await expect(hook.send({ content: 'fire and forget', wait: false })).resolves.toBeUndefined();
    expect(api.last().path).toBe(`/webhooks/${HOOK_ID}/${TOKEN}`);
    expect(api.last().query.get('wait')).toBe('false');
    expect(headersOf(api.fetch, 0).Authorization).toBeUndefined();
  });

  it('fetches, edits and deletes its messages and itself with the token', async () => {
    const api = fakeAPI();
    api.on('GET /webhooks/:id/messages/:id', webhookMessage('7000000000000000004'));
    api.on('PATCH /webhooks/:id/messages/:id', webhookMessage('7000000000000000004', { plaintext: 'retried' }));
    api.on('DELETE /webhooks/:id/messages/:id', undefined);
    api.on('GET /webhooks/:id', apiWebhook({ creator: undefined }));
    api.on('PATCH /webhooks/:id', apiWebhook({ name: 'Renamed', creator: undefined }));
    api.on('DELETE /webhooks/:id', undefined);
    const hook = new WebhookClient({ id: HOOK_ID, token: TOKEN }, { instance: 'chat.example', rest: { makeRequest: api.fetch, retries: 0 } });

    expect((await hook.fetchMessage('7000000000000000004', { threadId: '4000000000000000006' })).id).toBe('7000000000000000004');
    expect(api.last().query.get('thread_id')).toBe('4000000000000000006');
    const edited = await hook.editMessage('7000000000000000004', { content: 'retried', allowedMentions: { users: [OWNER_ID] } });
    expect(edited.plaintext).toBe('retried');
    expect(api.last().body).toEqual({ content: 'retried', allowed_mentions: { users: [OWNER_ID] } });
    await hook.deleteMessage('7000000000000000004');
    expect(api.last()).toMatchObject({ method: 'DELETE', path: `/webhooks/${HOOK_ID}/messages/7000000000000000004` });

    expect((await hook.fetch()).name).toBe('CI');
    expect((await hook.edit({ name: 'Renamed' })).name).toBe('Renamed');
    await hook.delete();
    for (let i = 0; i < api.calls.length; i++) expect(headersOf(api.fetch, i).Authorization).toBe(`Webhook ${TOKEN}`);
  });

  it('checks allowed mentions and content before any request', async () => {
    const api = fakeAPI();
    const hook = new WebhookClient({ id: HOOK_ID, token: TOKEN }, { instance: 'chat.example', rest: { makeRequest: api.fetch } });
    await expect(hook.send({ content: 'x', allowedMentions: { parse: ['users'], users: [OWNER_ID] } })).rejects.toMatchObject({ code: ErrorCodes.InvalidArgument });
    await expect(hook.send({})).rejects.toMatchObject({ code: ErrorCodes.MessageEmpty });
    expect(api.calls).toHaveLength(0);
  });

  it('maps webhook errors to WebhookAPIError', async () => {
    const api = fakeAPI();
    const reply = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    api.on('POST /webhooks/:id', reply(401, { error: 'invalid webhook token', code: 'invalid_webhook_token' }));
    const hook = new WebhookClient({ id: HOOK_ID, token: TOKEN }, { instance: 'chat.example', rest: { makeRequest: api.fetch, retries: 0 } });
    const error = await hook.send('hi').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WebhookAPIError);
    expect(error).toBeInstanceOf(StrafeAPIError);
    expect(error).toMatchObject({ status: 401, code: 'invalid_webhook_token' });

    const { api: botAPI, client } = setup();
    botAPI.on('POST /rooms/:id/webhooks', reply(409, { error: 'full', code: 'webhook_limit', max: 15, scope: 'room' }));
    const limit = (await room(client).createWebhook({ name: 'x' }).catch((e: unknown) => e)) as WebhookAPIError;
    expect(limit).toBeInstanceOf(WebhookAPIError);
    expect(limit.max).toBe(15);
    expect(limit.scope).toBe('room');
    botAPI.on('POST /rooms/:id/webhooks', reply(400, { error: 'reserved', code: 'invalid_name', reason: 'reserved' }));
    const name = (await room(client).createWebhook({ name: 'Strafe' }).catch((e: unknown) => e)) as WebhookAPIError;
    expect(name.nameReason).toBe('reserved');
  });

  it("waits out a webhook's own 429 without blocking the route for other webhooks", async () => {
    let first = true;
    const api = fakeAPI();
    api.on('POST /webhooks/:id', () => {
      if (!first) return webhookMessage('7000000000000000005');
      first = false;
      return new Response(JSON.stringify({ error: 'you are being rate limited', code: 'rate_limited', retry_after: 0.01, scope: 'webhook' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '0', 'x-ratelimit-limit': '5', 'x-ratelimit-remaining': '0', 'x-ratelimit-scope': 'webhook' },
      });
    });
    const limits: RateLimitData[] = [];
    const hook = new WebhookClient({ id: HOOK_ID, token: TOKEN }, { rest: { api: 'https://chat.example/api', makeRequest: api.fetch, retries: 0, offset: 0 } });
    hook.rest.on('rateLimited', (data) => limits.push(data));
    await expect(hook.send('hi')).resolves.toMatchObject({ id: '7000000000000000005' });
    expect(limits).toHaveLength(1);
    expect(limits[0]).toMatchObject({ scope: 'shared', serverScope: 'webhook', majorParameter: HOOK_ID });
    // Another webhook on the same route is not held up.
    const other = new WebhookClient({ id: '1310000000000000009', token: TOKEN }, { rest: { api: 'https://chat.example/api', makeRequest: api.fetch, retries: 0 } });
    await expect(other.send('hi')).resolves.toBeDefined();
  });
});

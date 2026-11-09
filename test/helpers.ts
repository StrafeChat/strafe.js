import { vi } from 'vitest';
import { Client } from '../src/client/Client.js';
import type { ClientOptions } from '../src/client/Client.js';
import { RoomType } from '../src/types/api/room.js';
import type { APIMessage } from '../src/types/api/message.js';
import type { APIRole, APISpace } from '../src/types/api/space.js';
import { SpaceVerificationLevel } from '../src/types/api/space.js';
import type { APISpaceRoom } from '../src/types/api/room.js';
import type { APISelfUser } from '../src/types/api/user.js';

/** One recorded request. */
export interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  form: FormData | null;
}

type Handler = (call: Call) => unknown;

/**
 * A fake Strafe API: register `METHOD /path` handlers (exact path, `:id` wildcards allowed); a
 * handler returns a JSON body, `undefined` for 204, or a `Response`. Unmatched requests answer 404.
 */
export function fakeAPI() {
  const calls: Call[] = [];
  const handlers: { method: string; pattern: RegExp; handler: Handler }[] = [];
  const fetch = vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname.replace(/^\/api/, '');
    let body: unknown = undefined;
    let form: FormData | null = null;
    if (init.body instanceof FormData) form = init.body;
    else if (typeof init.body === 'string') body = JSON.parse(init.body);
    const call: Call = { method: init.method ?? 'GET', path, query: url.searchParams, body, form };
    calls.push(call);
    const match = handlers.find((h) => h.method === call.method && h.pattern.test(decodeURIComponent(path)));
    if (!match) return new Response(JSON.stringify({ error: `no handler for ${call.method} ${path}` }), { status: 404, headers: { 'content-type': 'application/json' } });
    const result = await match.handler(call);
    if (result instanceof Response) return result;
    if (result === undefined) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const api = {
    calls,
    fetch,
    on(route: string, handler: unknown) {
      const [method = 'GET', path = '/'] = route.split(' ');
      const pattern = new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+')}$`);
      handlers.unshift({ method, pattern, handler: typeof handler === 'function' ? (handler as Handler) : () => handler });
      return api;
    },
    last(method?: string): Call {
      const list = method ? calls.filter((c) => c.method === method) : calls;
      const call = list.at(-1);
      if (!call) throw new Error('no calls');
      return call;
    },
  };
  return api;
}

export const BOT_ID = '1000000000000000001';
export const OWNER_ID = '1000000000000000002';
export const SPACE_ID = '2000000000000000001';
export const EVERYONE_ID = '3000000000000000001';
export const MOD_ROLE_ID = '3000000000000000002';
export const BOT_ROLE_ID = '3000000000000000003';
export const SECTION_ID = '4000000000000000001';
export const TEXT_ID = '4000000000000000002';
export const VOICE_ID = '4000000000000000003';
export const SECRET_ID = '4000000000000000004';
export const ENCRYPTED_ID = '4000000000000000005';
export const THREAD_ID = '4000000000000000006';
export const PM_ID = '5000000000000000001';
export const GROUP_ID = '5000000000000000002';

const now = '2026-11-09T10:00:00Z';

export function role(id: string, position: number, permissions: number, extra: Partial<APIRole> = {}): APIRole {
  return { id, name: `role${position}`, permissions, position, color: 0, hoist: false, mentionable: false, created_at: now, updated_at: now, ...extra };
}

export function spaceRoom(id: string, type: APISpaceRoom['type'], extra: Partial<APISpaceRoom> = {}): APISpaceRoom {
  return {
    id,
    type,
    name: `room-${id.slice(-2)}`,
    topic: '',
    slowmode_seconds: 0,
    position: 0,
    e2ee_enabled: false,
    created_at: now,
    updated_at: now,
    space_id: SPACE_ID,
    parent_id: null,
    permissions_synced: false,
    permission_overrides: [],
    user_overrides: [],
    ...extra,
  };
}

export function apiSpace(extra: Partial<APISpace> = {}): APISpace {
  return {
    id: SPACE_ID,
    name: 'Lobby',
    name_acronym: 'L',
    description: '',
    icon: '',
    banner: '',
    owner_id: OWNER_ID,
    verification_level: SpaceVerificationLevel.None,
    official: false,
    default_message_notifications: 0,
    explicit_content_filter: 0,
    features: null,
    afk_timeout: 300,
    system_room_flags: 0,
    max_presences: 0,
    max_members: 0,
    vanity_url_code: '',
    preferred_locale: 'en',
    max_video_room_users: 25,
    widget_enabled: false,
    automod_flags: 0,
    automod_mention_limit: 0,
    created_at: now,
    updated_at: now,
    everyone_role_id: EVERYONE_ID,
    system_room_id: TEXT_ID,
    roles: [
      role(EVERYONE_ID, 0, 1436786719, { name: '@everyone' }),
      role(MOD_ROLE_ID, 2, 64 | 512 | 1024 | 128 | 536870912, { name: 'Mods', color: 0xff0000, hoist: true }),
      role(BOT_ROLE_ID, 1, 64, { name: 'Bot', bot_id: BOT_ID }),
    ],
    rooms: [
      spaceRoom(SECTION_ID, RoomType.SpaceSection, { name: 'General', position: 0, permission_overrides: [{ role_id: EVERYONE_ID, allow: 0, deny: 2, created_at: now, updated_at: now }] }),
      spaceRoom(TEXT_ID, RoomType.SpaceText, { name: 'chat', topic: 'hello', parent_id: SECTION_ID, permissions_synced: true, position: 0 }),
      spaceRoom(VOICE_ID, RoomType.SpaceVoice, { name: 'Lounge', parent_id: SECTION_ID, position: 1, user_limit: 5, bitrate: 64000 }),
      spaceRoom(SECRET_ID, RoomType.SpaceText, {
        name: 'mods',
        position: 2,
        permission_overrides: [
          { role_id: EVERYONE_ID, allow: 0, deny: 1, created_at: now, updated_at: now },
          { role_id: MOD_ROLE_ID, allow: 1, deny: 0, created_at: now, updated_at: now },
        ],
      }),
      spaceRoom(ENCRYPTED_ID, RoomType.SpaceText, { name: 'secret', e2ee_enabled: true, position: 3 }),
      spaceRoom(THREAD_ID, RoomType.Thread, {
        name: 'a thread',
        parent_id: SECRET_ID,
        thread: { archived: false, locked: false, private: false, invitable: true, auto_archive_minutes: 1440, owner_id: OWNER_ID, archived_at: null },
      }),
    ],
    ...extra,
  };
}

export const selfUser: APISelfUser = {
  id: BOT_ID,
  username: 'helper',
  display_name: 'Helper',
  avatar: '',
  banner: '',
  bio: '',
  about_me: '',
  pronouns: '',
  bot: true,
  public_flags: 0,
  email: `bot+${BOT_ID}@bots.invalid`,
  verified_email: false,
  accent_color: '',
  birthday_opt_in: false,
  birthday: '',
  created_at: '2026-09-21T00:00:00Z',
};

export function message(id: string, extra: Partial<APIMessage> = {}): APIMessage {
  return {
    id,
    room_id: TEXT_ID,
    sender_id: OWNER_ID,
    sender_device_id: '0',
    ciphertext: '',
    plaintext: 'hello',
    embeds: [],
    created_at: now,
    updated_at: now,
    author: { id: OWNER_ID, username: 'owner', display_name: 'The Owner', avatar: '', banner: '', bio: '', about_me: '', pronouns: '', bot: false, public_flags: 2 },
    ...extra,
  };
}

/** A ready-ish client on a fake API with one space, its rooms and the bot's member cached. */
export function setup(options: ClientOptions = {}) {
  const api = fakeAPI();
  const client = new Client({ instance: 'https://chat.example', ...options, rest: { makeRequest: api.fetch, retries: 0, ...options.rest } });
  client._setToken('Bot test-token');
  client._setClientUser(selfUser);
  client.readyTimestamp = Date.now();
  const space = client.spaces._add(apiSpace());
  space.members._add({ id: BOT_ID, username: 'helper', roles: [BOT_ROLE_ID], joined_at: now, nick: null, bot: true });
  space.members._add({ id: OWNER_ID, username: 'owner', roles: [], joined_at: now, nick: null });
  client.rooms._add({ id: PM_ID, type: RoomType.PM, recipients: [BOT_ID, OWNER_ID], created_at: now });
  client.rooms._add({ id: GROUP_ID, type: RoomType.GroupPM, recipients: [BOT_ID, OWNER_ID], created_at: now, e2ee_enabled: false, name: 'friends', creator_id: OWNER_ID });
  return { api, client: client as Client<true>, space };
}

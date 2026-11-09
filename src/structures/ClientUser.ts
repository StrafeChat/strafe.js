import type { Client } from '../client/Client.js';
import type { ColorResolvable } from '../builders/Colors.js';
import { resolveColor } from '../builders/Colors.js';
import { Routes } from '../rest/Routes.js';
import type { APIActivity, PresenceStatus } from '../types/api/common.js';
import type { RESTPatchAPICurrentUserJSONBody } from '../types/api/rest.js';
import type { APIOwnProfile, APISelfUser } from '../types/api/user.js';
import type { BufferResolvable } from '../util/DataResolver.js';
import { resolveFile } from '../util/DataResolver.js';
import { parseTimestamp } from '../util/Util.js';
import type { Presence } from './Presence.js';
import { ActivityType } from './Presence.js';
import type { APIUserLike } from './User.js';
import { User } from './User.js';

/** What {@link ClientUser.edit} changes. */
export interface ClientUserEditOptions {
  /** Display name (at most 32 characters); `''` clears it. */
  displayName?: string;
  /** Bio (at most 190 characters). */
  bio?: string;
  /** About me (at most 190 characters). */
  aboutMe?: string;
  /** Pronouns (at most 40 characters). */
  pronouns?: string;
  /** Accent color; `null` clears it. */
  accentColor?: ColorResolvable | null;
  /** New avatar file, or `null` to remove it. */
  avatar?: BufferResolvable | null;
  /** New banner file, or `null` to remove it. */
  banner?: BufferResolvable | null;
}

/** An activity to show ("Playing X"). */
export interface ActivityOptions {
  /** What is being played (1-128 characters). */
  name: string;
  /** Only `playing` exists. Default `playing`. */
  type?: 'playing';
}

/** What {@link ClientUser.setPresence} sets. */
export interface PresenceData {
  /** Online status. */
  status?: PresenceStatus;
  /** Free-text status (at most 128 characters); `''` clears it. */
  customStatus?: string;
  /** Activities to show; Strafe shows one. `[]` clears it. */
  activities?: ActivityOptions[];
}

/**
 * The client's own account. Changes go through `PATCH /users/@me` (and the avatar/banner
 * uploads); the activity ("Playing X") is sent over the gateway and re-sent after every reconnect.
 */
export class ClientUser extends User {
  /** Whether the account's email is verified (bots: always false). */
  declare public verified: boolean;
  /** @internal */
  declare public _createdAt: number | null;

  /**
   * @param client - The client.
   * @param data - `GET /users/@me` or READY's user.
   */
  public constructor(client: Client, data: APISelfUser | APIOwnProfile | APIUserLike) {
    super(client, data);
  }

  /** @internal */
  public override _patch(data: APIUserLike & Partial<Pick<APISelfUser, 'verified_email' | 'created_at'>>): void {
    super._patch(data);
    if ((this.verified as boolean | undefined) === undefined) this.verified = false;
    if ((this._createdAt as number | null | undefined) === undefined) this._createdAt = null;
    if (data.verified_email !== undefined) this.verified = data.verified_email;
    if (data.created_at !== undefined) this._createdAt = parseTimestamp(data.created_at);
  }

  /** When the account was created (from the server when known, else from the id). */
  public override get createdTimestamp(): number {
    return this._createdAt ?? super.createdTimestamp;
  }

  /**
   * Edits the profile.
   *
   * @param options - What to change.
   * @example
   * ```ts
   * await client.user.edit({ displayName: 'Helper', bio: 'I answer questions' });
   * ```
   */
  public async edit(options: ClientUserEditOptions): Promise<this> {
    const body: RESTPatchAPICurrentUserJSONBody = {};
    if (options.displayName !== undefined) body.display_name = options.displayName;
    if (options.bio !== undefined) body.bio = options.bio;
    if (options.aboutMe !== undefined) body.about_me = options.aboutMe;
    if (options.pronouns !== undefined) body.pronouns = options.pronouns;
    if (options.accentColor !== undefined) {
      body.accent_color = options.accentColor === null ? '' : `#${resolveColor(options.accentColor).toString(16).padStart(6, '0')}`;
    }
    if (options.avatar === null) body.avatar = '';
    if (options.banner === null) body.banner = '';
    if (Object.keys(body).length > 0) {
      const data = await this.client.rest.patch<APIOwnProfile>(Routes.user(), { body });
      this._patch(data);
    }
    if (options.avatar !== undefined && options.avatar !== null) await this.upload('avatar', options.avatar);
    if (options.banner !== undefined && options.banner !== null) await this.upload('banner', options.banner);
    return this;
  }

  private async upload(kind: 'avatar' | 'banner', file: BufferResolvable): Promise<void> {
    const resolved = await resolveFile(file, undefined, this.client.rest.options.makeRequest);
    const route = kind === 'avatar' ? Routes.userAvatar() : Routes.userBanner();
    const data = await this.client.rest.post<APIOwnProfile>(route, {
      files: [{ name: resolved.name, data: resolved.data, ...(resolved.contentType === undefined ? {} : { contentType: resolved.contentType }) }],
    });
    this._patch(data);
  }

  /**
   * Sets the display name.
   *
   * @param displayName - The name; `''` clears it.
   */
  public setDisplayName(displayName: string): Promise<this> {
    return this.edit({ displayName });
  }

  /**
   * Sets or removes the avatar (png, jpg, gif or webp).
   *
   * @param avatar - The image, or `null` to remove it.
   */
  public setAvatar(avatar: BufferResolvable | null): Promise<this> {
    return this.edit({ avatar });
  }

  /**
   * Sets or removes the banner.
   *
   * @param banner - The image, or `null` to remove it.
   */
  public setBanner(banner: BufferResolvable | null): Promise<this> {
    return this.edit({ banner });
  }

  /**
   * Sets the presence: status and custom status through the API, the activity over the gateway.
   *
   * @param data - Status, custom status, activities.
   * @example
   * ```ts
   * await client.user.setPresence({ status: 'idle', activities: [{ name: 'with the API' }] });
   * ```
   */
  public async setPresence(data: PresenceData): Promise<Presence | null> {
    if (data.activities !== undefined) {
      const first = data.activities[0];
      this.client._setActivity(first ? { type: first.type ?? ActivityType.Playing, name: first.name } : null);
    }
    if (data.status !== undefined || data.customStatus !== undefined) {
      const presence: NonNullable<RESTPatchAPICurrentUserJSONBody['presence']> = {};
      if (data.status !== undefined) presence.status = data.status;
      if (data.customStatus !== undefined) presence.custom_status = data.customStatus;
      const profile = await this.client.rest.patch<APIOwnProfile>(Routes.user(), { body: { presence } });
      this._patch(profile);
    }
    return this.presence;
  }

  /**
   * Sets the status.
   *
   * @param status - `online`, `idle`, `dnd` or `invisible`.
   */
  public setStatus(status: PresenceStatus): Promise<Presence | null> {
    return this.setPresence({ status });
  }

  /**
   * Shows an activity ("Playing X"), or clears it with `null`. Sent over the gateway (op 9) and
   * re-sent after every reconnect.
   *
   * @param activity - A name or {@link ActivityOptions}.
   * @example
   * ```ts
   * client.user.setActivity('Factory Builder');
   * ```
   */
  public setActivity(activity: string | ActivityOptions | null): APIActivity | null {
    const value: APIActivity | null =
      activity === null ? null : { type: ActivityType.Playing, name: typeof activity === 'string' ? activity : activity.name };
    this.client._setActivity(value);
    return value;
  }
}

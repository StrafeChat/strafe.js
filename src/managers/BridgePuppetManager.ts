import { Routes } from '../rest/Routes.js';
import type { APIBridgeBlock, APIBridgePuppet, RESTPatchAPIBridgePuppetJSONBody } from '../types/api/bridge.js';
import type { Snowflake } from '../util/Snowflake.js';
import type { Bridge, BridgeExternalUser } from '../structures/Bridge.js';
import type { User } from '../structures/User.js';
import { BaseManager } from './BaseManager.js';

/** A bridged user as the driving bot sees them. */
export interface BridgePuppet {
  /** Their id on Strafe (moderators block by it). */
  puppetId: Snowflake;
  /** The bridge. */
  bridgeId: Snowflake;
  /** Their id on the other platform. */
  externalUserId: string;
  /** Last-known name. */
  name: string;
  /** Last-known picture, or `null`. */
  avatarURL: string | null;
  /** A bot on the other platform. */
  bot: boolean;
  /** Their profile there, or `null`. */
  profileURL: string | null;
  /** Whether a moderator blocked them from this bridge. */
  blocked: boolean;
  /** When they last posted. */
  lastSeenAt: Date;
  /** A member of the space with the same name, or `null`. */
  lookalike: { id: Snowflake; username: string } | null;
}

/** A moderator's block of a bridged user. */
export interface BridgeBlock {
  /** The bridged user's id on Strafe. */
  puppetId: Snowflake;
  /** The bridge. */
  bridgeId: Snowflake;
  /** Their name when blocked. */
  name: string;
  /** Why, or `null`. */
  reason: string | null;
  /** When. */
  blockedAt: Date;
  /** The moderator (a user, or an id when the account is gone), or `null`. */
  blockedBy: User | Snowflake | null;
}

function puppet(data: APIBridgePuppet): BridgePuppet {
  return {
    puppetId: data.puppet_id,
    bridgeId: data.bridge_id,
    externalUserId: data.external_user_id,
    name: data.name,
    avatarURL: data.avatar,
    bot: data.bot,
    profileURL: data.profile_url,
    blocked: data.blocked,
    lastSeenAt: new Date(data.last_seen_at),
    lookalike: data.lookalike,
  };
}

/**
 * The bridged users a bridge remembers, by their id on the other platform (the driving bot only).
 * A bridged user is remembered from their first message until 90 days without one.
 */
export class BridgePuppetManager extends BaseManager {
  /** The bridge. */
  declare public readonly bridge: Bridge;

  /**
   * @param bridge - The bridge.
   */
  public constructor(bridge: Bridge) {
    super(bridge.client);
    Object.defineProperty(this, 'bridge', { value: bridge, enumerable: false });
  }

  /**
   * Fetches a bridged user.
   *
   * @param externalUserId - Their id on the other platform.
   */
  public async fetch(externalUserId: string): Promise<BridgePuppet> {
    return puppet(await this.client.rest.get<APIBridgePuppet>(Routes.bridgePuppet(this.bridge.id, externalUserId)));
  }

  /**
   * Updates a bridged user's name or picture without a message (only later messages show it; each
   * message keeps the identity it was sent with).
   *
   * @param externalUserId - Their id on the other platform.
   * @param options - Name, picture, bot flag, profile link.
   */
  public async edit(externalUserId: string, options: Partial<Omit<BridgeExternalUser, 'id' | 'colour'>>): Promise<BridgePuppet> {
    const body: RESTPatchAPIBridgePuppetJSONBody = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.avatarURL !== undefined) body.avatar_url = options.avatarURL;
    if (options.bot !== undefined) body.bot = options.bot;
    if (options.profileURL !== undefined) body.profile_url = options.profileURL;
    return puppet(await this.client.rest.patch<APIBridgePuppet>(Routes.bridgePuppet(this.bridge.id, externalUserId), { body }));
  }

  /**
   * Forgets a bridged user now (a privacy request on the other platform): their record and id-map
   * entries go; their messages stay under the name they were sent with.
   *
   * @param externalUserId - Their id on the other platform.
   */
  public async delete(externalUserId: string): Promise<void> {
    await this.client.rest.delete(Routes.bridgePuppet(this.bridge.id, externalUserId));
  }
}

/**
 * Moderators' blocks of a bridge's users (Kick Members or Manage Messages in the room). A blocked
 * bridged user's sends, edits and reactions are refused (`puppet_blocked`), and the driving bot
 * hears of it ({@link Events.BridgePuppetBlock}).
 */
export class BridgeBlockManager extends BaseManager {
  /** The bridge. */
  declare public readonly bridge: Bridge;

  /**
   * @param bridge - The bridge.
   */
  public constructor(bridge: Bridge) {
    super(bridge.client);
    Object.defineProperty(this, 'bridge', { value: bridge, enumerable: false });
  }

  /**
   * Fetches the blocks, newest first, a page at a time.
   *
   * @param options - `before`: a puppet id from the previous page.
   */
  public async fetch(options: { before?: Snowflake | undefined } = {}): Promise<BridgeBlock[]> {
    const list = await this.client.rest.get<APIBridgeBlock[]>(Routes.bridgeBlocks(this.bridge.id), { query: { before: options.before } });
    return list.map((data) => ({
      puppetId: data.puppet_id,
      bridgeId: data.bridge_id,
      name: data.name,
      reason: data.reason,
      blockedAt: new Date(data.blocked_at),
      blockedBy: data.blocked_by === null || typeof data.blocked_by === 'string' ? data.blocked_by : this.client.users._add(data.blocked_by),
    }));
  }

  /**
   * Blocks a bridged user from this bridge (audit-logged).
   *
   * @param puppetId - Their id on Strafe (`message.masquerade.bridge.puppetId`).
   * @param options - Audit-log reason.
   */
  public async create(puppetId: Snowflake, options: { reason?: string | undefined } = {}): Promise<void> {
    await this.client.rest.put(Routes.bridgeBlock(this.bridge.id, puppetId), options.reason === undefined ? {} : { body: { reason: options.reason } });
  }

  /**
   * Lifts a block.
   *
   * @param puppetId - Their id on Strafe.
   * @param reason - Audit-log reason.
   */
  public async remove(puppetId: Snowflake, reason?: string): Promise<void> {
    await this.client.rest.delete(Routes.bridgeBlock(this.bridge.id, puppetId), reason === undefined ? {} : { body: { reason } });
  }
}

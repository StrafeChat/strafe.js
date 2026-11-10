import type { Client } from '../client/Client.js';
import type { APIAuditLog, APIAuditLogEntry, AuditLogActionType } from '../types/api/space.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { SnowflakeUtil } from '../util/Snowflake.js';
import { parseTimestamp } from '../util/Util.js';
import type { Space } from './Space.js';
import type { User } from './User.js';

/** One changed field of an audit-log entry. */
export interface AuditLogChange {
  /** The field. */
  key: string;
  /** The value before. */
  old?: unknown;
  /** The value after. */
  new?: unknown;
}

/**
 * One moderation action in a space's audit log. Strafe names actions with strings
 * (`member_ban_add`, `role_update`...) rather than numbers.
 */
export class AuditLogEntry {
  /** The space. */
  declare public readonly space: Space;
  /** The entry id. */
  public readonly id: Snowflake;
  /** What happened. */
  public readonly action: AuditLogActionType;
  /** Who did it. */
  public readonly executorId: Snowflake;
  /** What it was done to: an id, or `<room>:role:<role>` for permission overrides. */
  public readonly targetId: string;
  /** Changed fields. */
  public readonly changes: AuditLogChange[];
  /** The reason, if one was given (only bans take one). */
  public readonly reason: string | null;
  /** When (Unix ms). */
  public readonly createdTimestamp: number;

  /**
   * @param space - The space.
   * @param data - Wire data.
   */
  public constructor(space: Space, data: APIAuditLogEntry) {
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    this.id = data.id;
    this.action = data.action_type;
    this.executorId = data.user_id;
    this.targetId = data.target_id;
    this.changes = Object.entries(data.changes ?? {}).map(([key, change]) => ({ key, ...change }));
    this.reason = data.reason === undefined || data.reason === '' ? null : data.reason;
    this.createdTimestamp = parseTimestamp(data.created_at) ?? SnowflakeUtil.timestampFrom(data.id);
  }

  /** Who did it, when cached. */
  public get executor(): User | null {
    return this.space.client.users.cache.get(this.executorId) ?? null;
  }

  /** When. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** Plain JSON. */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      action: this.action,
      executorId: this.executorId,
      targetId: this.targetId,
      changes: this.changes,
      reason: this.reason,
      createdTimestamp: this.createdTimestamp,
      spaceId: this.space.id,
    };
  }
}

/** A page of a space's audit log. */
export class SpaceAuditLogs {
  /** Entries, newest first. */
  public readonly entries: Collection<Snowflake, AuditLogEntry>;

  /**
   * @param client - The client (users in the page are cached).
   * @param space - The space.
   * @param data - Wire data.
   */
  public constructor(client: Client, space: Space, data: APIAuditLog) {
    for (const user of Object.values(data.users)) client.users._add(user);
    this.entries = new Collection(data.entries.map((entry) => [entry.id, new AuditLogEntry(space, entry)] as const));
  }

  /** Plain JSON. */
  public toJSON(): unknown[] {
    return [...this.entries.values()].map((entry) => entry.toJSON());
  }
}

import type { Client } from '../../client/Client.js';
import type { APIFederationRef } from '../../types/api/common.js';
import type { APIPMRoom, APISpaceRoom } from '../../types/api/room.js';
import { RoomType } from '../../types/api/room.js';
import { roomMention } from '../../util/Formatters.js';
import type { Snowflake } from '../../util/Snowflake.js';
import { SnowflakeUtil } from '../../util/Snowflake.js';
import { Base } from '../Base.js';
import type { GroupPMRoom } from './GroupPMRoom.js';
import type { AnyRoom, PMBasedRoom, SendableRoom, SpaceBasedRoom, TextBasedRoom } from './index.js';
import type { PMRoom } from './PMRoom.js';
import type { SectionRoom } from './SectionRoom.js';
import type { TextRoom } from './TextRoom.js';
import type { ThreadRoom } from './ThreadRoom.js';
import type { VoiceRoom } from './VoiceRoom.js';

/** Any wire form of a room: a full space room, the light form, or a partial update. */
export type APIRoomLike = { id: Snowflake } & Partial<Omit<APISpaceRoom, 'id' | 'type'>> &
  Partial<Omit<APIPMRoom, 'id' | 'type' | 'parent_id'>> & { type?: RoomType; parent_id?: Snowflake | null };

/** Where a room is mirrored from, for a room of a space hosted on another instance. */
export interface FederationRef {
  /** The hosting instance. */
  originDomain: string;
  /** The room's id there. */
  originId: Snowflake;
}

/**
 * The base of every room. Use the type guards to narrow:
 *
 * @example
 * ```ts
 * if (room.isTextBased() && !room.isEncrypted()) await room.send('hello');
 * switch (room.type) {
 *   case RoomType.SpaceText: room.topic; break;
 *   case RoomType.Thread: room.archived; break;
 * }
 * ```
 */
export abstract class BaseRoom extends Base {
  /** The id. */
  declare public readonly id: Snowflake;
  /** The type. */
  declare public readonly type: RoomType;
  /**
   * The room's encryption setting as sent; `null` means the default (on for PMs and group PMs,
   * off for space rooms). Use {@link BaseRoom.isEncrypted}.
   */
  declare public e2eeEnabled: boolean | null;
  /** For a room of a space hosted on another instance: where it lives. */
  declare public federation: FederationRef | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   */
  public constructor(client: Client, data: APIRoomLike & { type: RoomType }) {
    super(client);
    Object.defineProperty(this, 'id', { value: data.id, enumerable: true });
    Object.defineProperty(this, 'type', { value: data.type, enumerable: true });
    this.e2eeEnabled = null;
    this.federation = null;
  }

  /** @internal */
  public _patch(data: APIRoomLike): void {
    if (data.e2ee_enabled !== undefined) this.e2eeEnabled = data.e2ee_enabled;
    if (data.federation !== undefined) this.federation = federationRef(data.federation);
  }

  /** When the room was created. */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /** When the room was created. */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /** Whether only part of the room is known (always false: rooms are built from full payloads). */
  public readonly partial: boolean = false;

  /** The room's page in the web client. */
  public get url(): string {
    const spaceId = (this as { spaceId?: Snowflake | null }).spaceId;
    return spaceId ? `${this.client.urls.web}/spaces/${spaceId}/rooms/${this.id}` : `${this.client.urls.web}/rooms/${this.id}`;
  }

  /**
   * Whether the room is end-to-end encrypted. Bots cannot read or post in encrypted rooms: their
   * messages arrive with `content === null`, and sending is refused locally with
   * {@link ErrorCodes.RoomEncrypted}. 1:1 PMs are always encrypted.
   */
  public isEncrypted(): boolean {
    if (this.type === RoomType.PM) return true;
    return this.e2eeEnabled ?? this.type === RoomType.GroupPM;
  }

  /** Whether the room holds messages (text rooms, voice-room chat, threads, PMs). */
  public isTextBased(): this is TextBasedRoom {
    return this.type !== RoomType.SpaceSection;
  }

  /** Whether the client could send here: text-based and not end-to-end encrypted. */
  public isSendable(): this is SendableRoom {
    return this.isTextBased() && !this.isEncrypted();
  }

  /** Whether this is a voice room. */
  public isVoiceBased(): this is VoiceRoom {
    return this.type === RoomType.SpaceVoice;
  }

  /** Whether this is a PM or group PM. */
  public isPMBased(): this is PMBasedRoom {
    return this.type === RoomType.PM || this.type === RoomType.GroupPM;
  }

  /** Whether this is a thread. */
  public isThread(): this is ThreadRoom {
    return this.type === RoomType.Thread;
  }

  /** Whether this is a section (a group of rooms). */
  public isSection(): this is SectionRoom {
    return this.type === RoomType.SpaceSection;
  }

  /** Whether the room belongs to a space. */
  public isSpaceBased(): this is SpaceBasedRoom {
    return !this.isPMBased();
  }

  /** Whether this is a space text room. */
  public isTextRoom(): this is TextRoom {
    return this.type === RoomType.SpaceText;
  }

  /** Whether this is a 1:1 PM. */
  public isPM(): this is PMRoom {
    return this.type === RoomType.PM;
  }

  /** Whether this is a group PM. */
  public isGroupPM(): this is GroupPMRoom {
    return this.type === RoomType.GroupPM;
  }

  /**
   * Fetches the room again.
   *
   * @param force - Skip the cache (default true).
   */
  public fetch(force = true): Promise<AnyRoom> {
    return this.client.rooms.fetch(this.id, { force });
  }

  /** A mention: `<#id>`. */
  public override toString(): `<#${Snowflake}>` {
    return roomMention(this.id);
  }
}

/** @internal */
export function federationRef(ref: APIFederationRef | undefined | null): FederationRef | null {
  return ref ? { originDomain: ref.origin_domain, originId: ref.origin_id } : null;
}

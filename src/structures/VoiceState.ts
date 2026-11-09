import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import type { RESTPatchAPISpaceMemberVoiceJSONBody } from '../types/api/rest.js';
import type { APIVoiceState } from '../types/api/voice.js';
import type { Snowflake } from '../util/Snowflake.js';
import { parseTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import type { BaseRoom } from './rooms/BaseRoom.js';
import type { Space } from './Space.js';
import type { SpaceMember } from './SpaceMember.js';
import type { User } from './User.js';

/**
 * Someone's state in a voice room: read it, and moderate it (server mute, deafen, move,
 * disconnect). Bots cannot join calls: calls are end-to-end encrypted with per-sender keys and a bot
 * has none, so there is no voice connection API.
 */
export class VoiceState extends Base {
  /** The space (`null` for a PM call). */
  declare public readonly space: Space | null;
  /** The user id. */
  declare public readonly id: Snowflake;
  /** The voice room, or `null` when not connected. */
  declare public roomId: Snowflake | null;
  /** The voice session id. */
  declare public sessionId: string | null;
  /** Muted themselves. */
  declare public selfMute: boolean | null;
  /** Deafened themselves. */
  declare public selfDeaf: boolean | null;
  /** Muted by a moderator. */
  declare public serverMute: boolean | null;
  /** Deafened by a moderator. */
  declare public serverDeaf: boolean | null;
  /** Camera on. */
  declare public selfVideo: boolean | null;
  /** Sharing their screen. */
  declare public streaming: boolean | null;
  /** Suppressed. */
  declare public suppress: boolean | null;
  /** Priority speaker. */
  declare public prioritySpeaker: boolean | null;
  /** Whether the media connection is up. */
  declare public connected: boolean;
  /** When they joined (Unix ms). */
  declare public joinedTimestamp: number | null;

  /**
   * @param client - The client.
   * @param data - Wire data.
   * @param space - The space, if any.
   */
  public constructor(client: Client, data: Partial<APIVoiceState> & { user_id: Snowflake }, space: Space | null) {
    super(client);
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
    Object.defineProperty(this, 'id', { value: data.user_id, enumerable: true });
    this.roomId = null;
    this.sessionId = null;
    this.selfMute = null;
    this.selfDeaf = null;
    this.serverMute = null;
    this.serverDeaf = null;
    this.selfVideo = null;
    this.streaming = null;
    this.suppress = null;
    this.prioritySpeaker = null;
    this.connected = false;
    this.joinedTimestamp = null;
    this._patch(data);
  }

  /** @internal */
  public _patch(data: Partial<APIVoiceState>): void {
    if (data.left === true) {
      this.roomId = null;
      this.connected = false;
      return;
    }
    if (data.room_id !== undefined) this.roomId = data.room_id;
    if (data.session_id !== undefined) this.sessionId = data.session_id;
    if (data.self_mute !== undefined) this.selfMute = data.self_mute;
    if (data.self_deaf !== undefined) this.selfDeaf = data.self_deaf;
    if (data.mute !== undefined) this.serverMute = data.mute;
    if (data.deaf !== undefined) this.serverDeaf = data.deaf;
    if (data.self_video !== undefined) this.selfVideo = data.self_video;
    if (data.self_stream !== undefined) this.streaming = data.self_stream;
    if (data.suppress !== undefined) this.suppress = data.suppress;
    if (data.priority_speaker !== undefined) this.prioritySpeaker = data.priority_speaker;
    if (data.connected !== undefined) this.connected = data.connected;
    if (data.joined_at !== undefined) this.joinedTimestamp = parseTimestamp(data.joined_at);
    if (data.user) this.client.users._add(data.user);
  }

  /** Muted either way. */
  public get mute(): boolean | null {
    return this.serverMute === null && this.selfMute === null ? null : this.serverMute === true || this.selfMute === true;
  }

  /** Deafened either way. */
  public get deaf(): boolean | null {
    return this.serverDeaf === null && this.selfDeaf === null ? null : this.serverDeaf === true || this.selfDeaf === true;
  }

  /** The room, when cached. */
  public get room(): BaseRoom | null {
    return this.roomId === null ? null : (this.client.rooms.cache.get(this.roomId) ?? null);
  }

  /** The member, when cached. */
  public get member(): SpaceMember | null {
    return this.space?.members.cache.get(this.id) ?? null;
  }

  /** The user, when cached. */
  public get user(): User | null {
    return this.client.users.cache.get(this.id) ?? null;
  }

  private async moderate(body: RESTPatchAPISpaceMemberVoiceJSONBody): Promise<this> {
    if (!this.space) throw new TypeError('Voice moderation only exists in spaces');
    await this.client.rest.patch(Routes.spaceMemberVoice(this.space.id, this.id), { body });
    return this;
  }

  /**
   * Server-mutes or unmutes (Mute Members).
   *
   * @param mute - Mute or not.
   * @param _reason - Ignored (Strafe records no reason).
   */
  public setMute(mute = true, _reason?: string): Promise<this> {
    return this.moderate({ mute });
  }

  /**
   * Server-deafens or undeafens (Deafen Members).
   *
   * @param deaf - Deafen or not.
   * @param _reason - Ignored.
   */
  public setDeaf(deaf = true, _reason?: string): Promise<this> {
    return this.moderate({ deaf });
  }

  /**
   * Moves them to another voice room of the space (Move Members), or disconnects them with `null`.
   *
   * @param room - The room or its id, or `null`.
   * @param _reason - Ignored.
   */
  public async setRoom(room: BaseRoom | Snowflake | null, _reason?: string): Promise<this> {
    if (room === null) return this.disconnect();
    return this.moderate({ room_id: typeof room === 'string' ? room : room.id });
  }

  /**
   * Disconnects them from voice (Move Members).
   *
   * @param _reason - Ignored.
   */
  public async disconnect(_reason?: string): Promise<this> {
    if (!this.space) throw new TypeError('Voice moderation only exists in spaces');
    await this.client.rest.delete(Routes.spaceMemberVoice(this.space.id, this.id));
    return this;
  }
}

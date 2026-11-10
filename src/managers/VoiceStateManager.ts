import { Routes } from '../rest/Routes.js';
import type { BaseRoom } from '../structures/rooms/BaseRoom.js';
import type { Space } from '../structures/Space.js';
import { VoiceState } from '../structures/VoiceState.js';
import type { RESTGetAPIVoiceStatesResult } from '../types/api/rest.js';
import type { APIVoiceState } from '../types/api/voice.js';
import { Collection } from '../util/Collection.js';
import type { Snowflake } from '../util/Snowflake.js';
import { CachedManager } from './BaseManager.js';

/** A space's voice states, by user id. Filled by READY, `VOICE_STATE_UPDATE` and {@link VoiceStateManager.fetch}. */
export class VoiceStateManager extends CachedManager<Snowflake, VoiceState, VoiceState> {
  /** The space. */
  declare public readonly space: Space;

  /**
   * @param space - The space.
   */
  public constructor(space: Space) {
    super(space.client, 'VoiceStateManager');
    Object.defineProperty(this, 'space', { value: space, enumerable: false });
  }

  /** @internal */
  public _add(data: Partial<APIVoiceState> & { user_id: Snowflake }, cache = true): VoiceState {
    return this._upsert(data.user_id, data, cache, () => new VoiceState(this.client, data, this.space));
  }

  /**
   * Fetches the voice states of one voice room.
   *
   * @param room - The voice room or its id.
   */
  public async fetch(room: BaseRoom | Snowflake): Promise<Collection<Snowflake, VoiceState>> {
    const id = typeof room === 'string' ? room : room.id;
    const data = await this.client.rest.get<RESTGetAPIVoiceStatesResult>(Routes.roomVoiceStates(id));
    const out = new Collection<Snowflake, VoiceState>();
    for (const state of data.states) out.set(state.user_id, this._add(state));
    return out;
  }
}

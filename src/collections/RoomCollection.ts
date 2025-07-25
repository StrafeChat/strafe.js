import { Room } from "../structure";
import { ApiError, IRoom, RoomCreateOptions } from "../types";
import { CacheManager } from "./CacheManager";

export class RoomCollection extends CacheManager<Room> {
  /**
   * Get a channel from cache or fetch one if it isn't cached.
   * @param id The id of the channel.
   * @returns A channel or null if one is not found.
   * @throws Error is thrown if something goes wrong.
   */
  public async fetch(id: string) {
    const cached = this.get(id);
    if (cached) return cached;

    const res = await fetch(`${this.client.config.equinox}/channels/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `${this.client.token}`,
      },
    });

    const data = (await res.json()) as IRoom | ApiError;

    if (res.status == 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

    (data as IRoom).client = this.client;
    (data as IRoom).space = await this.client.spaces.fetch(
      (data as IRoom).space_id!
    );
    const room = new Room(data as IRoom);
    this.set(room.id, room);
    return room;
  }

  public async create(data: Partial<RoomCreateOptions>) {
    const res = await fetch(`${this.client.config.equinox}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    const resData = (await res.json()) as ApiError | IRoom;

    if (!res.ok) {
      throw new Error(
        "Failed to create room: " + (resData as ApiError).message
      );
    }

    (resData as IRoom).client = this.client;
    const channel = new Room(resData as IRoom);
    this.set(channel.id, channel);
    return channel;
  }
}

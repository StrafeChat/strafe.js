import { Room } from "../structure/Room";
import { ApiError, IRoom } from "../types";
import { CacheManager } from "./CacheManager";

export class RoomManager extends CacheManager<Room> {

    /**
     * Get a rooom from cache or fetch one if it isn't cached.
     * @param id The id of the room
     * @returns A room or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    public async fetch(id: string) {
        const cached = this.get(id);
        if (cached) return cached;

        const res = await fetch(`${this.client.config.equinox}/rooms/${id}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });

        const data = await res.json() as IRoom | ApiError;

        if (res.status == 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

        const room = new Room(data as IRoom);
        this.set(room.id, room);
        return room;
    }
}
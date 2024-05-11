import { Room } from "../structure/Room";
import { Space } from "../structure/Space";
import { ApiError, ISpace } from "../types";
import { CacheManager } from "./CacheManager";

export class SpaceManager extends CacheManager<Space> {

    /**
     * Get a space from cache or fetch one if it isn't cached.
     * @param id The id of the space
     * @returns A space or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    public async fetch(id: string) {
        const cached = this.get(id);
        if (cached) return cached;

        const res = await fetch(`${this.client.config.equinox}/spaces/${id}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });

        const data = await res.json() as ISpace | ApiError;

        if (res.status == 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

        const space = new Space(data as ISpace);
        this.set(space.id, space);
        return space;
    }

    /**
     * Creates a new space.
     * @param name The name of the space.
     * @param icon The icon of the space.
     */
    public async create(name: string) {
        const res = await fetch(`${this.client.config.equinox}/spaces`, {
            method: "POST",
            headers: {
                "authorization": `${this.client.token}`,
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                name,
            })
        });

        const data = await res.json() as any;
        if (!res.ok) throw new Error((data as ApiError).message);
        let spaceData = data.space;
        spaceData.rooms = data.rooms;
        spaceData.client = this.client;
        const space = new Space(spaceData as ISpace);
        spaceData.rooms.forEach((roomData: any) => {
            roomData.client = this.client;
            const room = new Room(roomData);
            room.messages.forEach((messageData: any) => {
                messageData.client = this.client;
                const message = messageData;
                room.messages.set(message.id, message)      
            });
            space.rooms.set(room.id, room);
        });

        this.set(space.id, space);       
        return space;
    }
}
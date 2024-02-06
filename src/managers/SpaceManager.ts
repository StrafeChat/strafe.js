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
}
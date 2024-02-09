"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpaceManager = void 0;
const Space_1 = require("../structure/Space");
const CacheManager_1 = require("./CacheManager");
class SpaceManager extends CacheManager_1.CacheManager {
    /**
     * Get a space from cache or fetch one if it isn't cached.
     * @param id The id of the space
     * @returns A space or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    async fetch(id) {
        const cached = this.get(id);
        if (cached)
            return cached;
        const res = await fetch(`${this.client.config.equinox}/spaces/${id}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });
        const data = await res.json();
        if (res.status == 404)
            return null;
        if (!res.ok)
            throw new Error(`${res.status} ${data.message}`);
        const space = new Space_1.Space(data);
        this.set(space.id, space);
        return space;
    }
}
exports.SpaceManager = SpaceManager;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpaceManager = void 0;
const Room_1 = require("../structure/Room");
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
    /**
     * Creates a new space.
     * @param name The name of the space.
     * @param icon The icon of the space.
     */
    async create(name) {
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
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.message);
        let spaceData = data.space;
        spaceData.rooms = data.rooms;
        spaceData.client = this.client;
        const space = new Space_1.Space(spaceData);
        spaceData.rooms.forEach((roomData) => {
            roomData.client = this.client;
            const room = new Room_1.Room(roomData);
            room.messages.forEach((messageData) => {
                messageData.client = this.client;
                const message = messageData;
                room.messages.set(message.id, message);
            });
            space.rooms.set(room.id, room);
        });
        this.set(space.id, space);
        return space;
    }
}
exports.SpaceManager = SpaceManager;

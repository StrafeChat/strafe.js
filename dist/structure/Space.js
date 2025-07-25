"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Space = void 0;
/**
 * Represents a space on Strafe.
 */
class Space {
    /**
     * The client.
     */
    client;
    /**
     * The space's rooms.
     */
    rooms;
    /**
     * The space's id.
     */
    id;
    /**
     * The space's name.
     */
    name;
    /**
     * The space's description, if any.
     */
    description;
    /**
     * The space's icon, if any.
     */
    icon;
    /**
     * The guild's banner, if any.
     */
    banner;
    /**
     * The ID of the guild's owner.
     */
    owner_id;
    /**
     * The space's flags.
     */
    flags;
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     * @param client The client.
     */
    constructor(data) {
        this.client = data.client;
        this.rooms = data.rooms;
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.icon = data.icon;
        this.banner = data.banner;
        this.owner_id = data.owner_id;
        this.flags = data.flags;
    }
}
exports.Space = Space;

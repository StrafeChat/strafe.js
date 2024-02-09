"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Space = void 0;
/**
 * Represents a space on Strafe.
 */
class Space {
    /**
     * The ID of the space.
     */
    id;
    /**
     * The name of the space.
     */
    name;
    /**
     * The acronym of the space.
     */
    name_acronym;
    /**
     * The icon of the space.
     */
    icon;
    /**
     * The owner of the space.
     */
    owner_id;
    /**
     * The AFK room of the space.
     */
    afk_room_id;
    /**
     * The AFK timeout of the space.
     */
    afk_timeout;
    /**
     * The verification level of the space.
     */
    verifcation_level;
    /**
     * The rooms of the space.
     */
    rooms;
    /**
     * The roles of the space.
     */
    roles;
    /**
     * The rules room of the space.
     */
    rules_room_id;
    /**
     * The description of the space.
     */
    description;
    /**
     * The banner of the space.
     */
    banner;
    /**
     * The preferred locale of the space.
     */
    preferred_locale;
    /**
     * The stickers of the space.
     */
    stickers;
    /**
     * The emojis of the space.
     */
    emojis;
    /**
     * The creation date of the space.
     */
    created_at;
    /**
     * The edit date of the space.
     */
    edited_at;
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.name_acronym = data.name_acronym;
        this.icon = data.icon;
        this.owner_id = data.owner_id;
        this.afk_room_id = data.afk_room_id;
        this.afk_timeout = data.afk_timeout;
        this.verifcation_level = data.verifcation_level;
        this.rooms = data.rooms;
        this.roles = data.roles;
        this.rules_room_id = data.rules_room_id;
        this.description = data.description;
        this.banner = data.banner;
        this.preferred_locale = data.preferred_locale;
        this.stickers = data.stickers;
        this.emojis = data.emojis;
        this.created_at = data.created_at;
        this.edited_at = data.edited_at;
    }
}
exports.Space = Space;

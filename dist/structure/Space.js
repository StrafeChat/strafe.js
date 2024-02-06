"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Space = void 0;
/**
 * Represents a space on Strafe.
 */
var Space = /** @class */ (function () {
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    function Space(data) {
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
    return Space;
}());
exports.Space = Space;

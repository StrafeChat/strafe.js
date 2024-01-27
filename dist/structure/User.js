"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
/**
 * Represents a user on strafe.
 */
var User = /** @class */ (function () {
    function User(data) {
        this.id = data.id;
        this.accent_color = data.accent_color;
        this.avatar = data.avatar;
        this.avatar_decoration = data.avatar_decoration;
        this.banned = data.banned;
        this.banner = data.banner;
        this.bot = data.bot;
        this.client = data.client;
        this.created_at = data.created_at;
        this.discriminator = data.discriminator;
        this.email = null;
        this.edited_at = data.edited_at;
        this.flags = data.flags;
        this.global_name = data.global_name;
        this.locale = data.locale;
        this.phone_number = null;
        this.premium_type = data.premium_type;
        this.presence = data.presence;
        this.public_flags = data.public_flags;
        this.system = data.system;
        this.username = data.username;
        this.verified = data.verified;
    }
    return User;
}());
exports.User = User;

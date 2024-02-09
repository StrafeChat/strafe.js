"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
/**
 * Represents a user on strafe.
 */
class User {
    /**
     * The user's id.
     */
    id;
    /**
     * The user's accent color.
     */
    accent_color;
    /**
     * The user's avatar.
     */
    avatar;
    /**
     * The user's avatar decoration.
     */
    avatar_decoration;
    /**
     * Whether the user is banned.
     */
    banned;
    /**
     * The user's banner.
     */
    banner;
    /**
     * Whether the user is a bot.
     */
    bot;
    /**
     * The client.
     */
    client;
    /**
     * The user's creation date.
     */
    created_at;
    /**
     * The user's discriminator.
     */
    discriminator;
    /**
     * The user's edit date.
     */
    edited_at;
    /**
     * The user's email.
     */
    email;
    /**
     * The user's flags.
     */
    flags;
    /**
     * The user's global name.
     */
    global_name;
    /**
     * The user's locale.
     */
    locale;
    /**
     * The user's phone number.
     */
    phone_number;
    /**
     * The user's premium type.
     */
    premium_type;
    /**
     * The user's presence.
     */
    presence;
    /**
     * The user's public flags.
     */
    public_flags;
    /**
     * Whether the user is a system user.
     */
    system;
    /**
     * The user's username.
     */
    username;
    /**
     * Whether the user is verified.
     */
    verified;
    /**
     * Creates a new instance of a User.
     * @param data The data for the user.
     * @param client The client.
     */
    constructor(data) {
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
}
exports.User = User;

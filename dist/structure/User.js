"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
/**
 * Represents a user on Strafe.
 */
class User {
    /**
     * The client.
     */
    client;
    /**
     * The user's id.
     */
    id;
    /**
     * The user's avatar.
     */
    avatar;
    /**
     * The user's about me.
     */
    aboutMe;
    /**
     * The user's bio.
     */
    bio;
    /**
     * Whether the user is a bot.
     */
    bot;
    /**
     * The user's banner.
     */
    banner;
    /**
     * The user's flags.
     */
    flags;
    /**
     * The user's username.
     */
    username;
    /**
     * The user's global name or username.
     */
    displayName;
    /**
     * The user's email.
     */
    email;
    /**
     * Creates a new instance of a User.
     * @param data The data for the user.
     * @param client The client.
     */
    constructor(data) {
        this.client = data.client;
        this.id = data.id;
        this.avatar = data.avatar;
        this.aboutMe = data.about_me;
        this.bio = data.bio;
        this.bot = data.bot;
        this.banner = data.banner;
        this.flags = data.flags;
        this.username = data.username ?? "Unkown User";
        this.displayName = data.display_name ?? data.display_name ?? this.username;
        this.email = null;
    }
}
exports.User = User;

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
    accentColor;
    /**
     * The user's avatar.
     */
    avatar;
    /**
     * The user's avatar decoration.
     */
    avatarDecoration;
    /**
     * The user's avatar decoration.
     */
    aboutMe;
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
    createdAt;
    /**
     * The user's discriminator.
     */
    discriminator;
    /**
     * The user's edit date.
     */
    editedAt;
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
    globalName;
    /**
     * The user's locale.
     */
    locale;
    /**
     * The user's phone number.
     */
    phoneNumber;
    /**
     * The user's premium type.
     */
    premiumType;
    /**
     * The user's presence.
     */
    presence;
    /**
     * The user's public flags.
     */
    publicFlags;
    /**
     * Whether the user is a system user.
     */
    system;
    /**
     * The user's username.
     */
    username;
    /**
   * The user's global name or username.
   */
    displayName;
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
        this.accentColor = data.accent_color;
        this.avatar = data.avatar;
        this.avatarDecoration = data.avatar_decoration;
        this.aboutMe = data.about_me;
        this.banned = data.banned;
        this.banner = data.banner;
        this.bot = data.bot;
        this.client = data.client;
        this.createdAt = data.created_at;
        this.discriminator = data.discriminator ?? 0;
        this.email = null;
        this.editedAt = data.edited_at;
        this.flags = data.flags;
        this.globalName = data.global_name;
        this.locale = data.locale;
        this.phoneNumber = null;
        this.premiumType = data.premium_type;
        this.presence = data.presence;
        this.publicFlags = data.public_flags;
        this.system = data.system;
        this.username = data.username ?? "Unkown User";
        this.displayName = data.display_name ?? data.global_name ?? this.username;
        this.verified = data.verified;
    }
}
exports.User = User;

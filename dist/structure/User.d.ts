import { Client } from "../client/Client";
import { IUser, UserPresence } from "../types";
/**
 * Represents a user on strafe.
 */
export declare class User {
    /**
     * The user's id.
     */
    id: string;
    /**
     * The user's accent color.
     */
    accentColor: number | null;
    /**
     * The user's avatar.
     */
    avatar: string | null;
    /**
     * The user's avatar decoration.
     */
    avatarDecoration: string | null;
    /**
     * Whether the user is banned.
     */
    banned: boolean;
    /**
     * The user's banner.
     */
    banner: string | null;
    /**
     * Whether the user is a bot.
     */
    bot: boolean;
    /**
     * The client.
     */
    client: Client;
    /**
     * The user's creation date.
     */
    createdAt: number;
    /**
     * The user's discriminator.
     */
    discriminator: number;
    /**
     * The user's edit date.
     */
    editedAt: number;
    /**
     * The user's email.
     */
    email: string | null;
    /**
     * The user's flags.
     */
    flags: number;
    /**
     * The user's global name.
     */
    globalName: string;
    /**
     * The user's locale.
     */
    locale: string | null;
    /**
     * The user's phone number.
     */
    phoneNumber: string | null;
    /**
     * The user's premium type.
     */
    premiumType: number;
    /**
     * The user's presence.
     */
    presence: UserPresence;
    /**
     * The user's public flags.
     */
    publicFlags: number;
    /**
     * Whether the user is a system user.
     */
    system: boolean;
    /**
     * The user's username.
     */
    username: string;
    /**
   * The user's global name or username.
   */
    displayName: string;
    /**
     * Whether the user is verified.
     */
    verified: boolean;
    /**
     * Creates a new instance of a User.
     * @param data The data for the user.
     * @param client The client.
     */
    constructor(data: IUser);
}

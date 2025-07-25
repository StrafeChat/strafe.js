import { Client } from "../client/Client";
import { IUser } from "../types/user";
/**
 * Represents a user on Strafe.
 */
export declare class User {
    /**
     * The client.
     */
    client: Client;
    /**
     * The user's id.
     */
    id: string;
    /**
     * The user's avatar.
     */
    avatar: string | null;
    /**
     * The user's about me.
     */
    aboutMe: string | null;
    /**
     * The user's bio.
     */
    bio: string | null;
    /**
     * Whether the user is a bot.
     */
    bot: boolean;
    /**
     * The user's banner.
     */
    banner: string | null;
    /**
     * The user's flags.
     */
    flags: number;
    /**
     * The user's username.
     */
    username: string;
    /**
     * The user's global name or username.
     */
    displayName: string;
    /**
     * The user's email.
     */
    email: string | null;
    /**
     * Creates a new instance of a User.
     * @param data The data for the user.
     * @param client The client.
     */
    constructor(data: IUser);
}

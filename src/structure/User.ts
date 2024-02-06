import { Client } from "../client/Client";
import { IUser, UserPresence } from "../types";

/**
 * Represents a user on strafe.
 */
export class User implements IUser {

    /**
     * The user's id.
     */
    public id: string;
    
    /**
     * The user's accent color.
     */
    public accent_color: number | null;
    
    /**
     * The user's avatar.
     */
    public avatar: string | null;
    
    /**
     * The user's avatar decoration.
     */
    public avatar_decoration: string | null;
    
    /**
     * Whether the user is banned.
     */
    public banned: boolean;
    
    /**
     * The user's banner.
     */
    public banner: string | null;
    
    /**
     * Whether the user is a bot.
     */
    public bot: boolean;
    
    /**
     * The client.
     */
    public client: Client;
    
    /**
     * The user's creation date.
     */
    public created_at: number;
    
    /**
     * The user's discriminator.
     */
    public discriminator: number;
    
    /**
     * The user's edit date.
     */
    public edited_at: number;
    
    /**
     * The user's email.
     */
    public email: string | null;
    
    /**
     * The user's flags.
     */
    public flags: number;
    
    /**
     * The user's global name.
     */
    public global_name: string;
    
    /**
     * The user's locale.
     */
    public locale: string | null;
    
    /**
     * The user's phone number.
     */
    public phone_number: string | null;
    
    /**
     * The user's premium type.
     */
    public premium_type: number;
    
    /**
     * The user's presence.
     */
    public presence: UserPresence;
    
    /**
     * The user's public flags.
     */
    public public_flags: number;
    
    /**
     * Whether the user is a system user.
     */
    public system: boolean;
    
    /**
     * The user's username.
     */
    public username: string;
    
    /**
     * Whether the user is verified.
     */
    public verified: boolean;

    /**
     * Creates a new instance of a User.
     * @param data The data for the user.
     * @param client The client.
     */
    constructor(data: IUser) {
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
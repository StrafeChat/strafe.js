import { Client } from "../client/Client";
import { IUser, UserPresence } from "../types";

/**
 * Represents a user on strafe.
 */
export class User implements IUser {

    public id: string;
    public accent_color: number | null;
    public avatar: string | null;
    public avatar_decoration: string | null;
    public banned: boolean;
    public banner: string | null;
    public bot: boolean;
    public client: Client;
    public created_at: number;
    public discriminator: number;
    public edited_at: number;
    public email: string | null;
    public flags: number;
    public global_name: string;
    public locale: string | null;
    public phone_number: string | null;
    public premium_type: number;
    public presence: UserPresence;
    public public_flags: number;
    public system: boolean;
    public username: string;
    public verified: boolean;

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
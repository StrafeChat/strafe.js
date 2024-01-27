import { Client } from "../client/Client";
import { IUser, UserPresence } from "../types";
/**
 * Represents a user on strafe.
 */
export declare class User implements IUser {
    id: string;
    accent_color: number | null;
    avatar: string | null;
    avatar_decoration: string | null;
    banned: boolean;
    banner: string | null;
    bot: boolean;
    client: Client;
    created_at: number;
    discriminator: number;
    edited_at: number;
    email: string | null;
    flags: number;
    global_name: string;
    phone_number: string | null;
    premium_type: number;
    presence: UserPresence;
    public_flags: number;
    system: boolean;
    username: string;
    verified: boolean;
    constructor(data: IUser);
}

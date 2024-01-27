import { Client } from "../client/Client";

export interface ClientConfig {
    equinox: string;
    nebula: string;
}

export interface ClientOptions {
    config?: Partial<ClientConfig>
}

export interface UserPresence {
    online: boolean;
    status: string;
    status_text: string;
}

export interface ClientUserEditOptions {
    username: string;
    email: string;
}

export type Events = "READY" | "PRESENCE_UPDATE";

export interface IUser {
    client: Client;
    id: string;
    accent_color: number | null;
    avatar: string | null;
    avatar_decoration: string | null;
    banned: boolean;
    banner: string | null;
    bot: boolean;
    created_at: number;
    discriminator: number;
    email: string | null;
    edited_at: number;
    flags: number;
    global_name: string;
    locale: string | null;
    phone_number: string | null;
    premium_type: number;
    presence: UserPresence;
    public_flags: number;
    system: boolean;
    username: string;
    verified: boolean;
}
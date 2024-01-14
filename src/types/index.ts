export interface ClientConfig {
    equinox: string;
}

export interface ClientOptions {
    config?: ClientConfig
}

export interface UserPresence {
    online: boolean;
    status: string;
    status_text: string;
}

export type Events = "READY";

export interface IUser {
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
    premium_type: number;
    presence: UserPresence;
    public_flags: number;
    system: boolean;
    username: string;
    verified: boolean;
}
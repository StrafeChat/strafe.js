import { Client } from "../client/Client";
/***
 * @typedef {Object} ClientConfig
 * @property {string} equinox
 * @property {string} nebula
 */
export interface ClientConfig {
    equinox: string;
    nebula: string;
}
/***
 * @typedef {Object} ClientOptions
 * @property {Partial<ClientConfig>} config
 */
export interface ClientOptions {
    config?: Partial<ClientConfig>;
}
/***
 * @typedef {Object} UserPresence
 * @property {boolean} online
 * @property {string} status
 * @property {string} status_text
 */
export interface UserPresence {
    online: boolean;
    status: string;
    status_text: string;
}
/***
 * @typedef {Object} ClientUserEditOptions
 * @property {string} username
 * @property {string} email
 * @property {string} locale
 */
export interface ClientUserEditOptions {
    username: string;
    email: string;
    locale: string;
}
/***
 * @typedef {"READY" | "PRESENCE_UPDATE"} Events
 */
export type Events = "READY" | "PRESENCE_UPDATE";
export interface ReadyEvent {
    user: IUser;
}
export interface ErrorEvent extends ApiError {
}
export interface EventMap {
    ready: ReadyEvent;
    error: ErrorEvent;
    presenceUpdate: any;
}
/***
 * @typedef {Object} ClientEvents
 * @property {(event: "READY") => void} READY
 * @property {(event: "PRESENCE_UPDATE") => void} PRESENCE_UPDATE
 */
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
/***
 * @typedef {Object} ISpace
 * @property {string} id
 * @property {string} name
 * @property {string} name_acronym
 * @property {string | null} icon
 * @property {string} owner_id
 * @property {string} afk_room_id
 * @property {number} afk_timeout
 * @property {number} verifcation_level
 * @property {any[]} rooms
 * @property {never[]} roles
 * @property {string} rules_room_id
 * @property {string} description
 * @property {string} banner
 * @property {string} preferred_locale
 * @property {never[]} stickers
 * @property {never[]} emojis
 * @property {number} created_at
 * @property {number} edited_at
 */
export interface ISpace {
    id: string;
    name: string;
    name_acronym: string;
    icon: string | null;
    owner_id: string;
    afk_room_id: string;
    afk_timeout: number;
    verifcation_level: number;
    rooms: any[];
    roles: never[];
    rules_room_id: string;
    description: string;
    banner: string;
    preferred_locale: string;
    stickers: never[];
    emojis: never[];
    created_at: number;
    edited_at: number;
}
/***
 * @typedef {Object} ApiError
 * @property {string} message
 */
export interface ApiError {
    message: string;
}

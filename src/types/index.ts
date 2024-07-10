import { Client } from "../client/Client";
import { MemberManager } from "../managers/MemberManager";
import { MessageManager } from "../managers/MessageManager";
import { Member } from "../structure/Member";
import { Room } from "../structure/Room";
import { Space } from "../structure/Space";

/*** 
 * @typedef {Object} ClientConfig
 * @property {string} equinox
 * @property {string} nebula
 * @property {string} livekit
 */
export interface ClientConfig {
    equinox: string;
    nebula: string;
    livekit: string;
}

/*** 
 * @typedef {Object} ClientOptions
 * @property {Partial<ClientConfig>} config
 */
export interface ClientOptions {
    config?: Partial<ClientConfig>
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
 * @property {string} avatar
 */
export interface ClientUserEditOptions {
    username: string;
    email: string;
    locale: string;
    avatar: string;
}

export interface MessageEmbedFooter {
    text: string;
    icon_url: string | null;
}

export interface MessageEmbedAuthor {
    name: string | null;
    url: string | null;
    icon_url: string | null;
}

export interface MessageEmbedMedia {
    url: string;
    height: number | null;
    width: number | null;
}

export interface MessageEmbedField {
    name: string;
    value: string;
    inline: boolean;
}

export interface MessageEmbed {
    title: string | null;
    description: string | null;
    url: string | null;
    timestamp: number | null;
    color: string | null;
    footer: MessageEmbedFooter | null;
    image: MessageEmbedMedia | null;
    thumbnail: MessageEmbedMedia | null;
    video: MessageEmbedMedia | null;
    author: MessageEmbedAuthor | null;
    fields: MessageEmbedField[] | null;
}

export interface HasPermissionOptions {
    permission: string;
}

export interface RoomMessageOptions {
    content: string;
    embeds?: MessageEmbed[];
    reference_id?: string;
    attachments?: object[];
}

export interface RoomCreateOptions {
    name: string;
    type: number;
    space_id?: string;
    parent_id?: string;
}

/*** 
 * @typedef {"READY" | "PRESENCE_UPDATE" | "MESSAGE_CREATE" | "MESSAGE_DELETE" | "MESSAGE_UPDATE" | "TYPING_START" | "FRIEND_REQUEST_CREATE" | "FRIEND_REQUEST_CANCEL" | "FRIEND_REQUEST_DECLINE" | "FRIEND_REQUEST_ACCEPT" | "VOICE_JOIN" | "VOICE_LEAVE"} Events
 */
export type Events = "READY" | "PRESENCE_UPDATE" | "MESSAGE_CREATE" | "MESSAGE_DELETE" | "MESSAGE_UPDATE" | "TYPING_START" | "FRIEND_REQUEST_CREATE" | "FRIEND_REQUEST_CANCEL" | "FRIEND_REQUEST_DECLINE" | "FRIEND_REQUEST_ACCEPT" | "VOICE_JOIN" | "VOICE_LEAVE";

export interface ReadyEvent {
    user: IUser;
    spaces: ISpace[];
}

export interface ErrorEvent extends ApiError { };

export interface EventMap {
    ready: ReadyEvent;
    error: ErrorEvent
    presenceUpdate: any;
    messageCreate: any;
    messageDelete: any;
    messageUpdate: any;
    typingStart: any;
    friendRequestCreate: IFriendRequest;
    friendRequestAccept: IPartialFriendRequest;
    friendRequestDecline: IPartialFriendRequest;
    friendRequestDelete: IPartialFriendRequest;
    voiceJoin: any;
    voiceLeave: any;
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
    about_me: string | null;
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
    display_name: string;
    verified: boolean;
    friends?: string[];
}

export interface IFriendRequest {
    id: string;
    sender_id: string;
    recipient_id: string;
    created_at: number;
}
export interface IPartialFriendRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
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
    client: Client;
    id: string;
    name: string;
    name_acronym: string;
    icon: string | null;
    owner_id: string;
    afk_room_id: string;
    afk_timeout: number;
    verifcation_level: number;
    rooms: any;
    members: any;
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

export interface PermissionOverwrite {
    id: string;
    type: number;
    allow_flags: number;
    deny_flags: number;
}

export interface IRoom {
    created_at: number;
    client: Client;
    id: string;
    type: number;
    space_id: string | null;
    position: number;
    owner_id: string | null;
    permission_overwrites: PermissionOverwrite[],
    name: string | null;
    topic: string | null;
    last_message_id: string | null;
    bitrate: number | null;
    user_limit: number | null;
    rate_limit: number | null;
    recipients: string[];
    messages: MessageManager,
    icon: string | null;
    parent_id: string | null;
    last_pin_timestamp: string | null;
    rtc_region: number | null;
    edited_at: number;
    participants?: { id: string }[];
    space_members?: MemberManager;
}

export interface ISpaceMember {
    user_id: string;
    space_id: string;
    nick: string | null;
    roles: string[];
    joined_at: number;
    deaf: boolean;
    mute: boolean;
    avatar: string | null;
    edited_at: number;
    user: IUser;
}

export interface ISpaceRole {
    space_id: string;
    color: string;
    hoist: boolean;
    rank: number;
    permissions: PermissionOverwrite[];
}

export interface MessageSudo {
    name: string | null;
    avatar_url: string | null;
    color: string | null;
}

export interface IMessage {
    member: Member;
    space: Space;
    room: Room;
    client: Client;
    id: string;
    room_id: string;
    author_id: string;
    author: IUser;
    space_id: string | null;
    content: string | null;
    created_at: number;
    edited_at: number | null;
    tts: boolean;
    mention_everyone: boolean;
    mentions: string[] | null;
    mention_roles: string[] | null;
    mention_rooms: string[] | null;
    attachments: string[] | null;
    embeds: MessageEmbed[] | null;
    sudo: MessageSudo | null;
    reactions: any[] | null;
    pinned: boolean;
    webhook_id: string | null;
    system: boolean;
    message_reference_id: string | null;
    flags: number | null;
    thread_id: string | null;
    stickers: string[] | null;
    nonce: number | null;
}

export interface IInvite {
    code: string;
    vanity: boolean;
    inviter_id: string;
    uses: number;
    max_uses: number;
    space_id: string;
    room_id: string;
    created_at: number;
    expires_at: number | null;
    member_count: number;
    space: ISpace;
    inviter: IUser;
}

export interface IRoomUserChange {
  room: string;
  space: string;
  space_id: string;
  user: string;
}

export interface CreateInviteOptions {
    max_uses: number | null;
    expires_at: number | null;
}

/*** 
 * @typedef {Object} ApiError
 * @property {string} message
 */
export interface ApiError {
    message: string;
    code: number;
}

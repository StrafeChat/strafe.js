import { Client } from "../client/Client";
import { RoomManager } from "../managers/RoomManager";
import { MemberManager } from "../managers/MemberManager";
import { IRoom, ISpace, ISpaceMember } from "../types";
import { Room } from "./Room";
import { Member } from "./Member";

/**
 * Represents a space on Strafe.
 */
export class Space implements ISpace {

    public readonly client: Client;

    /**
     * The ID of the space.
     */
    public readonly id: string;

    /**
     * The name of the space.
     */
    public readonly name: string;

    /**
     * The acronym of the space.
     */
    public readonly name_acronym: string;

    /**
     * The icon of the space.
     */
    public readonly icon: string | null;

    /**
     * The owner of the space.
     */
    public readonly owner_id: string;

    /**
     * The AFK room of the space.
     */
    public readonly afk_room_id: string;

    /**
     * The AFK timeout of the space.
     */
    public readonly afk_timeout: number;

    /**
     * The verification level of the space.
     */
    public readonly verifcation_level: number;

    /**
     * The rooms of the space.
     */
    public readonly rooms: RoomManager;

        /**
     * The rooms of the space.
     */
        public readonly members: MemberManager;

    /**
     * The roles of the space.
     */
    public readonly roles: never[];

    /**
     * The rules room of the space.
     */
    public readonly rules_room_id: string;

    /**
     * The description of the space.
     */
    public readonly description: string;

    /**
     * The banner of the space.
     */
    public readonly banner: string;

    /**
     * The preferred locale of the space.
     */
    public readonly preferred_locale: string;

    /**
     * The stickers of the space.
     */
    public readonly stickers: never[];

    /**
     * The emojis of the space.
     */
    public readonly emojis: never[];

    /**
     * The creation date of the space.
     */
    public readonly created_at: number;

    /**
     * The edit date of the space.
     */
    public readonly edited_at: number;

    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    
    constructor(data: ISpace) {
        this.client = data.client;
        this.id = data.id;
        this.name = data.name;
        this.name_acronym = data.name_acronym;
        this.icon = data.icon;
        this.owner_id = data.owner_id;
        this.afk_room_id = data.afk_room_id;
        this.afk_timeout = data.afk_timeout;
        this.verifcation_level = data.verifcation_level;
        this.roles = data.roles;
        this.rules_room_id = data.rules_room_id;
        this.description = data.description;
        this.banner = data.banner;
        this.preferred_locale = data.preferred_locale;
        this.stickers = data.stickers;
        this.emojis = data.emojis;
        this.created_at = data.created_at;
        this.edited_at = data.edited_at;
        this.rooms = new RoomManager(new Client);
        if (data.rooms) {
            data.rooms.forEach((roomData: IRoom) => {
                roomData.client = this.client;
                const room = new Room(roomData);
                this.rooms.set(room.id, room);
            });
        }
        this.members = new MemberManager(new Client);
        if (data.members) {
            data.members.forEach((membersData: ISpaceMember) => {
                const member = new Member(membersData);
                this.members.set(member.user_id, member);
            });
        }
    }
}
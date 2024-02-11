import { RoomManager } from "../managers/RoomManager";
import { MemberManager } from "../managers/MemberManager";
import { ISpace } from "../types";
/**
 * Represents a space on Strafe.
 */
export declare class Space implements ISpace {
    /**
     * The ID of the space.
     */
    readonly id: string;
    /**
     * The name of the space.
     */
    readonly name: string;
    /**
     * The acronym of the space.
     */
    readonly name_acronym: string;
    /**
     * The icon of the space.
     */
    readonly icon: string | null;
    /**
     * The owner of the space.
     */
    readonly owner_id: string;
    /**
     * The AFK room of the space.
     */
    readonly afk_room_id: string;
    /**
     * The AFK timeout of the space.
     */
    readonly afk_timeout: number;
    /**
     * The verification level of the space.
     */
    readonly verifcation_level: number;
    /**
     * The rooms of the space.
     */
    readonly rooms: RoomManager;
    /**
 * The rooms of the space.
 */
    readonly members: MemberManager;
    /**
     * The roles of the space.
     */
    readonly roles: never[];
    /**
     * The rules room of the space.
     */
    readonly rules_room_id: string;
    /**
     * The description of the space.
     */
    readonly description: string;
    /**
     * The banner of the space.
     */
    readonly banner: string;
    /**
     * The preferred locale of the space.
     */
    readonly preferred_locale: string;
    /**
     * The stickers of the space.
     */
    readonly stickers: never[];
    /**
     * The emojis of the space.
     */
    readonly emojis: never[];
    /**
     * The creation date of the space.
     */
    readonly created_at: number;
    /**
     * The edit date of the space.
     */
    readonly edited_at: number;
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    constructor(data: ISpace);
}

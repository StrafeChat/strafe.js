import { Client } from "../client/Client";
import { RoomManager } from "../managers/RoomManager";
import { MemberManager } from "../managers/MemberManager";
import { ISpace } from "../types";
/**
 * Represents a space on Strafe.
 */
export declare class Space {
    readonly client: Client;
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
    readonly nameAcronym: string;
    /**
     * The icon of the space.
     */
    readonly icon: string | null;
    /**
     * The owner of the space.
     */
    readonly ownerId: string;
    /**
     * The AFK room of the space.
     */
    readonly afkRoomId: string;
    /**
     * The AFK timeout of the space.
     */
    readonly afkTimeout: number;
    /**
     * The verification level of the space.
     */
    readonly verifcationLevel: number;
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
    readonly rulesRoomId: string;
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
    readonly preferredLocale: string;
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
    readonly createdAt: number;
    /**
     * The edit date of the space.
     */
    readonly editedAt: number;
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    constructor(data: ISpace);
}

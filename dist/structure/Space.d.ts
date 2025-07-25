import { Client } from "../client/Client";
import { ISpace } from "../types/space";
import { Room } from "./Room";
/**
 * Represents a space on Strafe.
 */
export declare class Space {
    /**
     * The client.
     */
    client: Client;
    /**
     * The space's rooms.
     */
    rooms: Room[];
    /**
     * The space's id.
     */
    readonly id: string;
    /**
     * The space's name.
     */
    readonly name: string;
    /**
     * The space's description, if any.
     */
    readonly description: string | null;
    /**
     * The space's icon, if any.
     */
    readonly icon: string | null;
    /**
     * The guild's banner, if any.
     */
    readonly banner: string | null;
    /**
     * The ID of the guild's owner.
     */
    readonly owner_id: string;
    /**
     * The space's flags.
     */
    readonly flags: number;
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     * @param client The client.
     */
    constructor(data: ISpace);
}

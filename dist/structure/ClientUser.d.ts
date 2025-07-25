import { IUser, UpdatePresenceOptions } from "../types/user";
import { User } from "./User";
/**
 * The current client user connected to Strafe.
 */
export declare class ClientUser extends User {
    /**
     * Creates a new instance of a ClientUser.
     * @param data The data for the user.
     */
    constructor(data: IUser);
    /**
     * Sets the presence of the client user.
     * @param presence The presence to set.
     */
    setPresence(data: UpdatePresenceOptions): Promise<void>;
}

import { ClientUserEditOptions, IUser, UserPresence } from "../types";
import { User } from "./User";
/**
 * The current client user connected to strafe.
 */
export declare class ClientUser extends User {
    /**
     * The email of the client user.
     */
    email: string;
    /**
     * The phone number of the client user.
     */
    locale: string;
    /**
     * Creates a new instance of a ClientUser.
     * @param data The data for the user.
     */
    constructor(data: IUser);
    /**
     * Sets the presence of the client user.
     * @param presence The presence to set.
     */
    setPresence(presence: Partial<UserPresence>): Promise<void>;
    /**
     * Edits the client user.
     * @param data The data to edit the user with.
     */
    edit(data: Partial<ClientUserEditOptions>): Promise<void>;
}

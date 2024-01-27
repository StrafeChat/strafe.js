import { ClientUserEditOptions, IUser, UserPresence } from "../types";
import { User } from "./User";
/**
 * The current client user connected to strafe.
 */
export declare class ClientUser extends User {
    email: string;
    constructor(data: IUser);
    setPresence(presence: Partial<UserPresence>): Promise<void>;
    edit(data: Partial<ClientUserEditOptions>): Promise<void>;
}

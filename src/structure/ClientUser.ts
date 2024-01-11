import { IUser } from "../types";
import { User } from "./User";

/**
 * The current client user connected to strafe.
 */
export class ClientUser extends User {

    constructor(data: IUser) {
        super(data);
    }
}
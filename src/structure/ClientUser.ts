import { OpCodes } from "../config";
import { IUser, UserPresence } from "../types";
import { User } from "./User";

/**
 * The current client user connected to strafe.
 */
export class ClientUser extends User {

    constructor(data: IUser) {
        super(data);
        this.email = data.email!;
    }

    public async setPresence(presence: Partial<UserPresence>) {
        await this.client.ws.send({ op: OpCodes.PRESENCE, data: presence });
    }
}
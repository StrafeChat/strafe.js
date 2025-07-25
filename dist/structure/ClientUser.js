"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUser = void 0;
const config_1 = require("../config");
const User_1 = require("./User");
/**
 * The current client user connected to Strafe.
 */
class ClientUser extends User_1.User {
    /**
     * Creates a new instance of a ClientUser.
     * @param data The data for the user.
     */
    constructor(data) {
        super(data);
    }
    /**
     * Sets the presence of the client user.
     * @param presence The presence to set.
     */
    async setPresence(data) {
        const payload = {
            type: config_1.OpCodes.PRESENCE,
            status: data.status,
            custom_status: data.custom_status || null
        };
        await this.client.ws.send({ data: payload });
    }
}
exports.ClientUser = ClientUser;

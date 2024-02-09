"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUser = void 0;
const config_1 = require("../config");
const User_1 = require("./User");
/**
 * The current client user connected to strafe.
 */
class ClientUser extends User_1.User {
    /**
     * The email of the client user.
     */
    email;
    /**
     * The phone number of the client user.
     */
    locale;
    /**
     * Creates a new instance of a ClientUser.
     * @param data The data for the user.
     */
    constructor(data) {
        super(data);
        this.email = data.email;
        this.phone_number = data.phone_number;
        this.locale = data.locale;
    }
    /**
     * Sets the presence of the client user.
     * @param presence The presence to set.
     */
    async setPresence(presence) {
        await this.client.ws.send({ op: config_1.OpCodes.PRESENCE, data: presence });
    }
    /**
     * Edits the client user.
     * @param data The data to edit the user with.
     */
    async edit(data) {
        const res = await fetch(`${this.client.config.equinox}/users/@me`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.client.token
            },
            //credentials: "include",
            body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (!res.ok)
            throw new Error("Failed to edit user: " + resData.message);
        this.username = resData.username || this.username;
        this.discriminator = resData.discriminator || this.discriminator;
        this.email = resData.email || this.email;
        this.locale = resData.locale || this.locale;
    }
}
exports.ClientUser = ClientUser;

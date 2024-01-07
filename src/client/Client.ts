import { ClientUser } from "../structure/ClientUser";
import { WebsocketClient } from "./WebsocketClient";

/**
 * The main hub for interacting with strafe.
 */
export class Client {

    public token: string | null = null;
    public user: ClientUser | null = null;
    public readonly ws: WebsocketClient;

    constructor() {
        this.ws = new WebsocketClient(this);
    }

    /**
     * Logs the client in, establishing a WebSocket connection to strafe.
     * @param token The bot token
     */
    public async login(token: string) {
        this.token = token;
        this.ws.connect();
    }
}
import { API } from "../config";
import { ClientUser } from "../structure/ClientUser";
import { ClientOptions } from "../types";
import { WebsocketClient } from "./WebsocketClient";

/**
 * The main hub for interacting with strafe.
 */
export class Client {

    public config = {
        equinox: API,
    };

    public token: string | null = null;
    public user: ClientUser | null = null;
    public readonly ws: WebsocketClient;

    constructor(options?: ClientOptions) {
        if (options && options.config) this.config.equinox = options.config.equinox ?? this.config.equinox;
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
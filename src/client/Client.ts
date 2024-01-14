import { EventEmitter2 } from "eventemitter2";
import { API } from "../config";
import { ClientUser } from "../structure/ClientUser";
import { ClientOptions } from "../types";
import { WebsocketClient } from "./WebsocketClient";

/**
 * The main hub for interacting with strafe.
 * @extends EventEmitter2
 * @fires ready - Emitted when the client is ready.
 * @fires error - Emitted when an error occurs.
 */
export class Client extends EventEmitter2 {

    public config = {
        equinox: API,
    };

    /**
     * The token associated with the client.
     */
    public token: string | null = null;

    /**
     * The user associated with the client.
     */
    public user: ClientUser | null = null;

    /**
     * The websocket connection associated with the client.
     */
    public readonly ws: WebsocketClient;

    /**
     * Constructs a new Client
     * @param options The options for the client.
     */
    constructor(options?: ClientOptions) {
        super();
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
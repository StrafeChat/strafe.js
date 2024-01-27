import { EventEmitter2 } from "eventemitter2";
import { ClientUser } from "../structure/ClientUser";
import { ClientOptions } from "../types";
import { WebsocketClient } from "./WebsocketClient";
/**
 * The main hub for interacting with strafe.
 * @extends EventEmitter2
 * @fires ready - Emitted when the client is ready.
 * @fires error - Emitted when an error occurs.
 */
export declare class Client extends EventEmitter2 {
    config: {
        equinox: string;
        nebula: string;
    };
    /**
     * The token associated with the client.
     */
    token: string | null;
    /**
     * The user associated with the client.
     */
    user: ClientUser | null;
    /**
     * The websocket connection associated with the client.
     */
    readonly ws: WebsocketClient;
    /**
     * Constructs a new Client
     * @param options The options for the client.
     */
    constructor(options?: ClientOptions);
    /**
     * Logs the client in, establishing a WebSocket connection to strafe.
     * @param token The bot token
     */
    login(token: string): Promise<void>;
}

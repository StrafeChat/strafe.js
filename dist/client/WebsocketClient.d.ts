import { Client } from "./Client";
export interface WebsocketClient {
    connect(): Promise<void>;
    send({ data }: {
        data: any;
    }): Promise<void>;
}
export declare function chooseClient(client: Client): WebsocketClient;
/**
 * Represents a websocket client in node environments.
 */
export declare class WebsocketNodeClient implements WebsocketClient {
    private client;
    private _ws;
    private heartbeatInterval;
    /**
     * Constructs a new WebsocketClient.
     * @param client The client associated with the websocket connection.
     */
    constructor(client: Client);
    /**
     * Establishes a websocket connection to harmony.
     */
    connect(): Promise<void>;
    /**
     * Sends a message to Harmony.
     * @param data The data of the message.
     */
    send({ data }: {
        data: any;
    }): Promise<void>;
    private identify;
    private reconnect;
    private startHeartbeat;
    private stopHeartbeat;
    private sendHeartbeat;
}
/**
 * Recursively sanitize snowflakes in the object by converting BigInt to string.
 * @param json The object to sanitize.
 */
export declare function sanitizeSnowflakes(json: any): any;

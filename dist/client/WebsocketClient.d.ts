import { OpCodes } from "../config";
import { Client } from "./Client";
/**
 * Represents a websocket client.
 */
export declare class WebsocketClient {
    private client;
    private gateway;
    private _ws;
    private heartbeatInterval;
    /**
     * Constructs a new WebsocketClient.
     * @param client The client associated with the websocket connection.
     */
    constructor(client: Client);
    /**
     * Establishes a websocket connection to stargate.
     */
    connect(): Promise<void>;
    /**
     * Sends a message to stargate.
     * @param op The opcode of the message.
     * @param data The data of the message.
     */
    send({ op, data }: {
        op: OpCodes;
        data: any;
    }): Promise<void>;
    private identify;
    private reconnect;
    private startHeartbeat;
    private stopHeartbeat;
    private sendHeartbeat;
}

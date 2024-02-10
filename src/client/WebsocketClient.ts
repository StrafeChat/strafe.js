import WebSocket from "isomorphic-ws";
import { OpCodes } from "../config";
import { ClientUser } from "../structure/ClientUser";
import { Events } from "../types";
import { Client } from "./Client";

/**
 * Represents a websocket client.
 */
export class WebsocketClient {

    private gateway: string | null = null;
    private _ws: WebSocket | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    

    /**
     * Constructs a new WebsocketClient.
     * @param client The client associated with the websocket connection.
     */
    constructor(private client: Client) { }

    /**
     * Establishes a websocket connection to stargate.
     */
    public async connect() {
        if (!this.gateway) {
            try {
                var res = await fetch(this.client.config.equinox + "/gateway");
            } catch (err) {
                this.client.emit("error", { message: "Looks like the Strafe API is down. Please try reconnecting later." })
                throw new Error(`Looks like ${this.client.config.equinox + "/gateway"} might be down!`)
            }

            const data = await res.json() as { ws: string };
            this.gateway = data.ws;
        }

        this._ws = new WebSocket(this.gateway);

        this._ws!.addEventListener("open", () => {
            this.identify();
        });

        this._ws!.addEventListener("message", (message) => {
            const { op, data, event } = JSON.parse(message.data.toString()) as { op: OpCodes, data: any, event: Events };
            switch (op) {
                case OpCodes.HELLO:
                    const { heartbeat_interval } = data;
                    this.startHeartbeat(heartbeat_interval);
                    break;
                case OpCodes.DISPATCH:
                    switch (event) {
                        case "READY":
                            this.client.user = new ClientUser({ ...data.user, client: this.client });
                            data.spaces.forEach((space: any) => {
                                this.client.spaces.set(space.id, space)
                            })
                            this.client.emit("ready", data);
                            break;
                        case "PRESENCE_UPDATE":
                            if (this.client.user?.id === data.user.id) this.client.user!.presence = data.presence;
                            this.client.emit("presenceUpdate", data);
                            break;
                        default:
                            this.client.emit("error", { message: "An unknown event has been emitted. Is strafe.js up to date?" });
                            break;
                    }
                    break;
            }
        });

        this._ws.addEventListener("close", (event) => {
            console.log(event)
            this.client.emit("error", { message: "The websocket connection has been closed. Attempting to reconnect." });
            if (event.code > 1000 && event.code != 4004) {
                setTimeout(() => {
                    this.reconnect();
                }, 5000);
            }
        })
    }

    /**
     * Sends a message to stargate.
     * @param op The opcode of the message.
     * @param data The data of the message.
     */
    public async send({ op, data }: { op: OpCodes, data: any }) {
        this._ws?.send(JSON.stringify({ op, data }));
    }

    private identify() {
        const payload = {
            op: OpCodes.IDENTIFY,
            data: {
                token: this.client.token
            }
        }

        this._ws?.send(JSON.stringify(payload));
    }

    private reconnect() {
        this.stopHeartbeat();
        this._ws = null;
        setTimeout(() => this.connect(), 5000);
    }

    private startHeartbeat(interval: number) {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, interval);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    }

    private sendHeartbeat() {
        this._ws?.send(JSON.stringify({ op: OpCodes.HEARTBEAT }));
    }
}
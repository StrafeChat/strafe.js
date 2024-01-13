import WebSocket from "isomorphic-ws";
import { OpCodes } from "../config";
import { Client } from "./Client";

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
            const res = await fetch(this.client.config.equinox + "/gateway");
            const data = await res.json() as { ws: string };
            if (!res.ok) throw new Error(`Looks like ${this.client.config.equinox + "/gateway"} might be down!`);
            this.gateway = data.ws;
        }

        this._ws = new WebSocket(this.gateway);

        console.log(this.gateway, this._ws);

        this._ws!.addEventListener("open", () => {
            this.identify();
        });

        this._ws!.addEventListener("message", (message) => {
            const { op, data, event } = JSON.parse(message.data.toString()) as { op: OpCodes, data: any, event: string };

            switch (op) {
                case OpCodes.HELLO:
                    const { heartbeat_interval } = data;
                    this.startHeartbeat(heartbeat_interval);
                    break;
                case OpCodes.DISPATCH:
                    switch (event) {
                        case "READY":
                            this.client.user = data.user;
                            this.client.emit("ready", this.client);
                            break;
                    }
                    break;
            }
        });

        this._ws.addEventListener("close", (event) => {
            setTimeout(() => {
                this.reconnect();
            }, 5000);
            console.error("CLOSED ->", event);
        })
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
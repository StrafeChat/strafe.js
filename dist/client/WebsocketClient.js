"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketClient = void 0;
const isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
const config_1 = require("../config");
const ClientUser_1 = require("../structure/ClientUser");
/**
 * Represents a websocket client.
 */
class WebsocketClient {
    client;
    gateway = null;
    _ws = null;
    heartbeatInterval = null;
    /**
     * Constructs a new WebsocketClient.
     * @param client The client associated with the websocket connection.
     */
    constructor(client) {
        this.client = client;
    }
    /**
     * Establishes a websocket connection to stargate.
     */
    async connect() {
        if (!this.gateway) {
            try {
                var res = await fetch(this.client.config.equinox + "/gateway");
            }
            catch (err) {
                this.client.emit("error", { message: "Looks like the Strafe API is down. Please try reconnecting later." });
                throw new Error(`Looks like ${this.client.config.equinox + "/gateway"} might be down!`);
            }
            const data = await res.json();
            this.gateway = data.ws;
        }
        this._ws = new isomorphic_ws_1.default(this.gateway);
        this._ws.addEventListener("open", () => {
            this.identify();
        });
        this._ws.addEventListener("message", (message) => {
            const { op, data, event } = JSON.parse(message.data.toString());
            switch (op) {
                case config_1.OpCodes.HELLO:
                    const { heartbeat_interval } = data;
                    this.startHeartbeat(heartbeat_interval);
                    break;
                case config_1.OpCodes.DISPATCH:
                    switch (event) {
                        case "READY":
                            this.client.user = new ClientUser_1.ClientUser({ ...data.user, client: this.client });
                            this.client.emit("ready", data);
                            break;
                        case "PRESENCE_UPDATE":
                            if (this.client.user?.id === data.user.id)
                                this.client.user.presence = data.presence;
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
            console.log(event);
            this.client.emit("error", { message: "The websocket connection has been closed. Attempting to reconnect." });
            if (event.code > 1000 && event.code != 4004) {
                setTimeout(() => {
                    this.reconnect();
                }, 5000);
            }
        });
    }
    /**
     * Sends a message to stargate.
     * @param op The opcode of the message.
     * @param data The data of the message.
     */
    async send({ op, data }) {
        this._ws?.send(JSON.stringify({ op, data }));
    }
    identify() {
        const payload = {
            op: config_1.OpCodes.IDENTIFY,
            data: {
                token: this.client.token
            }
        };
        this._ws?.send(JSON.stringify(payload));
    }
    reconnect() {
        this.stopHeartbeat();
        this._ws = null;
        setTimeout(() => this.connect(), 5000);
    }
    startHeartbeat(interval) {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, interval);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
    }
    sendHeartbeat() {
        this._ws?.send(JSON.stringify({ op: config_1.OpCodes.HEARTBEAT }));
    }
}
exports.WebsocketClient = WebsocketClient;

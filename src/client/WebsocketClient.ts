import WebSocket from "isomorphic-ws";
import { OpCodes } from "../config";
import { ClientUser } from "../structure/ClientUser";
import { Events, IMessage, ISpace } from "../types";
import { Client } from "./Client";
import { Space } from "../structure/Space";
import { Room } from "../structure/Room";
import { Member } from "../structure/Member";
import { Message } from "../structure/Message";

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
                this.client.emit("error", { code: 503, message: "Looks like the Strafe API is down. Please try reconnecting later." })
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
                            data.spaces.forEach((spaceData: any) => {
                                const space = new Space(spaceData);
                                if (spaceData.rooms) {
                                    spaceData.rooms.forEach((roomData: any) => {
                                        const room = new Room(roomData);
                                        room.client = this.client;
                                        space.rooms.set(room.id, room);
                                    });
                                    spaceData.members.forEach((membersData: any) => {
                                        const member = new Member(membersData);
                                        space.members.set(member.userId, member);
                                    });
                                }
                                this.client.spaces.set(space.id, space);
                            });
                            this.client.emit("ready", data);
                            break;
                            case "PRESENCE_UPDATE":
                              if (this.client.user?.id === data.user.id) this.client.user!.presence = data.presence;
                              this.client.spaces
                              .toArray()
                              .map((space: any) => {
                                let member = space.members.get(data.user.id);
                                if (!data.user.space_ids.includes(space.id)) return;
                                let oldUser = data.user;
                                let presence = data.presence;
                                let user = {...oldUser, presence};
                                space.members.set(data.user.id, {...member, user})
                              })
                            this.client.emit("presenceUpdate", data);
                            break;
                        case "MESSAGE_CREATE":
                            if (data.space_id) {
                                const space = this.client.spaces.get(data.space_id);
                                const room = space?.rooms.get(data.room_id);
                                data.createdAt = data.created_at;
                                const message = data as Message; 
                                room?.messages.set(message.id, message)
                                this.client.emit("messageCreate", data)
                            }
                        break;
                        case "TYPING_START":
                           this.client.emit("typingStart", data)
                        break;
                        default:
                            this.client.emit("error", { code: 404, message: "An unknown event has been emitted. Is strafe.js up to date?" });
                            break;
                    }
                    break;
            }
        });

        this._ws.addEventListener("close", (event) => {
          console.log(event.code)
            if (event.code == 4004) return this.client.emit("error", { code: 4004, message: "Invaild token provided." });
            this.client.emit("error", { code: 1006, message: "The websocket connection has been closed. Attempting to reconnect." });
            if (event.code > 1000 && event.code !== 4004) {
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
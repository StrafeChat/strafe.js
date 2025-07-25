"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSnowflakes = exports.WebsocketNodeClient = exports.chooseClient = void 0;
const isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
const msgpack_1 = require("@msgpack/msgpack");
const config_1 = require("../config");
const structure_1 = require("../structure");
const message_1 = require("../events/message");
const space_1 = require("../events/space");
const room_1 = require("../events/room");
const typing_1 = require("../events/typing");
function chooseClient(client) {
    if (typeof window !== "undefined") {
        return new WebsocketNodeClient(client);
        // return new WebsocketWorkerClient(client);
    }
    else {
        return new WebsocketNodeClient(client);
    }
}
exports.chooseClient = chooseClient;
/**
 * Represents a websocket client in node environments.
 */
class WebsocketNodeClient {
    client;
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
     * Establishes a websocket connection to harmony.
     */
    async connect() {
        this._ws = new isomorphic_ws_1.default(this.client.config.stargate);
        this._ws.addEventListener("open", () => {
            this.identify();
        });
        this._ws.addEventListener("message", async (message) => {
            try {
                const rawPayload = (0, msgpack_1.decode)(new Uint8Array(message.data), {
                    useBigInt64: true,
                });
                // console.log("Raw decoded payload:", rawPayload);
                const payload = {
                    op: rawPayload.Op || rawPayload.op,
                    d: rawPayload.D || rawPayload.d,
                };
                // console.log("Received event:", payload.op, payload.d);
                switch (payload.op) {
                    case config_1.OpCodes.HELLO:
                        const heartbeatInterval = payload.d?.heartbeat_interval || 45000;
                        this.startHeartbeat(heartbeatInterval);
                        break;
                    case config_1.OpCodes.READY:
                        const userData = payload.d.client_user || payload.d.user;
                        if (userData) {
                            this.client.user = new structure_1.ClientUser({
                                ...userData,
                                id: userData.ID || userData.id,
                                username: userData.Username || userData.username,
                                discriminator: userData.Discriminator || userData.discriminator,
                                displayName: userData.DisplayName ||
                                    userData.displayName ||
                                    userData.display_name,
                                email: userData.Email || userData.email,
                                avatar: userData.Avatar || userData.avatar,
                                banner: userData.Banner || userData.banner,
                                bot: userData.Bot || userData.bot,
                                system: userData.System || userData.system,
                                bio: userData.Bio || userData.bio,
                                aboutMe: userData.AboutMe || userData.aboutMe || userData.about_me,
                                createdAt: userData.CreatedAt ||
                                    userData.createdAt ||
                                    userData.created_at,
                                updatedAt: userData.UpdatedAt ||
                                    userData.updatedAt ||
                                    userData.updated_at,
                                flags: userData.Flags || userData.flags,
                                presence: userData.Presence || userData.presence,
                                client: this.client,
                            });
                            // Set bot presence to online after READY event
                            if (this.client.user) {
                                await this.client.user.setPresence({ status: "online" });
                            }
                        }
                        // Process standalone rooms first
                        payload.d.rooms?.forEach((roomData) => {
                            const room = new structure_1.Room(roomData);
                            room.client = this.client;
                            this.client.rooms.set(roomData.id, room);
                        });
                        // Process spaces and their rooms
                        payload.d.spaces?.forEach((spaceData) => {
                            spaceData.client = this.client;
                            spaceData.rooms?.forEach((roomData) => {
                                const room = new structure_1.Room(roomData);
                                room.client = this.client;
                                this.client.rooms.set(roomData.id, room);
                            });
                            const space = new structure_1.Space(spaceData);
                            this.client.spaces.set(spaceData.id, space);
                        });
                        this.client.emit("ready", payload.d);
                        break;
                    case config_1.OpCodes.HEARTBEAT_ACK:
                        // console.log("Heartbeat acknowledged");
                        break;
                    case config_1.OpCodes.DISPATCH:
                    case config_1.OpCodes.MESSAGE:
                        // Handle dispatch/message events with nested type and data structure
                        // For MESSAGE op, the structure is: payload.d.d.type and payload.d.d.data
                        // For DISPATCH op with nested MESSAGE, the structure is: payload.d.d.type and payload.d.d.data
                        // For regular DISPATCH op, the structure is: payload.d.type and payload.d.data
                        let eventType;
                        let eventData;
                        if ((payload.op === "MESSAGE" && payload.d?.op === "DISPATCH") ||
                            (payload.op === "DISPATCH" && payload.d?.op === "MESSAGE")) {
                            // Handle MESSAGE events or DISPATCH events containing MESSAGE operations
                            eventType = payload.d?.d?.type;
                            eventData = payload.d?.d?.data;
                        }
                        else {
                            // Handle regular DISPATCH events
                            eventType = payload.d?.type;
                            eventData = payload.d?.data;
                        }
                        if (!eventType) {
                            console.log(`${payload.op} event missing type:`, JSON.stringify(payload, null, 2));
                            break;
                        }
                        // console.log(`Received ${payload.op} event: ${eventType}`, eventData);
                        // Handle the specific event type using dedicated handlers
                        switch (eventType) {
                            case "MESSAGE_CREATE":
                                (0, message_1.handleMessageCreate)(this.client, eventData);
                                break;
                            case "MESSAGE_UPDATE":
                                (0, message_1.handleMessageUpdate)(this.client, eventData);
                                break;
                            case "MESSAGE_DELETE":
                                (0, message_1.handleMessageDelete)(this.client, eventData);
                                break;
                            case "SPACE_CREATE":
                                (0, space_1.handleSpaceCreate)(this.client, eventData);
                                break;
                            case "SPACE_UPDATE":
                            case "spaceUpdate":
                                (0, space_1.handleSpaceUpdate)(this.client, eventData);
                                break;
                            case "SPACE_DELETE":
                                (0, space_1.handleSpaceDelete)(this.client, eventData);
                                break;
                            case "SPACE_MEMBER_ADD":
                                (0, space_1.handleSpaceMemberAdd)(this.client, eventData);
                                break;
                            case "SPACE_MEMBER_REMOVE":
                                (0, space_1.handleSpaceMemberRemove)(this.client, eventData);
                                break;
                            case "SPACE_ROLE_CREATE":
                                (0, space_1.handleSpaceRoleCreate)(this.client, eventData);
                                break;
                            case "SPACE_ROLE_UPDATE":
                                (0, space_1.handleSpaceRoleUpdate)(this.client, eventData);
                                break;
                            case "SPACE_ROLE_DELETE":
                                (0, space_1.handleSpaceRoleDelete)(this.client, eventData);
                                break;
                            case "SPACE_MEMBER_ROLE_UPDATE":
                                (0, space_1.handleSpaceMemberRoleUpdate)(this.client, eventData);
                                break;
                            case "ROOM_CREATE":
                                (0, room_1.handleRoomCreate)(this.client, eventData);
                                break;
                            case "ROOM_UPDATE":
                                (0, room_1.handleRoomUpdate)(this.client, eventData);
                                break;
                            case "ROOM_DELETE":
                                (0, room_1.handleRoomDelete)(this.client, eventData);
                                break;
                            case "ROOM_MEMBER_ADD":
                                (0, room_1.handleRoomMemberAdd)(this.client, eventData);
                                break;
                            case "ROOM_MEMBER_REMOVE":
                                (0, room_1.handleRoomMemberRemove)(this.client, eventData);
                                break;
                            case "ROOM_POSITIONS_UPDATE":
                                (0, room_1.handleRoomPositionsUpdate)(this.client, eventData);
                                break;
                            case "ROOM_OWNERSHIP_TRANSFER":
                                (0, room_1.handleRoomOwnershipTransfer)(this.client, eventData);
                                break;
                            case "TYPING_INDICATOR":
                                (0, typing_1.handleTypingIndicator)(this.client, eventData);
                                break;
                            default:
                                console.log(`Unknown DISPATCH event type: ${eventType}`, eventData);
                                // Emit generic dispatch event for unknown types
                                this.client.emit("dispatch", {
                                    type: eventType,
                                    data: eventData,
                                });
                                break;
                        }
                        break;
                    default:
                        console.log("Unknown event type:", payload.op);
                        break;
                }
            }
            catch (error) {
                console.error("Error processing message:", error);
                console.error("Raw message data:", message.data);
            }
        });
        this._ws.addEventListener("close", (event) => {
            this.client.emit("error", {
                code: 1006,
                message: "The websocket connection has been closed. Attempting to reconnect.",
            });
            if (event.code > 1000 && event.code != 4004) {
                setTimeout(() => {
                    this.reconnect();
                }, 5000);
            }
        });
    }
    /**
     * Sends a message to Harmony.
     * @param data The data of the message.
     */
    async send({ data }) {
        this._ws?.send((0, msgpack_1.encode)(data));
    }
    identify() {
        const payload = {
            type: config_1.OpCodes.IDENTIFY,
            bot_token: this.client.token,
        };
        this._ws?.send((0, msgpack_1.encode)(payload));
    }
    reconnect() {
        this.stopHeartbeat();
        this._ws = null;
        setTimeout(() => this.connect(), 5000);
    }
    startHeartbeat(interval = 45000) {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, interval);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
    }
    sendHeartbeat() {
        const payload = {
            type: config_1.OpCodes.HEARTBEAT,
            timestamp: Date.now(),
        };
        this._ws?.send((0, msgpack_1.encode)(payload));
    }
}
exports.WebsocketNodeClient = WebsocketNodeClient;
/**
 * Recursively sanitize snowflakes in the object by converting BigInt to string.
 * @param json The object to sanitize.
 */
function sanitizeSnowflakes(json) {
    if (json == null)
        return json;
    if (typeof json === "bigint") {
        return json.toString();
    }
    if (typeof json === "object") {
        if (Array.isArray(json)) {
            return json.map(sanitizeSnowflakes);
        }
        for (const [key, value] of Object.entries(json)) {
            if (typeof value === "number" && (key.endsWith("_id") || key === "id")) {
                json[key] = BigInt(value).toString();
            }
            else if (key.endsWith("_id") && Array.isArray(value)) {
                json[key] = value.map((val) => typeof val === "number"
                    ? BigInt(val).toString()
                    : sanitizeSnowflakes(val));
            }
            else {
                json[key] = sanitizeSnowflakes(value);
            }
        }
    }
    return json;
}
exports.sanitizeSnowflakes = sanitizeSnowflakes;

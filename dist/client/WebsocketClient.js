"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketNodeClient = exports.WebsocketWorkerClient = exports.chooseClient = void 0;
const isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
const config_1 = require("../config");
const ClientUser_1 = require("../structure/ClientUser");
const Space_1 = require("../structure/Space");
const Room_1 = require("../structure/Room");
const Member_1 = require("../structure/Member");
const Message_1 = require("../structure/Message");
function chooseClient(client) {
    console.log("choosing");
    if (typeof window !== "undefined") {
        console.log("worker");
        // return new WebsocketWorkerClient(client);
        return new WebsocketNodeClient(client);
    }
    else {
        console.log("node");
        return new WebsocketNodeClient(client);
    }
}
exports.chooseClient = chooseClient;
class WebsocketWorkerClient {
    client;
    worker = null;
    constructor(client) {
        this.client = client;
    }
    // Credit: https://stackoverflow.com/questions/21913673/execute-web-worker-from-different-origin
    getWorkerUrl(url) {
        // why is it not accepting the interface??? huh
        // type 'typeof WebsocketNodeClient' is missing the following properties from type 'WebsocketClient': connect, send
        // it literally implements the interface, what the hell (╯°□°）╯︵ ┻━┻) (completion by copilot)
        // Returns a blob:// URL which points
        // to a javascript file which will call
        // importScripts with the given URL
        const content = `importScripts( "${url}" );`;
        return URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
    }
    async connect() {
        this.worker = new SharedWorker(// TODO: make it dynamic
        //this.getWorkerUrl(this.client.config.equinox.replace("/v1", "") + "/worker.js") // due to cors issues, as equinox is on a different origin, this needs to be done
        //"/js/worker.js"
        "/api/worker.js");
        this.worker.port.start();
        this.worker.port.postMessage({
            type: "connect",
            token: this.client.token,
            url: this.client.config.equinox,
        });
        this.worker.port.onmessage = (messageEvent) => {
            if (messageEvent.data.event === "message") {
                const { op, data, event } = JSON.parse(messageEvent.data.values);
                console.log(op, data, event);
                switch (op) {
                    case config_1.OpCodes.DISPATCH:
                        switch (event) {
                            case "READY":
                                this.client.user = new ClientUser_1.ClientUser({ ...data.user, client: this.client });
                                data.spaces.forEach((spaceData) => {
                                    spaceData.client = this.client;
                                    const space = new Space_1.Space(spaceData);
                                    if (spaceData.rooms) {
                                        spaceData.rooms.forEach((roomData) => {
                                            const room = new Room_1.Room(roomData);
                                            room.client = this.client;
                                            room.messages.forEach((messageData) => {
                                                const message = messageData;
                                                message.client = this.client;
                                                room.messages.set(message.id, message);
                                            });
                                            space.rooms.set(room.id, room);
                                        });
                                        spaceData.members.forEach((membersData) => {
                                            const member = new Member_1.Member(membersData);
                                            space.members.set(member.userId, member);
                                        });
                                    }
                                    this.client.spaces.set(space.id, space);
                                });
                                this.client.emit("ready", data);
                                break;
                            case "PRESENCE_UPDATE":
                                if (this.client.user?.id === data.user.id)
                                    this.client.user.presence = data.presence;
                                this.client.spaces
                                    .toArray()
                                    .map((space) => {
                                    let member = space.members.get(data.user.id);
                                    if (!data.user.space_ids.includes(space.id))
                                        return;
                                    let oldUser = data.user;
                                    let presence = data.presence;
                                    let user = { ...oldUser, presence };
                                    space.members.set(data.user.id, { ...member, user });
                                });
                                this.client.emit("presenceUpdate", data);
                                break;
                            case "MESSAGE_CREATE":
                                if (data.space_id) {
                                    const space = this.client.spaces.get(data.space_id);
                                    const room = space?.rooms.get(data.room_id);
                                    data.room = room;
                                    data.space = space;
                                    data.client = this.client;
                                    const message = new Message_1.Message(data);
                                    room?.messages.set(message.id, message);
                                    this.client.emit("messageCreate", message);
                                }
                                break;
                            case "MESSAGE_UPDATE":
                                if (data.space_id) {
                                    const space = this.client.spaces.get(data.space_id);
                                    const room = space?.rooms.get(data.room_id);
                                    data.room = room;
                                    data.space = space;
                                    data.client = this.client;
                                    const message = new Message_1.Message(data);
                                    room?.messages.set(message.id, message);
                                    this.client.emit("messageUpdate", message);
                                }
                                break;
                            case "MESSAGE_DELETE":
                                if (data.space_id) {
                                    const space = this.client.spaces.get(data.space_id);
                                    const room = space?.rooms.get(data.room_id);
                                    data.client = this.client;
                                    const message = new Message_1.Message(data);
                                    room?.messages.delete(message.id);
                                    this.client.emit("messageDelete", message);
                                }
                                break;
                            case "TYPING_START":
                                this.client.emit("typingStart", data);
                                break;
                            default:
                                this.client.emit("error", { code: 404, message: "An unknown event has been emitted. Is strafe.js up to date?" });
                                break;
                        }
                        break;
                }
                return;
            }
            this.client.emit(messageEvent.data.event, messageEvent.data.values);
        };
    }
    async send({ op, data }) {
        this.worker?.port.postMessage({ type: "send", message: { op, data } });
    }
}
exports.WebsocketWorkerClient = WebsocketWorkerClient;
/**
 * Represents a websocket client in non-browser environments.
 */
class WebsocketNodeClient {
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
                this.client.emit("error", { code: 503, message: "Looks like the Strafe API is down. Please try reconnecting later." });
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
                            data.spaces.forEach((spaceData) => {
                                spaceData.client = this.client;
                                const space = new Space_1.Space(spaceData);
                                if (spaceData.rooms) {
                                    spaceData.rooms.forEach((roomData) => {
                                        roomData.client = this.client;
                                        const room = new Room_1.Room(roomData);
                                        room.messages.forEach((messageData) => {
                                            messageData.client = this.client;
                                            const message = messageData;
                                            room.messages.set(message.id, message);
                                        });
                                        space.rooms.set(room.id, room);
                                    });
                                    spaceData.members.forEach((membersData) => {
                                        const member = new Member_1.Member(membersData);
                                        space.members.set(member.userId, member);
                                    });
                                }
                                this.client.spaces.set(space.id, space);
                            });
                            this.client.emit("ready", data);
                            break;
                        case "PRESENCE_UPDATE":
                            if (this.client.user?.id === data.user.id)
                                this.client.user.presence = data.presence;
                            this.client.spaces
                                .toArray()
                                .map((space) => {
                                let member = space.members.get(data.user.id);
                                if (!data.user.space_ids.includes(space.id))
                                    return;
                                let oldUser = data.user;
                                let presence = data.presence;
                                let user = { ...oldUser, presence };
                                space.members.set(data.user.id, { ...member, user });
                            });
                            this.client.emit("presenceUpdate", data);
                            break;
                        case "MESSAGE_CREATE":
                            if (data.space_id) {
                                const space = this.client.spaces.get(data.space_id);
                                const room = space?.rooms.get(data.room_id);
                                data.room = room;
                                data.space = space;
                                data.client = this.client;
                                const message = new Message_1.Message(data);
                                room?.messages.set(message.id, message);
                                this.client.emit("messageCreate", message);
                            }
                            break;
                        case "MESSAGE_UPDATE":
                            if (data.space_id) {
                                const space = this.client.spaces.get(data.space_id);
                                const room = space?.rooms.get(data.room_id);
                                data.createdAt = data.created_at;
                                data.room = room;
                                data.space = space;
                                data.client = this.client;
                                const message = new Message_1.Message(data);
                                room?.messages.set(message.id, message);
                                this.client.emit("messageUpdate", message);
                            }
                            break;
                        case "MESSAGE_DELETE":
                            if (data.space_id) {
                                const space = this.client.spaces.get(data.space_id);
                                const room = space?.rooms.get(data.room_id);
                                data.client = this.client;
                                const message = new Message_1.Message(data);
                                room?.messages.delete(message.id);
                                this.client.emit("messageDelete", message);
                            }
                            break;
                        case "TYPING_START":
                            this.client.emit("typingStart", data);
                            break;
                        default:
                            this.client.emit("error", { code: 404, message: "An unknown event has been emitted. Is strafe.js up to date?" });
                            break;
                    }
                    break;
            }
        });
        this._ws.addEventListener("close", (event) => {
            this.client.emit("error", { code: 1006, message: "The websocket connection has been closed. Attempting to reconnect." });
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
exports.WebsocketNodeClient = WebsocketNodeClient;

import WebSocket from "isomorphic-ws";
import { OpCodes } from "../config";
import { ClientUser } from "../structure/ClientUser";
import {
  Events,
  IFriendRequest,
  IMessage,
  IPartialFriendRequest,
  IRoomUserChange,
  ISpace,
  IUser,
} from "../types";
import { Client } from "./Client";
import { Space } from "../structure/Space";
import { Room } from "../structure/Room";
import { Member } from "../structure/Member";
import { Message } from "../structure/Message";
import { FriendRequest } from "../structure/FriendRequest";
import { User } from "../structure/User";

export interface WebsocketStrafeClient {
  connect(): Promise<void>;
  send({ op, data }: { op: OpCodes; data: any }): Promise<void>;
}

export function chooseClient(client: Client): WebsocketStrafeClient {
  console.log("choosing");
  if (typeof window !== "undefined") {
    console.log("worker");
    if (window.SharedWorker) {
      return new WebsocketWorkerClient(client);
    }
    console.log(
      "SharedWorker API is unsupported, falling back to node client."
    );
  }
  console.log("node");
  return new WebsocketNodeClient(client);
}

class WebsocketClient {
  client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  processEvent(data: any, event: Events) {
    switch (event) {
      case "READY":
        this.client.user = new ClientUser({
          ...data.user,
          client: this.client,
        });
        // console.log(data)
        // data.friend.forEach((friendsData: any) => {
        //   const member = new User(friendsData);
        //   this.client.users.set(member.userId, member);
        // })
          data.spaces.forEach((spaceData: any) => {
          spaceData.client = this.client;
          const space = new Space(spaceData);
          spaceData.members.forEach((membersData: any) => {
            const member = new Member(membersData);
            space.members.set(member.userId, member);
          });
          if (spaceData.rooms) {
            spaceData.rooms.forEach((roomData: any) => {
              roomData.space_members = space.members;
              const room = new Room(roomData);
              room.client = this.client;

              roomData.unreads.forEach((unreadData: any) => {
                const unread = unreadData;
                room.unreads.set(unread.room_id, unread);
              })

              
              roomData.mentions.forEach((unreadData: any) => {
                const unread = unreadData;
                room.mentions.set(unread.room_id, unread);
              })

              room.messages.forEach((messageData: any) => {
                const message = messageData;
                message.client = this.client;
                message.member = space.members.get(message.author.id);
                room.messages.set(message.id, message);
              });
              space.rooms.set(room.id, room);
            });
          }
          this.client.spaces.set(space.id, space);
        });
        this.client.emit("ready", data);
        break;
      case "PRESENCE_UPDATE":
        if (this.client.user?.id === data.user.id)
          this.client.user!.presence = data.presence;
        if (this.client.user?.friends.includes(data.user.id)) {
          let presence = data.presence;
          let oldUser = data.user;
          let newUser = new User({ ...oldUser, presence } as IUser);
          this.client.users.set(data.user.id, newUser);
        }
        this.client.spaces.toArray().map((space: any) => {
          let member = space.members.get(data.user.id);
          if (!member || !data.user.space_ids.includes(space.id)) return;
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
          (data as IMessage).client = this.client;
          const message = new Message(data as IMessage);
          room?.unreads.set(message.roomId, 
            {roomId: message.roomId, userId: this.client.user?.id!, messageId: message.id}
          )
          room?.messages.set(message.id, message);
          this.client.emit("messageCreate", message as Message);
        }
        break;
      case "MESSAGE_UPDATE":
        if (data.space_id) {
          const space = this.client.spaces.get(data.space_id);
          const room = space?.rooms.get(data.room_id);
          data.room = room;
          data.space = space;
          (data as IMessage).client = this.client;
          const message = new Message(data as IMessage);
          room?.messages.set(message.id, message);
          this.client.emit("messageUpdate", message as Message);
        }
        break;
      case "MESSAGE_DELETE":
        if (data.space_id) {
          const space = this.client.spaces.get(data.space_id);
          const room = space?.rooms.get(data.room_id);
          (data as IMessage).client = this.client;
          const message = new Message(data as IMessage);
          room?.messages.delete(message.id);
          this.client.emit("messageDelete", message as Message);
        }
        break;
      case "TYPING_START":
        this.client.emit("typingStart", data);
        break;
      case "FRIEND_REQUEST_CREATE":
        this.client.friendRequests.set(
          data.id,
          new FriendRequest(data, this.client)
        );

        this.client.emit("friendRequestCreate", data as IFriendRequest);
        break;
      case "FRIEND_REQUEST_ACCEPT":
        if (this.client.friendRequests.has(data.id))
          this.client.friendRequests.delete(data.id);
        this.client.user?.friends.push(data.sender_id);

        this.client.emit("friendRequestAccept", data as IPartialFriendRequest);
        break;
      case "FRIEND_REQUEST_CANCEL":
        if (this.client.friendRequests.has(data.id))
          this.client.friendRequests.delete(data.id);

        this.client.emit("friendRequestDelete", data as IPartialFriendRequest);
        break;
      case "FRIEND_REQUEST_DECLINE":
        if (this.client.friendRequests.has(data.id))
          this.client.friendRequests.delete(data.id);

        this.client.emit("friendRequestDecline", data as IPartialFriendRequest);
        break;
      case "CALL_INIT":
        console.log("call init");
        this.client.emit("callInit", data);
        break;
      case "VOICE_JOIN":
        var meta = data as IRoomUserChange;
        var space = this.client.spaces.get(meta.space_id);
        var room = space?.rooms.get(meta.room);
        room?.addParticipant(meta.user);
        this.client.emit("voiceJoin", data);
        break;
      case "VOICE_LEAVE":
        var meta = data as IRoomUserChange;
        var space = this.client.spaces.get(meta.space_id);
        var room = space?.rooms.get(meta.room);
        room?.removeParticipant(meta.user);
        this.client.emit("voiceLeave", data);
        break;
      default:
        this.client.emit("error", {
          code: 404,
          message:
            "An unknown event has been emitted. Is strafe.js up to date?",
        });
        break;
    }
  }
}

export class WebsocketWorkerClient
  extends WebsocketClient
  implements WebsocketStrafeClient
{
  private worker: SharedWorker | null = null;
  constructor(client: Client) {
    super(client);
  }

  // Credit: https://stackoverflow.com/questions/21913673/execute-web-worker-from-different-origin
  private getWorkerUrl(url: string): string {
    // why is it not accepting the interface??? huh

    // type 'typeof WebsocketNodeClient' is missing the following properties from type 'WebsocketClient': connect, send
    // it literally implements the interface, what the hell (╯°□°）╯︵ ┻━┻) (completion by copilot)

    // Returns a blob:// URL which points
    // to a javascript file which will call
    // importScripts with the given URL
    const content = `importScripts( "${url}" );`;
    return URL.createObjectURL(
      new Blob([content], { type: "text/javascript" })
    );
  }

  public async connect(): Promise<void> {
    this.worker = new SharedWorker( // TODO: make it dynamic
      //this.getWorkerUrl(this.client.config.equinox.replace("/v1", "") + "/worker.js") // due to cors issues, as equinox is on a different origin, this needs to be done
      //"/js/worker.js"
      "/api/worker.js"
    );
    this.worker.port.start();
    this.worker.port.postMessage({
      type: "connect",
      token: this.client.token,
      url: this.client.config.equinox,
    });
    this.worker.port.onmessage = async (messageEvent) => {
      if (messageEvent.data.event === "message") {
        const { op, data, event } = JSON.parse(
          messageEvent.data.values as string
        ) as { op: OpCodes; data: any; event: Events };
        if (op === OpCodes.DISPATCH) super.processEvent(data, event);
        return;
      }
      this.client.emit(messageEvent.data.event, messageEvent.data.values);
    };
  }

  public async send({ op, data }: { op: OpCodes; data: any }) {
    this.worker?.port.postMessage({ type: "send", message: { op, data } });
  }
}

/**
 * Represents a websocket client in non-browser environments.
 */
export class WebsocketNodeClient
  extends WebsocketClient
  implements WebsocketStrafeClient
{
  private gateway: string | null = null;
  private _ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Constructs a new WebsocketClient.
   * @param client The client associated with the websocket connection.
   */
  constructor(client: Client) {
    super(client);
  }

  /**
   * Establishes a websocket connection to stargate.
   */
  public async connect() {
    if (!this.gateway) {
      try {
        var res = await fetch(this.client.config.equinox + "/gateway");
      } catch (err) {
        this.client.emit("error", {
          code: 503,
          message:
            "Looks like the Strafe API is down. Please try reconnecting later.",
        });
        throw new Error(
          `Looks like ${this.client.config.equinox + "/gateway"} might be down!`
        );
      }

      const data = (await res.json()) as { ws: string };
      this.gateway = data.ws;
    }

    this._ws = new WebSocket(this.gateway);

    this._ws!.addEventListener("open", () => {
      this.identify();
    });

    this._ws!.addEventListener("message", (message: any) => {
      const { op, data, event } = JSON.parse(message.data.toString()) as {
        op: OpCodes;
        data: any;
        event: Events;
      };
      switch (op) {
        case OpCodes.HELLO:
          const { heartbeat_interval } = data;
          this.startHeartbeat(heartbeat_interval);
          break;
        case OpCodes.DISPATCH:
          super.processEvent(data, event);

          break;
      }
    });

    this._ws.addEventListener("close", (event: any) => {
      this.client.emit("error", {
        code: 1006,
        message:
          "The websocket connection has been closed. Attempting to reconnect.",
      });
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
  public async send({ op, data }: { op: OpCodes; data: any }) {
    this._ws?.send(JSON.stringify({ op, data }));
  }

  private identify() {
    const payload = {
      op: OpCodes.IDENTIFY,
      data: {
        token: this.client.token,
      },
    };

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
    }, interval) as NodeJS.Timeout;
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  private sendHeartbeat() {
    this._ws?.send(JSON.stringify({ op: OpCodes.HEARTBEAT }));
  }
}
import WebSocket from "isomorphic-ws";
import { encode, decode } from "@msgpack/msgpack";
import { OpCodes, STATUS } from "../config";
import { Events } from "../types";
import { Client } from "./Client";
import { ClientUser, Message, Room, Space, User } from "../structure";
import {
  handleMessageCreate,
  handleMessageUpdate,
  handleMessageDelete,
} from "../events/message";
import {
  handleSpaceCreate,
  handleSpaceUpdate,
  handleSpaceDelete,
  handleSpaceMemberAdd,
  handleSpaceMemberRemove,
  handleSpaceRoleCreate,
  handleSpaceRoleUpdate,
  handleSpaceRoleDelete,
  handleSpaceMemberRoleUpdate,
} from "../events/space";
import {
  handleRoomCreate,
  handleRoomUpdate,
  handleRoomDelete,
  handleRoomMemberAdd,
  handleRoomMemberRemove,
  handleRoomPositionsUpdate,
  handleRoomOwnershipTransfer,
} from "../events/room";
import {
  handleTypingIndicator,
  handleTypingStart,
  handleTypingStop,
} from "../events/typing";

export interface WebsocketClient {
  connect(): Promise<void>;
  send({ data }: { data: any }): Promise<void>;
}

export function chooseClient(client: Client): WebsocketClient {
  if (typeof window !== "undefined") {
    return new WebsocketNodeClient(client);
    // return new WebsocketWorkerClient(client);
  } else {
    return new WebsocketNodeClient(client);
  }
}

/**
 * Represents a websocket client in node environments.
 */
export class WebsocketNodeClient implements WebsocketClient {
  private _ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Constructs a new WebsocketClient.
   * @param client The client associated with the websocket connection.
   */
  constructor(private client: Client) {}

  /**
   * Establishes a websocket connection to harmony.
   */
  public async connect() {
    this._ws = new WebSocket(this.client.config.stargate);

    this._ws!.addEventListener("open", () => {
      this.identify();
    });

    this._ws!.addEventListener("message", async (message: any) => {
      try {
        const rawPayload = decode(new Uint8Array(message.data), {
          useBigInt64: true,
        });

        // console.log("Raw decoded payload:", rawPayload);

        const payload = {
          op: (rawPayload as any).Op || (rawPayload as any).op,
          d: (rawPayload as any).D || (rawPayload as any).d,
        };

        // console.log("Received event:", payload.op, payload.d);

        switch (payload.op) {
          case OpCodes.HELLO:
            const heartbeatInterval = payload.d?.heartbeat_interval || 45000;
            this.startHeartbeat(heartbeatInterval);
            break;
          case OpCodes.READY:
            const userData = payload.d.client_user || payload.d.user;
            if (userData) {
              this.client.user = new ClientUser({
                ...userData,
                id: userData.ID || userData.id,
                username: userData.Username || userData.username,
                discriminator: userData.Discriminator || userData.discriminator,
                displayName:
                  userData.DisplayName ||
                  userData.displayName ||
                  userData.display_name,
                email: userData.Email || userData.email,
                avatar: userData.Avatar || userData.avatar,
                banner: userData.Banner || userData.banner,
                bot: userData.Bot || userData.bot,
                system: userData.System || userData.system,
                bio: userData.Bio || userData.bio,
                aboutMe:
                  userData.AboutMe || userData.aboutMe || userData.about_me,
                createdAt:
                  userData.CreatedAt ||
                  userData.createdAt ||
                  userData.created_at,
                updatedAt:
                  userData.UpdatedAt ||
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
            payload.d.rooms?.forEach((roomData: any) => {
              const room = new Room(roomData);
              room.client = this.client;
              this.client.rooms.set(roomData.id, room);
            });

            // Process spaces and their rooms
            payload.d.spaces?.forEach((spaceData: any) => {
              spaceData.client = this.client;
              spaceData.rooms?.forEach((roomData: any) => {
                const room = new Room(roomData);
                room.client = this.client;
                this.client.rooms.set(roomData.id, room);
              });
              const space = new Space(spaceData);
              this.client.spaces.set(spaceData.id, space);
            });
            this.client.emit("ready", payload.d);
            break;

          case OpCodes.HEARTBEAT_ACK:
            // console.log("Heartbeat acknowledged");
            break;
          case OpCodes.DISPATCH:
          case OpCodes.MESSAGE:
            // Handle dispatch/message events with nested type and data structure
            // For MESSAGE op, the structure is: payload.d.d.type and payload.d.d.data
            // For DISPATCH op with nested MESSAGE, the structure is: payload.d.d.type and payload.d.d.data
            // For regular DISPATCH op, the structure is: payload.d.type and payload.d.data
            let eventType: string | undefined;
            let eventData: any;

            if (
              (payload.op === "MESSAGE" && payload.d?.op === "DISPATCH") ||
              (payload.op === "DISPATCH" && payload.d?.op === "MESSAGE")
            ) {
              // Handle MESSAGE events or DISPATCH events containing MESSAGE operations
              eventType = payload.d?.d?.type;
              eventData = payload.d?.d?.data;
            } else {
              // Handle regular DISPATCH events
              eventType = payload.d?.type;
              eventData = payload.d?.data;
            }

            if (!eventType) {
              console.log(
                `${payload.op} event missing type:`,
                JSON.stringify(payload, null, 2)
              );
              break;
            }

            // console.log(`Received ${payload.op} event: ${eventType}`, eventData);

            // Handle the specific event type using dedicated handlers
            switch (eventType) {
              case "MESSAGE_CREATE":
                handleMessageCreate(this.client, eventData);
                break;
              case "MESSAGE_UPDATE":
                handleMessageUpdate(this.client, eventData);
                break;
              case "MESSAGE_DELETE":
                handleMessageDelete(this.client, eventData);
                break;
              case "SPACE_CREATE":
                handleSpaceCreate(this.client, eventData);
                break;
              case "SPACE_UPDATE":
              case "spaceUpdate":
                handleSpaceUpdate(this.client, eventData);
                break;
              case "SPACE_DELETE":
                handleSpaceDelete(this.client, eventData);
                break;
              case "SPACE_MEMBER_ADD":
                handleSpaceMemberAdd(this.client, eventData);
                break;
              case "SPACE_MEMBER_REMOVE":
                handleSpaceMemberRemove(this.client, eventData);
                break;
              case "SPACE_ROLE_CREATE":
                handleSpaceRoleCreate(this.client, eventData);
                break;
              case "SPACE_ROLE_UPDATE":
                handleSpaceRoleUpdate(this.client, eventData);
                break;
              case "SPACE_ROLE_DELETE":
                handleSpaceRoleDelete(this.client, eventData);
                break;
              case "SPACE_MEMBER_ROLE_UPDATE":
                handleSpaceMemberRoleUpdate(this.client, eventData);
                break;
              case "ROOM_CREATE":
                handleRoomCreate(this.client, eventData);
                break;
              case "ROOM_UPDATE":
                handleRoomUpdate(this.client, eventData);
                break;
              case "ROOM_DELETE":
                handleRoomDelete(this.client, eventData);
                break;
              case "ROOM_MEMBER_ADD":
                handleRoomMemberAdd(this.client, eventData);
                break;
              case "ROOM_MEMBER_REMOVE":
                handleRoomMemberRemove(this.client, eventData);
                break;
              case "ROOM_POSITIONS_UPDATE":
                handleRoomPositionsUpdate(this.client, eventData);
                break;
              case "ROOM_OWNERSHIP_TRANSFER":
                handleRoomOwnershipTransfer(this.client, eventData);
                break;
              case "TYPING_INDICATOR":
                handleTypingIndicator(this.client, eventData);
                break;
              default:
                console.log(
                  `Unknown DISPATCH event type: ${eventType}`,
                  eventData
                );
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
      } catch (error) {
        console.error("Error processing message:", error);
        console.error("Raw message data:", message.data);
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
   * Sends a message to Harmony.
   * @param data The data of the message.
   */
  public async send({ data }: { data: any }) {
    this._ws?.send(encode(data));
  }

  private identify() {
    const payload = {
      type: OpCodes.IDENTIFY,
      bot_token: this.client.token,
    };

    this._ws?.send(encode(payload));
  }

  private reconnect() {
    this.stopHeartbeat();
    this._ws = null;
    setTimeout(() => this.connect(), 5000);
  }

  private startHeartbeat(interval: number = 45000) {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  private sendHeartbeat() {
    const payload = {
      type: OpCodes.HEARTBEAT,
      timestamp: Date.now(),
    };
    this._ws?.send(encode(payload));
  }
}

/**
 * Recursively sanitize snowflakes in the object by converting BigInt to string.
 * @param json The object to sanitize.
 */
export function sanitizeSnowflakes(json: any): any {
  if (json == null) return json;

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
      } else if (key.endsWith("_id") && Array.isArray(value)) {
        json[key] = value.map((val: any) =>
          typeof val === "number"
            ? BigInt(val).toString()
            : sanitizeSnowflakes(val)
        );
      } else {
        json[key] = sanitizeSnowflakes(value);
      }
    }
  }

  return json;
}

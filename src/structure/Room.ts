import { ApiError, IMessage, IRoom, RoomMessageOptions } from "../types";
import { Client } from "../client/Client";
import { MessageManager } from "../managers/MessageManager";
import { Message } from "./Message";

/**
 * Represents a space on Strafe.
 */
export class Room {
  /**
   * The ID of the room.
   */
  public readonly id: string;

  /**
   * The name of the room.
   */
  public readonly name: string | null;

  /**
   * The type of the room.
   */
  public readonly type: number;

  /**
   * The space ID of the room.
   */
  public readonly spaceId: string | null;

  /**
   * The icon of the room.
   */
  public readonly icon: string | null;

  /**
   * The owner of the space.
   */
  public readonly ownerId: string | null;

  /**
   * The topic of the room.
   */
  public readonly topic: string | null;

  /**
   * The position of the room.
   */
  public readonly position: number;

  /**
   * The position of the room.
   */
  public readonly messages: MessageManager;

  /**
   * The id of the last message sent in the room.
   */
  public readonly lastMessageId: string | null;

  /**
   * The bitrate of the voice room.
   */
  public readonly bitrate: number | null;

  /**
   * The user limit for the voice room.
   */
  public readonly userLimit: number | null;

  /**
   * The rate limit for messaging in the room.
   */
  public readonly rateLimit: number | null;

  /**
   * A list of user id's for the pm.
   */
  public readonly recipients: string[];

  /**
   * The permission overwrites of the room.
   */
  public readonly permissionOverwrites: any[];

  /**
   * The permission overwrites of the room.
   */
  public readonly parentId: string | null;

  /**
   * The client.
   */
  public client: Client;

  /**
   * The timestamp of the last timestamp.
   */
  public readonly lastPinTimestamp: string | null;

  /**
   * The region for the voice room.
   */
  public readonly rtcRegion: number | null;

  /**
   * The creation date of the space.
   */
  public readonly createdAt: number;

  /**
   * The edit date of the space.
   */
  public readonly editedAt: number;

  /**
   * Creates a new instance of a space.
   * @param data The data for the space.
   * @param client The client.
   */
  constructor(data: IRoom) {
    this.client = data.client;
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.spaceId = data.space_id;
    this.topic = data.topic;
    this.icon = data.icon;
    this.ownerId = data.owner_id;
    this.position = data.position;
    this.lastMessageId = data.last_message_id;
    this.bitrate = data.bitrate;
    this.userLimit = data.user_limit;
    this.rateLimit = data.rate_limit;
    this.recipients = data.recipients;
    this.permissionOverwrites = data.permission_overwrites;
    this.parentId = data.parent_id;
    this.lastPinTimestamp = data.last_pin_timestamp;
    this.rtcRegion = data.rtc_region;
    this.createdAt = data.created_at;
    this.editedAt = data.edited_at;
    this.messages = new MessageManager(new Client);
    if (data.messages) {
        data.messages.forEach((messageData: any) => {
            messageData.client = this.client;
            const message = new Message(messageData);
            this.messages.set(message.id, message);
        });
    }
  }

  /**
   * Sends a message in a room.
   * @param data The data to post in the room
   * @param client The client.
   */

  public async send(data: Partial<RoomMessageOptions>) {
    const res = await fetch(
      `${this.client.config.equinox}/rooms/${this.id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": this.client.token!,
        },
        body: JSON.stringify(data),
        credentials: "include",
      }
    );

    const resData = (await res.json()) as ApiError | IMessage;

    if (!res.ok)
      throw new Error(
        "Failed to send message: " + (resData as ApiError).message
      );

    const message = new Message(resData as IMessage);

    return message;
  }

  public async sendTyping() {
    const res = await fetch(
      `${this.client.config.equinox}/rooms/${this.id}/typing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": this.client.token!,
        },
        credentials: "include",
      }
    );
  
    if (!res.ok) {
      const resData = await res.json();
      throw new Error("Failed to send typing request: " + (resData as ApiError).message);
    }

    return res.status;
  }  
}

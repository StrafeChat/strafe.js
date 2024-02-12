import { ApiError, IMessage, IRoom, RoomMessageOptions } from "../types";
import { Client } from "../client/Client";
import { MessageManager } from "../managers/MessageManager";
import { Message } from "./Message";

/**
 * Represents a space on Strafe.
 */
export class Room implements IRoom {
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
  public readonly space_id: string | null;

  /**
   * The icon of the room.
   */
  public readonly icon: string | null;

  /**
   * The owner of the space.
   */
  public readonly owner_id: string | null;

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
  public readonly last_message_id: string | null;

  /**
   * The id of the last message sent in the room.
   */
  public readonly bitrate: number | null;

  /**
   * The id of the last message sent in the room.
   */
  public readonly user_limit: number | null;

  /**
   * The id of the last message sent in the room.
   */
  public readonly rate_limit: number | null;

  /**
   * The id of the last message sent in the room.
   */
  public readonly recipients: string[];

  /**
   * The permission overwrites of the room.
   */
  public readonly permission_overwrites: any[];

  /**
   * The permission overwrites of the room.
   */
  public readonly parent_id: string | null;

  /**
   * The client.
   */
  public client: Client;

  /**
   * The permission overwrites of the room.
   */
  public readonly last_pin_timestamp: string | null;

  /**
   * The permission overwrites of the room.
   */
  public readonly rtc_region: number | null;

  /**
   * The creation date of the space.
   */
  public readonly created_at: number;

  /**
   * The edit date of the space.
   */
  public readonly edited_at: number;

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
    this.space_id = data.space_id;
    this.topic = data.topic;
    this.icon = data.icon;
    this.owner_id = data.owner_id;
    this.position = data.position;
    this.last_message_id = data.last_message_id;
    this.bitrate = data.bitrate;
    this.user_limit = data.user_limit;
    this.rate_limit = data.rate_limit;
    this.recipients = data.recipients;
    this.permission_overwrites = data.permission_overwrites;
    this.parent_id = data.parent_id;
    this.last_pin_timestamp = data.last_pin_timestamp;
    this.rtc_region = data.rtc_region;
    this.created_at = data.created_at;
    this.edited_at = data.edited_at;
    this.messages = new MessageManager(new Client);
    if (data.messages) {
        data.messages.forEach((messageData: IMessage) => {
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
      `${this.client.config.equinox}/v1/rooms/${this.id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.client.token!,
        },
        body: JSON.stringify(data),
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
}

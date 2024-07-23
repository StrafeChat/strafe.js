import { ApiError, IMessage, IRoom, RoomMessageOptions, RoomCreateOptions, CreateInviteOptions, IInvite } from "../types";
import { Member } from "../structure/Member";
import { Client } from "../client/Client";
import { MessageManager } from "../managers/MessageManager";
import { Message } from "./Message";
import { VoiceConnection } from "../voice/";
import { Invite } from "./Invite";
import { RoomUnreadManager } from "../managers/RoomUnreadManager";
import { RoomUnread } from "./RoomUnread";
import { RoomMentionManager } from "../managers/RoomMentionManager";

/**
 * Represents a room on Strafe.
 */
export class Room {
  public static readonly Type = {
    CATEGORY: 0,
    TEXT: 1,
    VOICE: 2
  }

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
   * The client's unread messages in the room.
   */
  public unreads: RoomUnreadManager;
  /** 
   * THe client's unread mentions in the room
  */
  public mentions: RoomMentionManager;

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

  
  public readonly participants: Member[] | null = null;

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
    this.messages = new MessageManager(this.client);
    this.unreads = new RoomUnreadManager(this.client);
    this.mentions = new RoomMentionManager(this.client);
    if (data.messages) {
        data.messages.forEach((messageData: any) => {
            messageData.client = this.client;
            const message = new Message(messageData);
            this.messages.set(message.id, message);
        });
    }
    if (data.type === Room.Type.VOICE && data.space_members) {
      if (!data.participants) throw "Unexpected data received. Voice channel data is missing participants array."
      this.participants = data.participants.map(u => {
        return data.space_members!.get(u.id)!;
      });
    }
  }

  /**
   * Removes a certain participant from the room's participant array.
   * @param id The user id of the user to remove
   * @returns void
   */
  public removeParticipant(id: string): void {
    if (!this.participants) return; // not a voice channel
    const index = this.participants.findIndex(p => p.userId === id);
    if (index === -1) return;
    this.participants.splice(index, 1);
  }

  /**
   * Adds a certain participant to the room's participant array by converting the given id into a member object.
   * @param id The user id of the user to add
   * @returns void
   */
  public addParticipant(id: string): void {
    if (!this.participants) return; // not a voice channel
    
    const member = this.client.spaces.get(this.spaceId!)!.members.get(id);
    if (!member) return console.warn("Failed to add participant to voice channel. Member not found.");
    this.participants.push(member);
  }

  /**
   * Sends a message in a room.
   * @param data The data to post in the room
   * @param client The client.
   */

  public async send(data: RoomMessageOptions) {

    const res = await fetch(`${this.client.config.equinox}/rooms/${this.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.client.token!,
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    const resData = (await res.json()) as ApiError | IMessage;

    if (!res.ok) {
      throw new Error("Failed to send message: " + (resData as ApiError).message);
    }

    const message = new Message(resData as IMessage);

    return message;
  }

    /**
   * Start typing inside a room.
   * @param client The client.
   */

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

  /**
   * Initiates a VoiceConnection instance in this voice room.
   * @returns The voice connection object.
   */
  public join(): Promise<VoiceConnection> {
    if (this.type !== Room.Type.VOICE) throw new Error("Cannot join a non-voice room.");
    return this.client.voice.joinChannel(this.id);
  }

    /**
   * Creates an invite for the room.
   * @param data The data to create the invite with.
   * @param client The client.
   */
    public async createInvite(data: Partial<CreateInviteOptions> | null = null) {
      if (data) {
        const res = await fetch(
          `${this.client.config.equinox}/rooms/${this.id}/invites`,
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
  
    if (!res.ok) {
      const resData = await res.json();
      throw new Error("Failed to send delete request: " + (resData as ApiError).message);
    }
  
    const resData = (await res.json()) as ApiError | IInvite;
  
    if (!res.ok)
      throw new Error(
        "Failed to create invite: " + (resData as ApiError).message
      );

      console.log(resData)
  
    const invite = new Invite(resData as IInvite);
  
    return invite;
      } else {
        const res = await fetch(
          `${this.client.config.equinox}/rooms/${this.id}/invites`,
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
      throw new Error("Failed to send delete request: " + (resData as ApiError).message);
    }
  
    const resData = await res.json();
  
    if (!res.ok)
      throw new Error(
        "Failed to create invite: " + (resData as ApiError).message
      );
  
    const invite = new Invite(resData!.invite as IInvite);
  
    return invite;
      }
  }  

    /**
   * Deletes a room.
   * @param client The client.
   */

public async delete() {
  const res = await fetch(
    `${this.client.config.equinox}/rooms/${this.id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.client.token!,
      },
      credentials: "include",
    }
  );

  if (!res.ok) {
    const resData = await res.json();
    throw new Error("Failed to send delete request: " + (resData as ApiError).message);
  }

  return res.status;
  }  

  public async read() {

  if (!this.unreads.toArray()[0]) return;

  this.unreads.delete(this.id);
  
    const res = await fetch(
      `${this.client.config.equinox}/rooms/${this.id}/ack`,
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
      throw new Error("Failed to send ack request: "+ (resData as ApiError).message);
    }


    return res.status;
  }
}

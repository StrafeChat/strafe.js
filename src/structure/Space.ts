import { Client } from "../client/Client";
import { RoomManager } from "../managers/RoomManager";
import { MemberManager } from "../managers/MemberManager";
import { ApiError, IRoom, ISpace, ISpaceMember } from "../types";
import { Room } from "./Room";
import { Member } from "./Member";

/**
 * Represents a space on Strafe.
 */
export class Space {
  public readonly client: Client;

  /**
   * The ID of the space.
   */
  public readonly id: string;

  /**
   * The name of the space.
   */
  public readonly name: string;

  /**
   * The acronym of the space.
   */
  public readonly nameAcronym: string;

  /**
   * The icon of the space.
   */
  public readonly icon: string | null;

  /**
   * The owner of the space.
   */
  public readonly ownerId: string;

  /**
   * The AFK room of the space.
   */
  public readonly afkRoomId: string;

  /**
   * The AFK timeout of the space.
   */
  public readonly afkTimeout: number;

  /**
   * The verification level of the space.
   */
  public readonly verifcationLevel: number;

  /**
   * The rooms of the space.
   */
  public readonly rooms: RoomManager;

  /**
   * The rooms of the space.
   */
  public readonly members: MemberManager;

  /**
   * The roles of the space.
   */
  public readonly roles: never[];

  /**
   * The rules room of the space.
   */
  public readonly rulesRoomId: string;

  /**
   * The description of the space.
   */
  public readonly description: string;

  /**
   * The banner of the space.
   */
  public readonly banner: string;

  /**
   * The preferred locale of the space.
   */
  public readonly preferredLocale: string;

  /**
   * The stickers of the space.
   */
  public readonly stickers: never[];

  /**
   * The emojis of the space.
   */
  public readonly emojis: never[];

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
   */

  constructor(data: ISpace) {
    this.client = data.client;
    this.id = data.id;
    this.name = data.name;
    this.nameAcronym = data.name_acronym;
    this.icon = data.icon;
    this.ownerId = data.owner_id;
    this.afkRoomId = data.afk_room_id;
    this.afkTimeout = data.afk_timeout;
    this.verifcationLevel = data.verifcation_level;
    this.roles = data.roles;
    this.rulesRoomId = data.rules_room_id;
    this.description = data.description;
    this.banner = data.banner;
    this.preferredLocale = data.preferred_locale;
    this.stickers = data.stickers;
    this.emojis = data.emojis;
    this.createdAt = data.created_at;
    this.editedAt = data.edited_at;
    this.rooms = new RoomManager(this.client);
    if (data.rooms) {
      data.rooms.forEach((roomData: IRoom) => {
        roomData.client = this.client;
        const room = new Room(roomData); // TODO: prevent double room creation here and in websocketclient
        this.rooms.set(room.id, room);
      });
    }
    this.members = new MemberManager(this.client);
    if (data.members) {
      data.members.forEach((membersData: ISpaceMember) => {
        const member = new Member(membersData);
        this.members.set(member.userId, member);
      });
    }
  }

/**
   * Sends a message in a room.
   * @param data The data to post in the room
   * @param client The client.
   */

public async leave() {
  const res = await fetch(
    `${this.client.config.equinox}/users/@me/spaces/${this.id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.client.token!,
      },
      credentials: "include",
    }
  );

  const resData = (await res.json()) as ApiError;

  if (!res.ok)
    throw new Error(
      "Failed to send message: " + (resData as ApiError).message
    );

  this.client.spaces.delete(this.id);
 }
} 
import { Client } from "../client/Client";
import { ISpace } from "../types/space";
import { Room } from "./Room";

/**
 * Represents a space on Strafe.
 */
export class Space {
  /**
   * The client.
   */
  public client: Client;

  /**
   * The space's rooms.
   */
  public rooms: Room[];

  /**
   * The space's id.
   */
  public readonly id: string;

  /**
   * The space's name.
   */
  public readonly name: string;

  /**
   * The space's description, if any.
   */
  public readonly description: string | null;

  /**
   * The space's icon, if any.
   */
  public readonly icon: string | null;

  /**
   * The guild's banner, if any.
   */
  public readonly banner: string | null;

  /**
   * The ID of the guild's owner.
   */
  public readonly owner_id: string;

  /**
   * The space's flags.
   */
  public readonly flags: number;

  /**
   * Creates a new instance of a space.
   * @param data The data for the space.
   * @param client The client.
   */
  constructor(data: ISpace) {
    this.client = data.client;
    this.rooms = data.rooms;
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.icon = data.icon;
    this.banner = data.banner;
    this.owner_id = data.owner_id;
    this.flags = data.flags;
  }
}

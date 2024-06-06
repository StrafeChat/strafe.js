import { ApiError, IInvite, ISpace } from "../types";
import { Space } from "./Space";

/**
 * Represents an invite to a space on Strafe.
 */
export class Invite {
  /**
   * The code of the invite.
   */
  public readonly code: string;

  /**
   * The Space ID of the invite.
   */
  public readonly spaceId: string;

    /**
   * The Room ID of the invite.
   */
   public readonly roomId: string;

   /**
   * If the invite is a vanity link or not.
   */

   public readonly vanity: boolean;

   /**
   * The Inviter ID of the invite.
   */
   public readonly inviterId: string;

    /**
   * The member count of the server.
   */
    public readonly memberCount: number;

   /**
   * The number of uses of the invite.
   */
   public readonly uses: number;

    /**
   * The number of max uses of the invite.
   */
    public readonly maxUses: number;

  /**
   * The time the invite expires.
   */
  public readonly expiresAt: number | null;

  /**
   * The date the invite was created.
   */
  public readonly createdAt: number;

   /**
   * The space object of the invite.
   */
  public readonly space: ISpace;
  client: any;

  /**
   * Creates a new instance of a space.
   * @param data The data for the space.
   */
  constructor(data: IInvite) {
    this.code = data.code;
    this.spaceId = data.space_id;
    this.roomId = data.room_id;
    this.expiresAt = data.expires_at;
    this.createdAt = data.created_at;
    this.inviterId = data.inviter_id;
    this.memberCount = data.member_count;
    this.vanity = data.vanity;
    this.uses = data.uses;
    this.maxUses = data.max_uses;
    this.space = data.space;
  }
   
  public async accept () {
    const res = await fetch(
      `${this.client.config.equinox}/invites/${this.code}/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": this.client.token!,
        },
        credentials: "include",
      }
    );
  
    const resData = await res.json();

    if (!res.ok)
      throw new Error(
        "Failed to acecpt: " + (resData as ApiError).message
      );

    const space = new Space(resData.space as ISpace);
    this.client.spaces.set(space.id, space); 
    
    return space;
  } 

}

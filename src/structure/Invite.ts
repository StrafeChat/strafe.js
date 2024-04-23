import { IInvite, ISpace } from "../types";

/**
 * Represents a space on Strafe.
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
    this.space = data.space;
  }
}

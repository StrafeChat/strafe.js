import { ISpaceMember, IUser } from "../types";

/**
 * Represents a member of a space on Strafe.
 */
export class Member {
  /**
   * The User ID of the member.
   */
  public readonly userId: string;

  /**
   * The Space ID of the member.
   */
  public readonly spaceId: string;

  /**
   * The nickname of the member.
   */
  public readonly nick: string | null;

  /**
   * The roles of the member.
   */
  public readonly roles: string[];

  /**
   * The date the member joined the Space.
   */
  public readonly joinedAt: number;

  /**
   * See if the member is deafened or not.
   */
  public readonly deaf: boolean;

  /**
   * See if the member is muted or not.
   */
  public readonly mute: boolean;

  /**
   * The avatar of the member.
   */
  public readonly avatar: string | null;

  /**
   * The date the member was last edited.
   */
  public readonly editedAt: number;

   /**
   * The user object of the member.
   */
  public readonly user: IUser;

  /**
   * Creates a new instance of a space.
   * @param data The data for the space.
   */
  constructor(data: ISpaceMember) {
    this.userId = data.user_id;
    this.spaceId = data.space_id;
    this.nick = data.nick;
    this.roles = data.roles;
    this.joinedAt = data.joined_at;
    this.deaf = data.deaf;
    this.mute = data.mute;
    this.avatar = data.avatar;
    this.editedAt = data.edited_at;
    this.user = data.user;
  }
}

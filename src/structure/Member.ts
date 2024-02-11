import { ISpaceMember, IUser } from "../types";

/**
 * Represents a space on Strafe.
 */
export class Member implements ISpaceMember {
  /**
   * The User ID of the member.
   */
  public readonly user_id: string;

  /**
   * The Space ID of the member.
   */
  public readonly space_id: string;

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
  public readonly joined_at: number;

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
  public readonly edited_at: number;

   /**
   * The user object of the member.
   */
  public readonly user: IUser;

  /**
   * Creates a new instance of a space.
   * @param data The data for the space.
   */
  constructor(data: ISpaceMember) {
    this.user_id = data.user_id;
    this.space_id = data.space_id;
    this.nick = data.nick;
    this.roles = data.roles;
    this.joined_at = data.joined_at;
    this.deaf = data.deaf;
    this.mute = data.mute;
    this.avatar = data.avatar;
    this.edited_at = data.edited_at;
    this.user = data.user;
  }
}

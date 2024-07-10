import { Client } from "../client/Client";
import { IUser, UserPresence } from "../types";

/**
 * Represents a user on strafe.
 */
export class User {
  /**
   * The user's id.
   */
  public id: string;

  /**
   * The user's accent color.
   */
  public accentColor: number | null;

  /**
   * The user's avatar.
   */
  public avatar: string | null;

  /**
   * The user's avatar decoration.
   */
  public avatarDecoration: string | null;
  /**
   * The user's avatar decoration.
   */
  public aboutMe: string | null;

  /**
   * Whether the user is banned.
   */
  public banned: boolean;

  /**
   * The user's banner.
   */
  public banner: string | null;

  /**
   * Whether the user is a bot.
   */
  public bot: boolean;

  /**
   * The client.
   */
  public client: Client;

  /**
   * The user's creation date.
   */
  public createdAt: number;

  /**
   * The user's discriminator.
   */
  public discriminator: number;

  /**
   * The user's edit date.
   */
  public editedAt: number;

  /**
   * The user's email.
   */
  public email: string | null;

  /**
   * The user's flags.
   */
  public flags: number;

  /**
   * The user's global name.
   */
  public globalName: string;

  /**
   * The user's locale.
   */
  public locale: string | null;

  /**
   * The user's phone number.
   */
  public phoneNumber: string | null;

  /**
   * The user's premium type.
   */
  public premiumType: number;

  /**
   * The user's presence.
   */
  public presence: UserPresence;

  /**
   * The user's public flags.
   */
  public publicFlags: number;

  /**
   * Whether the user is a system user.
   */
  public system: boolean;

  /**
   * The user's username.
   */
  public username: string;

    /**
   * The user's global name or username.
   */
  public displayName: string;
  /**
   * Whether the user is verified.
   */
  public verified: boolean;

  /**
   * Creates a new instance of a User.
   * @param data The data for the user.
   * @param client The client.
   */
  constructor(data: IUser) {
    this.id = data.id;
    this.accentColor = data.accent_color;
    this.avatar = data.avatar;
    this.avatarDecoration = data.avatar_decoration;
    this.aboutMe = data.about_me;
    this.banned = data.banned;
    this.banner = data.banner;
    this.bot = data.bot;
    this.client = data.client;
    this.createdAt = data.created_at;
    this.discriminator = data.discriminator ?? 0;
    this.email = null;
    this.editedAt = data.edited_at;
    this.flags = data.flags;
    this.globalName = data.global_name;
    this.locale = data.locale;
    this.phoneNumber = null;
    this.premiumType = data.premium_type;
    this.presence = data.presence;
    this.publicFlags = data.public_flags;
    this.system = data.system;
    this.username = data.username ?? "Unkown User";
    this.displayName = data.display_name ?? data.global_name ?? this.username;
    this.verified = data.verified;
  }

  public async addFriend() {
    const res = await fetch(`${this.client.config.equinox}/users/friends/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      credentials: "include",
      body: JSON.stringify({
        username: this.username,
        discriminator: this.discriminator
      }),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error("Failed to add friend: " + resData.message);
  }
}

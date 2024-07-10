import { OpCodes } from "../config";
import { ClientUserEditOptions, IUser, UserPresence } from "../types";
import { User } from "./User";

/**
 * The current client user connected to strafe.
 */
export class ClientUser extends User {
  /**
   * The email of the client user.
   */
  public email: string;

  /**
   * The phone number of the client user.
   */
  public phoneNumber: string | null;

  /**
   * The locale of the client user.
   */
  public locale: string;

  /**
   * The user ids of the friends of the user
   */
  public friends: string[] = [];

  /**
   * Creates a new instance of a ClientUser.
   * @param data The data for the user.
   */
  constructor(data: IUser) {
    super(data);
    this.email = data.email!;
    this.phoneNumber = data.phone_number;
    this.locale = data.locale!;
    this.friends = data.friends! || [];
  }

  /**
   * Sets the presence of the client user.
   * @param presence The presence to set.
   */
  public async setPresence(presence: Partial<UserPresence>) {
    await this.client.ws.send({ op: OpCodes.PRESENCE, data: presence });
  }

  public async acceptFriendRequest(id: string): Promise<void> {
    const res = await fetch(`${this.client.config.equinox}/users/friends/${id}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      credentials: "include"
    });
    const resData = await res.json();
    if (!res.ok) throw new Error("Failed to accept friend request: " + resData.message);
  }
  /**
   * Decline the friend request from a certain user.
   * @param id The user id of the sender of the friend request.
   */
  public async declineFriendRequest(id: string): Promise<void> {
    const res = await fetch(`${this.client.config.equinox}/users/friends/${id}/decline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      credentials: "include"
    });
    const resData = await res.json();
    if (!res.ok) throw new Error("Failed to decline friend request: " + resData.message);
  }

  public async sendFriendRequest(username: string, discriminator: number): Promise<{ ok: boolean, message?: string }> {
    const res = await fetch(`${this.client.config.equinox}/users/friends/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      credentials: "include",
      body: JSON.stringify({
        username,
        discriminator
      }),
    });
    
    const resData = await res.json();
    if (!res.ok) return { ok: false, message: resData.message };

    return {
      ok: true
    }
  }
  public async cancelFriendRequest(id: string): Promise<void> {
    const res = await fetch(`${this.client.config.equinox}/users/friends/${id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      credentials: "include"
    });
    const resData = await res.json();
    if (!res.ok) throw new Error("Failed to cancel friend request: " + resData.message);
  }

  /**
   * Edits the client user.
   * @param data The data to edit the user with.
   */
  public async edit(data: Partial<ClientUserEditOptions>) {
    const res = await fetch(`${this.client.config.equinox}/users/@me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    const resData = (await res.json()) as Partial<{
      username: string;
      discriminator: number;
      email: string;
      message: string;
      locale: string;
      avatar: string;
    }>;

    if (!res.ok) throw new Error("Failed to edit user: " + resData.message);

    this.username = resData.username || this.username;
    this.discriminator = resData.discriminator || this.discriminator;
    this.email = resData.email || this.email;
    this.locale = resData.locale || this.locale;
    this.avatar = resData.avatar || this.avatar;
  }
}

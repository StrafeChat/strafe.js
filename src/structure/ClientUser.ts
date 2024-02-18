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
  public locale: string;

  /**
   * Creates a new instance of a ClientUser.
   * @param data The data for the user.
   */
  constructor(data: IUser) {
    super(data);
    this.email = data.email!;
    this.phoneNumber = data.phone_number;
    this.locale = data.locale!;
  }

  /**
   * Sets the presence of the client user.
   * @param presence The presence to set.
   */
  public async setPresence(presence: Partial<UserPresence>) {
    await this.client.ws.send({ op: OpCodes.PRESENCE, data: presence });
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
    }>;

    if (!res.ok) throw new Error("Failed to edit user: " + resData.message);

    this.username = resData.username || this.username;
    this.discriminator = resData.discriminator || this.discriminator;
    this.email = resData.email || this.email;
    this.locale = resData.locale || this.locale;
  }
}

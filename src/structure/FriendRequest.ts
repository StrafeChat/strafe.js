import { Client } from "../client/Client";
import { IFriendRequest } from "../types";

export class FriendRequest {
  
  /**
   * The user id of the sender of the friend request.
   *
   * @public
   * @type {string}
   */
  public senderId: string;
  
  /**
   * The user id of the recipient of the friend request.
   *
   * @public
   * @type {string}
   */
  public recipientId: string;
  
  /**
   * The date the friend request was created.
   *
   * @public
   * @type {Date}
   */
  public createdAt: Date;
  
  /**
   * The id of the friend request.
   *
   * @public
   * @type {string}
   */
  public id: string;

  public client: Client;

  constructor(request: IFriendRequest, client: Client) {
    this.senderId = request.sender_id;
    this.recipientId = request.recipient_id;
    this.createdAt = new Date(request.created_at);
    this.id = request.id;
    this.client = client;
  }

  public async decline(): Promise<void> {
    if (!this.client.user) throw new Error("Client user is not initialised yet.");
    if (this.client.user.id === this.senderId) throw new Error("Cannot decline a friend request you sent.");
    return this.client.user!.declineFriendRequest(this.senderId);
  }

  public async accept(): Promise<void> {
    if (!this.client.user) throw new Error("Client user is not initialised yet.");
    if (this.client.user.id === this.senderId) throw new Error("Cannot accept a friend request you sent.");
    return this.client.user!.acceptFriendRequest(this.senderId);
  }

  public async cancel(): Promise<void> {
    if (!this.client.user) throw new Error("Client user is not initialised yet.");
    if (this.client.user.id === this.recipientId) throw new Error("Cannot cancel a friend request you were sent.");
    return this.client.user!.cancelFriendRequest(this.recipientId);
  }
}
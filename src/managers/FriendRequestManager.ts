import { Client } from "../client/Client";
import { FriendRequest } from "../structure/FriendRequest";
import { IFriendRequest } from "../types";
import { CacheManager } from "./CacheManager";

export class FriendRequestManager extends CacheManager<FriendRequest> {
  public async fetchAll(): Promise<FriendRequest[]> {
    const res = await fetch(`${this.client.config.equinox}/users/friends/requests/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      },
    });
    const resData = await res.json();

    if (!res.ok) throw new Error(`${res.status} ${resData.message}`);

    return resData.requests.map((request: IFriendRequest) => {
      const r = new FriendRequest(request, this.client);
      this.set(r.id, r);
      return r;
    });
  }

  /**
   * Fetch a friend request by its id
   * @param id The id of the friend request
   */
  public async fetch(id: string): Promise<FriendRequest> {
    if (this.has(id)) return this.get(id)!;
    
    const res = await fetch(`${this.client.config.equinox}/users/friends/requests/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.client.token!,
      }
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${resData.message}`);

    const request = new FriendRequest(resData, this.client);
    return request;
  }
}
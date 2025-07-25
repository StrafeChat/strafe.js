import { Space } from "../structure";
import { ApiError, ISpace } from "../types";
import { CacheManager } from "./CacheManager";

export class SpaceCollection extends CacheManager<ISpace> {
  /**
   * Get a space from cache or fetch one if it isn't cached.
   * @param id The id of the space.
   * @returns A space or null if one is not found.
   * @throws Error is thrown if something goes wrong.
   */
  public async fetch(id: string) {
    const cached = this.get(id);
    if (cached) return cached;

    const res = await fetch(`${this.client.config.equinox}/spaces/${id}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Token": this.client.token!,
      },
    });

    const data = (await res.json()) as any | ApiError;

    if (res.status == 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

    data.client = this.client;
    const space = new Space(data);
    this.set(space.id, space);
    return space;
  }

  /**
   * Creates a new space.
   * @param name The name of the space.
   */
  public async create(name: string) {
    const res = await fetch(`${this.client.config.equinox}/spaces`, {
      method: "POST",
      headers: {
        authorization: `${this.client.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok) throw new Error((data as ApiError).message);
    return;
  }
}

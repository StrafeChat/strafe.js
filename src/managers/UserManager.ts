import { User } from "../structure/User";
import { ApiError, IUser } from "../types";
import { CacheManager } from "./CacheManager";

export class UserManager extends CacheManager<User> {

    /**
     * Get an invite from cache or fetch one if it isn't cached.
     * @param id The id of the invite
     * @returns A user or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */

    public async fetch(id: string) {
        const cached = this.get(id);
        if (cached) return cached;

        const res = await fetch(`${this.client.config.equinox}/users/${id}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });

        const data = await res.json() as IUser | ApiError;

        if (res.status == 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

        const user = new User(data as IUser);
        this.set(user.id, user);
        return user;
    }
}
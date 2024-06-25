import { Invite } from "../structure/Invite";
import { ApiError, IInvite } from "../types";
import { CacheManager } from "./CacheManager";

export class InviteManager extends CacheManager<Invite> {

    /**
     * Get a rooom from cache or fetch one if it isn't cached.
     * @param code The code of the invite
     * @returns A room or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    public async fetch(code: string) {
        const cached = this.get(code);
        if (cached) return cached;

        const res = await fetch(`${this.client.config.equinox}/invites/${code}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });

        const data = await res.json() as IInvite | ApiError;

        if (res.status == 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

        const invite = new Invite(data as IInvite);
        this.set(invite.code, invite);
        return invite;
    }
}
import { Member } from "../structure/Member";
import { ApiError, ISpaceMember } from "../types";
import { CacheManager } from "./CacheManager";

export class MemberManager extends CacheManager<Member> {

    /**
     * Get a member from cache or fetch one if it isn't cached.
     * @param id The id of the room
     * @returns A room or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    public async fetch(id: string) {
        const cached = this.get(id);
        if (cached) return cached;

        const res = await fetch(`${this.client.config.equinox}/members/${id}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });

        const data = await res.json() as ISpaceMember | ApiError;

        if (res.status == 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

        const member = new Member(data as ISpaceMember);
        this.set(member.user_id, member);
        return member;
    }
}
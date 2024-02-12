import { Message } from "../structure/Message";
import { ApiError, IMessage } from "../types";
import { CacheManager } from "./CacheManager";

export class MessageManager extends CacheManager<Message> {

    /**
     * Get a rooom from cache or fetch one if it isn't cached.
     * @param id The id of the message
     * @returns A room or null if one is not found.
     * @throws Error is thrown if something goes wrong.
     */
    public async fetch(id: string) {
        const cached = this.get(id);
        if (cached) return cached;

        const res = await fetch(`${this.client.config.equinox}/messages/${id}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${this.client.token}`
            }
        });

        const data = await res.json() as IMessage | ApiError;

        if (res.status == 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${(data as ApiError).message}`);

        const message = new Message(data as IMessage);
        this.set(message.id, message);
        return message;
    }
}
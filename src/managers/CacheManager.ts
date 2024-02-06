import { Client } from "../client/Client";

export class CacheManager<T> extends Map<string, T> {

    constructor(public client: Client) {
        super();
    }

    public get(key: string): T | undefined {
        // TODO: Implement LRU System
        return super.get(key);
    }

    public set(key: string, value: T): this {
        // TODO: Implement LRU System
        return super.set(key, value);
    }
}
import { Client } from "../client/Client";
export declare class CacheManager<T> extends Map<string, T> {
    client: Client;
    constructor(client: Client);
    get(key: string): T | undefined;
    set(key: string, value: T): this;
}

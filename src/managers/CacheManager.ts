import { Client } from "../client/Client";

/**
 * Cache Manager
 * @extends {Map<string, T>}
 */
export class CacheManager<T> extends Map<string, T> {

    /**
     * Constructs a new Cache Manager
     */
    constructor(public client: Client) {
        super();
    }

    /**
     * Get a cached object by it's key
     * @param key Key of the cached object
     * @returns {T} The cached object or undefined
     */
    public get(key: string): T | undefined {
        // TODO: Implement LRU System
        return super.get(key);
    }

    /**
     * Cache an object by a key for retrieval
     * @param key The key of the cached object
     * @param value The object to cache
     * @returns Instance of the CacheManager
     */
    public set(key: string, value: T): this {
        // TODO: Implement LRU System
        return super.set(key, value);
    }
}
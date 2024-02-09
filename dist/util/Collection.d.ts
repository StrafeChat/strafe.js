export declare class Collection<T> extends Map<string, T> {
    constructor(...args: any[]);
    /**
     * Get a cached object by it's key
     * @param key Key of the cached object
     * @returns {T} The cached object or undefined
     */
    get(key: string): T | undefined;
    /**
     * Cache an object by a key for retrieval
     * @param key The key of the cached object
     * @param value The object to cache
     * @returns Instance of the CacheManager
     */
    set(key: string, value: T): this;
}

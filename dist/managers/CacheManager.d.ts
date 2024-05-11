import { Client } from "../client/Client";
import { Collection } from "../util/Collection";
/**
 * Cache Manager
 */
export declare class CacheManager<T> {
    client: Client;
    private _cache;
    /**
     * Constructs a new Cache Manager
     */
    constructor(client: Client);
    get(id: string): T | null;
    set(id: string, data: T): void;
    delete(id: string): void;
    clear(): void;
    has(id: string): boolean;
    toArray(): T[];
    size(): number;
    values(): IterableIterator<T>;
    keys(): IterableIterator<string>;
    entries(): IterableIterator<[string, T]>;
    forEach(fn: (value: T, key: string, map: Map<string, T>) => void): void;
    map(fn: (value: T, key: string, collection: Collection<T>) => any, filterFn?: (value: T, key: string, collection: Collection<T>) => boolean, sortFn?: (a: T, b: T) => number): any[];
}

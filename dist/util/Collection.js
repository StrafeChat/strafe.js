"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
class Collection extends Map {
    constructor(...args) {
        super(...args);
    }
    /**
     * Get a cached object by it's key
     * @param key Key of the cached object
     * @returns {T} The cached object or undefined
     */
    get(key) {
        // TODO: Implement LRU System
        return super.get(key);
    }
    /**
     * Cache an object by a key for retrieval
     * @param key The key of the cached object
     * @param value The object to cache
     * @returns Instance of the CacheManager
     */
    set(key, value) {
        // TODO: Implement LRU System
        return super.set(key, value);
    }
}
exports.Collection = Collection;

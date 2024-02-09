"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const Collection_1 = require("../util/Collection");
/**
 * Cache Manager
 */
class CacheManager {
    client;
    _cache = new Collection_1.Collection();
    /**
     * Constructs a new Cache Manager
     */
    constructor(client) {
        this.client = client;
    }
    get(id) {
        return this._cache.get(id) || null;
    }
    set(id, data) {
        this._cache.set(id, data);
    }
    delete(id) {
        this._cache.delete(id);
    }
    clear() {
        this._cache.clear();
    }
    has(id) {
        return this._cache.has(id);
    }
    toArray() {
        return Array.from(this._cache);
    }
    size() {
        return this._cache.size;
    }
    values() {
        return this._cache.values();
    }
    keys() {
        return this._cache.keys();
    }
    entries() {
        return this._cache.entries();
    }
    forEach(fn) {
        this._cache.forEach(fn);
    }
}
exports.CacheManager = CacheManager;

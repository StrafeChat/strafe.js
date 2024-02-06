"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
/**
 * Cache Manager
 * @extends {Map<string, T>}
 */
var CacheManager = /** @class */ (function (_super) {
    __extends(CacheManager, _super);
    /**
     * Constructs a new Cache Manager
     */
    function CacheManager(client) {
        var _this = _super.call(this) || this;
        _this.client = client;
        return _this;
    }
    /**
     * Get a cached object by it's key
     * @param key Key of the cached object
     * @returns {T} The cached object or undefined
     */
    CacheManager.prototype.get = function (key) {
        // TODO: Implement LRU System
        return _super.prototype.get.call(this, key);
    };
    /**
     * Cache an object by a key for retrieval
     * @param key The key of the cached object
     * @param value The object to cache
     * @returns Instance of the CacheManager
     */
    CacheManager.prototype.set = function (key, value) {
        // TODO: Implement LRU System
        return _super.prototype.set.call(this, key, value);
    };
    return CacheManager;
}(Map));
exports.CacheManager = CacheManager;

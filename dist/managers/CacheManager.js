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
var CacheManager = /** @class */ (function (_super) {
    __extends(CacheManager, _super);
    function CacheManager(client) {
        var _this = _super.call(this) || this;
        _this.client = client;
        return _this;
    }
    CacheManager.prototype.get = function (key) {
        // TODO: Implement LRU System
        return _super.prototype.get.call(this, key);
    };
    CacheManager.prototype.set = function (key, value) {
        // TODO: Implement LRU System
        return _super.prototype.set.call(this, key, value);
    };
    return CacheManager;
}(Map));
exports.CacheManager = CacheManager;

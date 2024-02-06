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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
var eventemitter2_1 = require("eventemitter2");
var config_1 = require("../config");
var WebsocketClient_1 = require("./WebsocketClient");
var SpaceManager_1 = require("../managers/SpaceManager");
var Space_1 = require("../structure/Space");
/**
 * The main hub for interacting with strafe.
 * @extends EventEmitter2
 * @fires ready - Emitted when the client is ready.
 * @fires error - Emitted when an error occurs.
 */
var Client = /** @class */ (function (_super) {
    __extends(Client, _super);
    /**
     * Constructs a new Client
     * @param options The options for the client.
     */
    function Client(options) {
        var _a, _b;
        var _this = _super.call(this) || this;
        /**
         * The configuration for the client.
         */
        _this.config = {
            equinox: config_1.API,
            nebula: config_1.CDN,
        };
        /**
         * The token associated with the client.
         */
        _this.token = null;
        /**
         * The user associated with the client.
         */
        _this.user = null;
        /**
         * The spaces cached on the client.
         */
        _this.spaces = new SpaceManager_1.SpaceManager(_this);
        if (options && options.config) {
            _this.config.equinox = (_a = options.config.equinox) !== null && _a !== void 0 ? _a : _this.config.equinox;
            _this.config.nebula = (_b = options.config.nebula) !== null && _b !== void 0 ? _b : _this.config.nebula;
        }
        ;
        _this.ws = new WebsocketClient_1.WebsocketClient(_this);
        return _this;
    }
    /**
     * Attaches a listener for the specified event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    Client.prototype.on = function (event, listener, options) {
        return _super.prototype.on.call(this, event, listener, options);
    };
    /**
     * Attaches a listener for the specified event, which will be invoked only once.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    Client.prototype.once = function (event, listener, options) {
        return _super.prototype.once.call(this, event, listener, options);
    };
    /**
     * Removes the specified listener from the event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to remove.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    Client.prototype.off = function (event, listener) {
        return _super.prototype.off.call(this, event, listener);
    };
    /**
     * Removes all listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    Client.prototype.removeAllListeners = function (event) {
        return _super.prototype.removeAllListeners.call(this, event);
    };
    /**
     * Returns a copy of the array of listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns An array of listeners for the event.
     * @typeParam E - The event type.
     */
    Client.prototype.listeners = function (event) {
        return _super.prototype.listeners.call(this, event);
    };
    /**
     * Returns the number of listeners listening to the specified event.
     * @method
     * @param event - The name of the event.
     * @returns The count of listeners for the event.
     * @typeParam E - The event type.
     */
    Client.prototype.listenerCount = function (event) {
        return _super.prototype.listenerCount.call(this, event);
    };
    /**
     * Emits an event with the given arguments.
     * @method
     * @param event - The name of the event.
     * @param values - The arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     * @typeParam E - The event type.
     */
    Client.prototype.emit = function (event, values) {
        return _super.prototype.emit.call(this, event, values);
    };
    /**
     * Returns an array listing the events for which the emitter has registered listeners.
     * @method
     * @returns An array of event names.
     * @typeParam E - The event type.
     */
    Client.prototype.eventNames = function () {
        return _super.prototype.eventNames.call(this);
    };
    /**
     * Logs the client in, establishing a WebSocket connection to strafe.
     * @param token The bot token
     */
    Client.prototype.login = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.token = token;
                this.ws.connect();
                return [2 /*return*/];
            });
        });
    };
    /**
     * Creates a new space.
     * @param name The name of the space.
     * @param icon The icon of the space.
     */
    Client.prototype.createSpace = function (name, icon) {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, space;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.config.equinox, "/api/v1/spaces}"), {
                            method: "POST",
                            headers: {
                                "Authorization": "".concat(this.token),
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                name: name,
                                icon: icon
                            })
                        })];
                    case 1:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        if (!res.ok)
                            throw new Error(data.message);
                        space = new Space_1.Space(data);
                        this.spaces.set(space.id, space);
                        return [2 /*return*/, space];
                }
            });
        });
    };
    return Client;
}(eventemitter2_1.EventEmitter2));
exports.Client = Client;

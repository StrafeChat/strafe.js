"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketClient = void 0;
var isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
var config_1 = require("../config");
var ClientUser_1 = require("../structure/ClientUser");
/**
 * Represents a websocket client.
 */
var WebsocketClient = /** @class */ (function () {
    /**
     * Constructs a new WebsocketClient.
     * @param client The client associated with the websocket connection.
     */
    function WebsocketClient(client) {
        this.client = client;
        this.gateway = null;
        this._ws = null;
        this.heartbeatInterval = null;
    }
    /**
     * Establishes a websocket connection to stargate.
     */
    WebsocketClient.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_1, data;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.gateway) return [3 /*break*/, 6];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fetch(this.client.config.equinox + "/gateway")];
                    case 2:
                        res = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        this.client.emit("error", { message: "Looks like the Strafe API is down. Please try reconnecting later." });
                        throw new Error("Looks like ".concat(this.client.config.equinox + "/gateway", " might be down!"));
                    case 4: return [4 /*yield*/, res.json()];
                    case 5:
                        data = _a.sent();
                        this.gateway = data.ws;
                        _a.label = 6;
                    case 6:
                        this._ws = new isomorphic_ws_1.default(this.gateway);
                        this._ws.addEventListener("open", function () {
                            _this.identify();
                        });
                        this._ws.addEventListener("message", function (message) {
                            var _a;
                            var _b = JSON.parse(message.data.toString()), op = _b.op, data = _b.data, event = _b.event;
                            switch (op) {
                                case config_1.OpCodes.HELLO:
                                    var heartbeat_interval = data.heartbeat_interval;
                                    _this.startHeartbeat(heartbeat_interval);
                                    break;
                                case config_1.OpCodes.DISPATCH:
                                    switch (event) {
                                        case "READY":
                                            _this.client.user = new ClientUser_1.ClientUser(__assign(__assign({}, data.user), { client: _this.client }));
                                            _this.client.emit("ready", data);
                                            break;
                                        case "PRESENCE_UPDATE":
                                            if (((_a = _this.client.user) === null || _a === void 0 ? void 0 : _a.id) === data.user.id)
                                                _this.client.user.presence = data.presence;
                                            _this.client.emit("presenceUpdate", data);
                                            break;
                                        default:
                                            _this.client.emit("error", { message: "An unknown event has been emitted. Is strafe.js up to date?" });
                                            break;
                                    }
                                    break;
                            }
                        });
                        this._ws.addEventListener("close", function (event) {
                            console.log(event);
                            _this.client.emit("error", { message: "The websocket connection has been closed. Attempting to reconnect." });
                            if (event.code > 1000 && event.code != 4004) {
                                setTimeout(function () {
                                    _this.reconnect();
                                }, 5000);
                            }
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sends a message to stargate.
     * @param op The opcode of the message.
     * @param data The data of the message.
     */
    WebsocketClient.prototype.send = function (_a) {
        var _b;
        var op = _a.op, data = _a.data;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_c) {
                (_b = this._ws) === null || _b === void 0 ? void 0 : _b.send(JSON.stringify({ op: op, data: data }));
                return [2 /*return*/];
            });
        });
    };
    WebsocketClient.prototype.identify = function () {
        var _a;
        var payload = {
            op: config_1.OpCodes.IDENTIFY,
            data: {
                token: this.client.token
            }
        };
        (_a = this._ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(payload));
    };
    WebsocketClient.prototype.reconnect = function () {
        var _this = this;
        this.stopHeartbeat();
        this._ws = null;
        setTimeout(function () { return _this.connect(); }, 5000);
    };
    WebsocketClient.prototype.startHeartbeat = function (interval) {
        var _this = this;
        this.heartbeatInterval = setInterval(function () {
            _this.sendHeartbeat();
        }, interval);
    };
    WebsocketClient.prototype.stopHeartbeat = function () {
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
    };
    WebsocketClient.prototype.sendHeartbeat = function () {
        var _a;
        (_a = this._ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify({ op: config_1.OpCodes.HEARTBEAT }));
    };
    return WebsocketClient;
}());
exports.WebsocketClient = WebsocketClient;

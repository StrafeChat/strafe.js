"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpCodes = exports.CDN = exports.API = void 0;
/**
 * The default url that will be used for equinox.
 */
exports.API = "https://equinox.strafe.chat/v1";
/**
 * The default url that will be used for nebula.
 */
exports.CDN = "https://nebula.strafe.chat";
/**
 * List of opcodes used for interacting with strafe.
 */
var OpCodes;
(function (OpCodes) {
    /**
     * Op code used for receiving events from Strafe.
     */
    OpCodes[OpCodes["DISPATCH"] = 0] = "DISPATCH";
    /**
     * Op code used for sending heartbeats to Strafe.
     */
    OpCodes[OpCodes["HEARTBEAT"] = 1] = "HEARTBEAT";
    /**
     * Op code used for sending an identify payload to Strafe.
     */
    OpCodes[OpCodes["IDENTIFY"] = 2] = "IDENTIFY";
    /**
     * Op code used for updating and receiving updated presences.
     */
    OpCodes[OpCodes["PRESENCE"] = 3] = "PRESENCE";
    /**
     * Op code used for receiving the hello event from Strafe.
     */
    OpCodes[OpCodes["HELLO"] = 10] = "HELLO";
})(OpCodes || (exports.OpCodes = OpCodes = {}));

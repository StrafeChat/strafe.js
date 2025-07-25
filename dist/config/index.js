"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.OpCodes = exports.STATUS = exports.LIVEKIT = exports.STARGATE = exports.NEBULA = exports.EQUINOX = void 0;
/**
 * The default URL that will be used for the API.
 */
exports.EQUINOX = "http://localhost:4000/v1";
/**
 * The default URL that will be used for the CDN.
 */
exports.NEBULA = "http://localhost:4001";
/**
 * The default URL that will be used for the WS connection.
 */
exports.STARGATE = "ws://localhost:8080/events?format=msgpack";
/**
 * The URL for the Livekit voice server host.
 */
exports.LIVEKIT = "ws://localhost:7880";
/**
 * The default STATUS that the bot will have.
 */
exports.STATUS = "online";
/**
 * List of opcodes used for interacting with Strafe.
 */
var OpCodes;
(function (OpCodes) {
    /**
     * Op code received from Stargate.
     */
    OpCodes["HELLO"] = "HELLO";
    /**
     * Op code used for sending an identify payload to Stargate.
     */
    OpCodes["IDENTIFY"] = "IDENTIFY";
    /**
     * Op code used for sending a heartbeat to Stargate.
     */
    OpCodes["HEARTBEAT"] = "HEARTBEAT";
    /**
     * Op code used for sending a heartbeat to Stargate.
     */
    OpCodes["HEARTBEAT_ACK"] = "HEARTBEAT_ACK";
    /**
     * Op code used for sending a heartbeat to Stargate.
     */
    OpCodes["READY"] = "READY";
    /**
     * Op code used to receive a created message.
     */
    OpCodes["MESSAGE_CREATE"] = "MESSAGE_CREATE";
    /**
     * Op code used to receive a user presence update.
     */
    OpCodes["PRESENCE"] = "PRESENCE_UPDATE";
    /**
     * Op code used for general event dispatching.
     */
    OpCodes["DISPATCH"] = "DISPATCH";
    /**
     * Op code used for event messages.
     */
    OpCodes["MESSAGE"] = "MESSAGE";
})(OpCodes || (exports.OpCodes = OpCodes = {}));
/**
 * List of error codes from the API.
 */
var ErrorCodes;
(function (ErrorCodes) {
})(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.OpCodes = exports.CDN = exports.API = void 0;
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
/**
 * List of error codes from equinox.
 */
var ErrorCodes;
(function (ErrorCodes) {
    /**
     * An unknown error occured.
     */
    ErrorCodes[ErrorCodes["UNKNOWN"] = 4000] = "UNKNOWN";
    /**
     * An invalid opcode was sent.
     */
    ErrorCodes[ErrorCodes["UNKNOWN_OPCODE"] = 4001] = "UNKNOWN_OPCODE";
    /**
     * An invalid payload was sent.
     */
    ErrorCodes[ErrorCodes["DECODE_ERROR"] = 4002] = "DECODE_ERROR";
    /**
     * The user is not authenticated.
     */
    ErrorCodes[ErrorCodes["NOT_AUTHENTICATED"] = 4003] = "NOT_AUTHENTICATED";
    /**
     * The token is invalid.
     */
    ErrorCodes[ErrorCodes["INVALID_TOKEN"] = 4004] = "INVALID_TOKEN";
    /**
     * The user is already authenticated.
     */
    ErrorCodes[ErrorCodes["ALREADY_AUTHENTICATED"] = 4005] = "ALREADY_AUTHENTICATED";
    /**
     * The session has timed out.
     */
    ErrorCodes[ErrorCodes["SESSION_TIMED_OUT"] = 4006] = "SESSION_TIMED_OUT";
    /**
     * The user is being rate limited.
     */
    ErrorCodes[ErrorCodes["RATE_LIMIT"] = 4007] = "RATE_LIMIT";
    /**
     * The user has not been verified.
     */
    ErrorCodes[ErrorCodes["NOT_VERIFIED"] = 4008] = "NOT_VERIFIED";
})(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));

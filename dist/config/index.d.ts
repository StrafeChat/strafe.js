/**
 * The default url that will be used for equinox.
 */
export declare const API = "https://equinox.strafe.chat/v1";
/**
 * The default url that will be used for nebula.
 */
export declare const CDN = "https://nebula.strafe.chat";
/**
 * The default livekit server url
 */
export declare const LIVEKIT = "ws://localhost:7880";
/**
 * List of opcodes used for interacting with strafe.
 */
export declare enum OpCodes {
    /**
     * Op code used for receiving events from Strafe.
     */
    DISPATCH = 0,
    /**
     * Op code used for sending heartbeats to Strafe.
     */
    HEARTBEAT = 1,
    /**
     * Op code used for sending an identify payload to Strafe.
     */
    IDENTIFY = 2,
    /**
     * Op code used for updating and receiving updated presences.
     */
    PRESENCE = 3,
    /**
     * Op code used for receiving the hello event from Strafe.
     */
    HELLO = 10
}
/**
 * List of error codes from equinox.
 */
export declare enum ErrorCodes {
    /**
     * An unknown error occured.
     */
    UNKNOWN = 4000,
    /**
     * An invalid opcode was sent.
     */
    UNKNOWN_OPCODE = 4001,
    /**
     * An invalid payload was sent.
     */
    DECODE_ERROR = 4002,
    /**
     * The user is not authenticated.
     */
    NOT_AUTHENTICATED = 4003,
    /**
     * The token is invalid.
     */
    INVALID_TOKEN = 4004,
    /**
     * The user is already authenticated.
     */
    ALREADY_AUTHENTICATED = 4005,
    /**
     * The session has timed out.
     */
    SESSION_TIMED_OUT = 4006,
    /**
     * The user is being rate limited.
     */
    RATE_LIMIT = 4007,
    /**
     * The user has not been verified.
     */
    NOT_VERIFIED = 4008
}

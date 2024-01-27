/**
 * The default url that will be used for equinox.
 */
export declare const API = "https://equinox.strafe.chat/v1";
/**
 * The default url that will be used for nebula.
 */
export declare const CDN = "https://nebula.strafe.chat";
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

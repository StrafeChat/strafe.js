/**
 * The default url that will be used for equinox.
 */
export const API = "https://equinox.strafe.chat/v1"

/**
 * List of opcodes used for interacting with strafe.
 */
export enum OpCodes {
    /**
     * Op code used for receiving events from Strafe.
     */
    DISPATCH = 0,
    /**
     * Op code used for sending an identify payload to Strafe.
     */
    IDENTIFY = 2,

    /**
     * Op code used for receiving the hello event from Strafe.
     */
    HELLO = 10,

    /**
     * Op code used for sending heartbeats to Strafe.
     */
    HEARTBEAT = 3,
}
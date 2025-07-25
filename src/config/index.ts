/**
 * The default URL that will be used for the API.
 */
export const EQUINOX = "http://localhost:4000/v1";

/**
 * The default URL that will be used for the CDN.
 */
export const NEBULA = "http://localhost:4001";

/**
 * The default URL that will be used for the WS connection.
 */
export const STARGATE = "ws://localhost:8080/events?format=msgpack";

/**
 * The URL for the Livekit voice server host.
 */
export const LIVEKIT = "ws://localhost:7880";

/**
 * The default STATUS that the bot will have.
 */
export const STATUS = "online";

/**
 * List of opcodes used for interacting with Strafe.
 */
export enum OpCodes {
  /**
   * Op code received from Stargate.
   */
  HELLO = "HELLO",
  /**
   * Op code used for sending an identify payload to Stargate.
   */
  IDENTIFY = "IDENTIFY",

  /**
   * Op code used for sending a heartbeat to Stargate.
   */
  HEARTBEAT = "HEARTBEAT",
  /**
   * Op code used for sending a heartbeat to Stargate.
   */
  HEARTBEAT_ACK = "HEARTBEAT_ACK",
  /**
   * Op code used for sending a heartbeat to Stargate.
   */
  READY = "READY",
  /**
   * Op code used to receive a created message.
   */
  MESSAGE_CREATE = "MESSAGE_CREATE",
  /**
   * Op code used to receive a user presence update.
   */
  PRESENCE = "PRESENCE_UPDATE",
  /**
   * Op code used for general event dispatching.
   */
  DISPATCH = "DISPATCH",
  /**
   * Op code used for event messages.
   */
  MESSAGE = "MESSAGE",
}

/**
 * List of error codes from the API.
 */
export enum ErrorCodes {}

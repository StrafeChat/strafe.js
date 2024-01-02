export const API = process.env.STRAFE_API ?? "https://equinox.strafe.chat/v1"
export const GATEWAY = API + "/gateway";

export enum OpCodes {
    IDENTIFY = 0,
    HEARTBEAT = 1,
    HELLO = 2,
}
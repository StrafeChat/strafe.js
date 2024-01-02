export const API = process.env.STRAFE_API ?? "https://equinox.strafe.chat/v1"
export const GATEWAY = API + "/gateway";

export enum OpCodes {
    IDENTIFY = 0,
    HELLO = 1,
    HEARTBEAT = 2,
}
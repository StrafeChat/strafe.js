export * from "./client/Client";
export * from "./client/WebsocketClient";
export * from "./config";
export * from "./managers/CacheManager";
export * from "./managers/SpaceManager";
export * from "./structure/ClientUser";
export * from "./structure/Space";
export * from "./structure/User";
export * from "./types";
export * from "./util/Collection";
export * from "./structure/Room";
export * from "./managers/MemberManager";
export * from "./managers/MessageManager";
export * from "./managers/RoomManager";
export * from "./structure/Member";
export * from "./structure/Message";
export * from "./structure/FriendRequest";
export * from "./voice/VoiceConnection";
export * from "./managers/";
export * from "./structure/Invite";

const path = require("path");

export const workerPath = path.resolve(__filename, "./worker.js"); // TODO: fix, this doesn't work in ts/next environment (I haven't figured that out yet). It is being fixed by the postinstall script atm

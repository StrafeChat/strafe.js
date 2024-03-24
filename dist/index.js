"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerPath = void 0;
__exportStar(require("./client/Client"), exports);
__exportStar(require("./client/WebsocketClient"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./managers/CacheManager"), exports);
__exportStar(require("./managers/SpaceManager"), exports);
__exportStar(require("./structure/ClientUser"), exports);
__exportStar(require("./structure/Space"), exports);
__exportStar(require("./structure/User"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./util/Collection"), exports);
__exportStar(require("./structure/Room"), exports);
__exportStar(require("./managers/MemberManager"), exports);
__exportStar(require("./managers/MessageManager"), exports);
__exportStar(require("./managers/RoomManager"), exports);
__exportStar(require("./structure/Member"), exports);
__exportStar(require("./structure/Message"), exports);
const path = require("path");
exports.workerPath = path.resolve(__filename, "./worker.js"); // TODO: fix, this doesn't work in ts/next environment (I haven't figured that out yet). It is being fixed by the postinstall script atm

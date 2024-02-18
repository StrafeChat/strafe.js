"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Space = void 0;
const Client_1 = require("../client/Client");
const RoomManager_1 = require("../managers/RoomManager");
const MemberManager_1 = require("../managers/MemberManager");
const Room_1 = require("./Room");
const Member_1 = require("./Member");
/**
 * Represents a space on Strafe.
 */
class Space {
    client;
    /**
     * The ID of the space.
     */
    id;
    /**
     * The name of the space.
     */
    name;
    /**
     * The acronym of the space.
     */
    nameAcronym;
    /**
     * The icon of the space.
     */
    icon;
    /**
     * The owner of the space.
     */
    ownerId;
    /**
     * The AFK room of the space.
     */
    afkRoomId;
    /**
     * The AFK timeout of the space.
     */
    afkTimeout;
    /**
     * The verification level of the space.
     */
    verifcationLevel;
    /**
     * The rooms of the space.
     */
    rooms;
    /**
     * The rooms of the space.
     */
    members;
    /**
     * The roles of the space.
     */
    roles;
    /**
     * The rules room of the space.
     */
    rulesRoomId;
    /**
     * The description of the space.
     */
    description;
    /**
     * The banner of the space.
     */
    banner;
    /**
     * The preferred locale of the space.
     */
    preferredLocale;
    /**
     * The stickers of the space.
     */
    stickers;
    /**
     * The emojis of the space.
     */
    emojis;
    /**
     * The creation date of the space.
     */
    createdAt;
    /**
     * The edit date of the space.
     */
    editedAt;
    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    constructor(data) {
        this.client = data.client;
        this.id = data.id;
        this.name = data.name;
        this.nameAcronym = data.name_acronym;
        this.icon = data.icon;
        this.ownerId = data.owner_id;
        this.afkRoomId = data.afk_room_id;
        this.afkTimeout = data.afk_timeout;
        this.verifcationLevel = data.verifcation_level;
        this.roles = data.roles;
        this.rulesRoomId = data.rules_room_id;
        this.description = data.description;
        this.banner = data.banner;
        this.preferredLocale = data.preferred_locale;
        this.stickers = data.stickers;
        this.emojis = data.emojis;
        this.createdAt = data.created_at;
        this.editedAt = data.edited_at;
        this.rooms = new RoomManager_1.RoomManager(new Client_1.Client());
        if (data.rooms) {
            data.rooms.forEach((roomData) => {
                roomData.client = this.client;
                const room = new Room_1.Room(roomData);
                this.rooms.set(room.id, room);
            });
        }
        this.members = new MemberManager_1.MemberManager(new Client_1.Client());
        if (data.members) {
            data.members.forEach((membersData) => {
                const member = new Member_1.Member(membersData);
                this.members.set(member.userId, member);
            });
        }
    }
}
exports.Space = Space;

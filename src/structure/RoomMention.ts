import { IRoomMention } from "../types";

export class RoomMention {

    public readonly roomId: string;
    public readonly userId: string;
    public readonly messageIds: string[];

    constructor(data: IRoomMention) {
        this.roomId = data.room_id;
        this.userId = data.user_id;
        this.messageIds = data.message_ids;
    }
}
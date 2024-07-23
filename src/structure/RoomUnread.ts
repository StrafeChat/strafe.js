import { IRoomUnread } from "../types";

export class RoomUnread {

    public readonly roomId: string;
    public readonly userId: string;
    public readonly messageId: string;

    constructor(data: IRoomUnread) {
        this.roomId = data.room_id;
        this.userId = data.user_id;
        this.messageId = data.message_id;
    }
}
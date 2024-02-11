import { IRoom } from "../types";

/**
 * Represents a space on Strafe.
 */
export class Room implements IRoom {

    /**
     * The ID of the room.
     */
    public readonly id: string;

    /**
     * The name of the room.
     */
    public readonly name: string | null;

     /**
     * The type of the room.
     */
     public readonly type: number;

      /**
     * The space ID of the room.
     */
      public readonly space_id: string | null;

    /**
     * The icon of the room.
     */
    public readonly icon: string | null;

    /**
     * The owner of the space.
     */
    public readonly owner_id: string | null;

    /**
     * The topic of the room.
     */
    public readonly topic: string | null;

    /**
     * The position of the room.
     */
    public readonly position: number;

    /**
     * The id of the last message sent in the room.
     */
    public readonly last_message_id: string | null;

     /**
     * The id of the last message sent in the room.
     */
     public readonly bitrate: number | null;

     /**
     * The id of the last message sent in the room.
     */
     public readonly user_limit: number | null;

     /**
     * The id of the last message sent in the room.
     */
     public readonly rate_limit: number | null;

      /**
     * The id of the last message sent in the room.
     */
      public readonly recipients: string[];

    /**
     * The permission overwrites of the room.
     */
    public readonly permission_overwrites: any[];

    /**
     * The permission overwrites of the room.
     */
    public readonly parent_id: string | null;

     /**
     * The permission overwrites of the room.
     */
     public readonly last_pin_timestamp: string | null;

     /**
     * The permission overwrites of the room.
     */
     public readonly rtc_region: number | null;

    /**
     * The creation date of the space.
     */
    public readonly created_at: number;

    /**
     * The edit date of the space.
     */
    public readonly edited_at: number;

    /**
     * Creates a new instance of a space.
     * @param data The data for the space.
     */
    constructor(data: IRoom) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.space_id = data.space_id;
        this.topic = data.topic;
        this.icon = data.icon;
        this.owner_id = data.owner_id;
        this.position = data.position;
        this.last_message_id = data.last_message_id;
        this.bitrate = data.bitrate;
        this.user_limit = data.user_limit;
        this.rate_limit = data.rate_limit;
        this.recipients = data.recipients;
        this.permission_overwrites = data.permission_overwrites;
        this.parent_id = data.parent_id;
        this.last_pin_timestamp = data.last_pin_timestamp;
        this.rtc_region = data.rtc_region;
        this.created_at = data.created_at;
        this.edited_at = data.edited_at;
    }
}
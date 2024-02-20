import { Client } from "../client/Client";
import { IMessage, IUser } from "../types";

export class Message {
  public client: Client;
  public readonly id: string;
  public readonly roomId: string;
  public readonly authorId: string;
  public readonly author: IUser;
  public readonly spaceId: string | null;
  public readonly content: string | null;
  public readonly createdAt: number;
  public readonly editedAt: number | null;
  public readonly tts: boolean;
  public readonly mentionEveryone: boolean;
  public readonly mentions: string[] | null;
  public readonly mentionRoles: string[] | null;
  public readonly mentionRooms: string[] | null;
  public readonly attachments: string[] | null;
  public readonly embeds: any[] | null;
  public readonly reactions: any[] | null;
  public readonly pinned: boolean;
  public readonly webhookId: string | null;
  public readonly system: boolean;
  public readonly messageReferenceId: string | null;
  public readonly flags: number | null;
  public readonly threadId: string | null;
  public readonly stickers: string[] | null;
  public readonly nonce: number | null;

  constructor(data: IMessage) {
    this.client = data.client;
    this.id = data.id;
    this.roomId = data.room_id;
    this.authorId = data.author_id;
    this.author = data.author;
    this.spaceId = data.space_id;
    this.content = data.content;
    this.createdAt = data.created_at;
    this.editedAt = data.edited_at;
    this.tts = data.tts;
    this.mentionEveryone = data.mention_everyone;
    this.mentions = data.mentions;
    this.mentionRoles = data.mention_roles;
    this.mentionRooms = data.mention_rooms;
    this.attachments = data.attachments;
    this.embeds = data.embeds;
    this.reactions = data.reactions;
    this.pinned = data.pinned;
    this.webhookId = data.webhook_id;
    this.system = data.system;
    this.messageReferenceId = data.message_reference_id;
    this.flags = data.flags;
    this.threadId = data.thread_id;
    this.stickers = data.stickers;
    this.nonce = data.nonce;
  }
}

import { Client } from "../client/Client";
import { IMessage, IUser } from "../types";

export class Message implements IMessage {
public client: Client;
  public readonly id: string;
  public readonly room_id: string;
  public readonly author_id: string;
  public readonly author: IUser;
  public readonly space_id: string | null;
  public readonly content: string | null;
  public readonly created_at: number;
  public readonly edited_at: number | null;
  public readonly tts: boolean;
  public readonly mention_everyone: boolean;
  public readonly mentions: string[] | null;
  public readonly mention_roles: string[] | null;
  public readonly mention_rooms: string[] | null;
  public readonly attachments: string[] | null;
  public readonly embeds: any[] | null;
  public readonly reactions: any[] | null;
  public readonly pinned: boolean;
  public readonly webhook_id: string | null;
  public readonly system: boolean;
  public readonly message_reference_id: string | null;
  public readonly flags: number | null;
  public readonly thread_id: string | null;
  public readonly stickers: string[] | null;
  public readonly nonce: number | null;

  constructor(data: IMessage) {
    this.client = data.client;
    this.id = data.id;
    this.room_id = data.room_id;
    this.author_id = data.room_id;
    this.author= data.author;
    this.space_id = data.space_id;
    this.content = data.content;
    this.created_at = data.created_at;
    this.edited_at = data.edited_at;
    this.tts = data.tts;
    this.mention_everyone = data.mention_everyone;
    this.mentions = data.mentions;
    this.mention_roles = data.mention_roles;
    this.mention_rooms = data.mention_rooms;
    this.attachments = data.attachments;
    this.embeds = data.embeds;
    this.reactions = data.reactions;
    this.pinned = data.pinned;
    this.webhook_id = data.webhook_id;
    this.system = data.system;
    this.message_reference_id = data.message_reference_id;
    this.flags = data.flags;
    this.thread_id = data.thread_id;
    this.stickers = data.stickers;
    this.nonce = data.nonce;
  }
}

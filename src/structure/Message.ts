import { Client } from "../client/Client";
import { IMessage, IUser, MessageAttachment, MessageEmbed } from "../types";
import { Room } from "./Room";
import { User } from "./User";

/**
 * Represents a message on Strafe.
 */
export class Message {
  /**
   * The client.
   */
  public client: Client;

  /**
   * The room the message was sent in.
   */
  public room: Room;

  /**
   * The message's ID.
   */
  public readonly id: string;

  /**
   * The message's nonce if any.
   */
  public readonly nonce: string | null;

  /**
   * The message's room ID.
   */
  public readonly roomId: string;

  /**
   * The ID of the message author.
   */
  public readonly authorId: string;

  /**
   * The ID of the message author.
   */
  public readonly author: User;

  /**
   * The type of message it is.
   */
  public readonly type: string;

  /**
   * The content of the message, if any.
   */
  public readonly content: string | null;

  /**
   * Embed in the message, if any.
   */
  public readonly embeds: MessageEmbed[];

  /**
   * Attachments in the message, if any.
   */
  public readonly attachments: MessageAttachment[];

  /**
   * Flags in the message.
   */
  public readonly flags: number;

  /**
   * Mentions in the message.
   */
  public readonly mentions: string[];

  /**
   * When the message was last edited at.
   */
  public readonly editedAt: number | null;

  /**
   * References in the message, if any.
   */
  public readonly references: object[];

  /**
   * Creates a new instance of a message.
   * @param data The data for the message.
   * @param client The client.
   */
  constructor(data: IMessage) {
    this.client = data.client;
    this.room = data.room;
    this.id = data.id;
    this.nonce = data.nonce;
    this.roomId = data.room_id;
    this.authorId = data.author_id;
    this.author = data.author;
    this.type = data.type;
    this.content = data.content;
    this.embeds = data.embeds;
    this.attachments = data.attachments;
    this.flags = data.flags;
    this.mentions = data.mentions;
    this.editedAt = data.edited_at;
    this.references = data.references;
  }
}

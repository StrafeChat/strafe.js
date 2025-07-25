import { Client } from "../client/Client";
import { User, Room } from "../structure";

export interface MessageEmbedAuthor {
  icon_url?: string | null;
  name: string;
  url?: string | null;
}

export interface MessageEmbedField {
  align?: "left" | "center" | "right" | "inline";
  name: string;
  value: string;
}

export interface MessageEmbedFooter {
  icon_url?: string;
  text: string;
}

export interface MessageEmbed {
  author?: MessageEmbedAuthor;
  color?: number;
  description?: string;
  fields?: MessageEmbedField[];
  footer?: MessageEmbedFooter;
  hue?: number;
  image?: string;
  thumbnail?: string;
  timestamp?: string | Date;
  title?: string;
  type: "rich" | "image" | "video" | "meta";
  url?: string;
}

export interface MessageAttachment {
  alt: string;
  filename: string;
}

export interface IMessage {
  client: Client;
  room: Room;
  id: string;
  nonce: string | null;
  room_id: string;
  author_id: string;
  author: User;
  type: string;
  content: string;
  embeds: MessageEmbed[];
  attachments: MessageAttachment[];
  flags: number;
  mentions: string[];
  edited_at: number | null;
  references: object[];
}

export interface CreateMessageOptions {
  content?: string;
  embeds?: MessageEmbed[];
  attachments?: MessageAttachment[];
  nonce?: string;
  references?: object[];
}

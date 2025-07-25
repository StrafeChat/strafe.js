import { Client } from "../client/Client";
import { Space } from "../structure";
import { IMessage } from "./message";

export interface IRoom {
  client: Client;
  space: Space | null;
  id: string;
  space_id: string | null;
  type: string;
  topic: string | null;
  nsfw: boolean;
  locked: boolean;
  slowmode: number;
  last_message: IMessage | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  overwrites: [];
  parent_id: string | null;
}

export interface RoomCreateOptions {
  name: string;
  type: number;
  space_id?: string;
  parent_id?: string;
}

import { Client } from "../client/Client";

export interface IUser {
  client: Client;
  id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  banner: string | null;
  about_me: string | null;
  bio: string | null;
  bot: boolean;
  flags: number;
  email: string | null;
}

export interface UpdatePresenceOptions {
  status: "online" | "idle" | "dnd" | "offline";
  custom_status?: string;
}

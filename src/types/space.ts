import { Client } from "../client/Client";
import { Room } from "../structure/Room";

export interface ISpace {
  client: Client;
  rooms: Room[];
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  banner: string | null;
  owner_id: string;
  flags: number;
}

import { Client } from "../client/Client";
import { ClientUser } from "../structure/ClientUser";
import { Space } from "../structure/Space";
import { ReadyEvent } from "../types";

export class EventHandler {
  public static READY(client: Client, data: ReadyEvent) {
    client.user = new ClientUser({ ...data.user, client });
    for(const spaceData of data.spaces) {
        const space = new Space(spaceData);
    }
  }
}

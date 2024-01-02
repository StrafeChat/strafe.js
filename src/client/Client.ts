import { ClientUser } from "../structure/ClientUser";
import { WebsocketClient } from "./WebsocketClient";

export class Client {

    public token: string | null = null;
    public user: ClientUser | null = null;
    public readonly ws: WebsocketClient;

    constructor() {
        this.ws = new WebsocketClient(this);
    }

    public async login(token: string) {
        this.token = token;
        this.ws.connect();
    }
}
import { Client } from "../";
import { VoiceConnection } from "../voice";
import { P2PConnection } from "../voice/P2PConnection";

export class VoiceManager {
  /**
   * Signaling server url
   */
  public livekitServer: string = "ws://localhost:7880";
  /**
   * Strafe.js Client object
   */
  public client: Client;

  /**
   * Map containing all VoiceConnection instances by room id
   */
  public connections: Map<string, VoiceConnection | null> = new Map();

  constructor(client: Client, livekitServer?: string) {
    this.client = client;
    
    if (livekitServer) this.livekitServer = livekitServer;
  }

  public updateRooms(): void {

  }

  /**
   * Change the url of the Livekit server
   * @param url The websocket URL of the livekit server to use. (for example 'ws://localhost:7880')
   */
  public setServer(url: string): void {
    this.livekitServer = url;
  }

  public getRoomId(user1: string, user2: string): string {
    return [user1, user2].sort().join(":");
  }

  public callUser(userId: string): Promise<P2PConnection> {
    return new Promise(async (resolve, reject) => {
      const room = this.getRoomId(this.client.user!.id, userId);

      const res = await fetch(`${this.client.config.equinox}/portal/personal/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.client.token!,
        },
        body: JSON.stringify({ roomId: room }),
      });

      const resData = await res.json();
      if (!res.ok) return reject(resData);

      const connection = new P2PConnection({
        token: resData.token,
        roomId: room,
      }, this.client, this.livekitServer + "p2p");

      resolve(connection);
    });
  }
  public joinCall(token: string, caller: string): P2PConnection {
    return new P2PConnection({
      token,
      roomId: this.getRoomId(this.client.user!.id, caller),
    }, this.client, this.livekitServer + "p2p");
  }

  /**
   * Initiates a VoiceConnection instance in a certain room
   * @param roomId The id of the room to join
   * @returns VoiceConnection instance of that room
   */
  public joinChannel(roomId: string): Promise<VoiceConnection> {
    return new Promise((resolve, reject) => {
      const requestHeaders: HeadersInit = new Headers();
      requestHeaders.append("Content-Type", "application/json");
      requestHeaders.append("Authorization", this.client.token!);

      fetch(`${this.client.config.equinox}/portal/join`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ roomId }),
      }).then(r => r.json()).then(json => {
        const token = json.token;

        const connection = new VoiceConnection(token, this.livekitServer);
        this.connections.set(roomId, connection)
        resolve(connection);
      });
    });
  }
}

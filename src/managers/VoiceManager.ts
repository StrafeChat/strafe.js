import { Client } from "../";
import { VoiceConnection } from "../voice";

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
        console.log(connection);
        this.connections.set(roomId, connection)
        resolve(connection);
      });
    });
  }
}

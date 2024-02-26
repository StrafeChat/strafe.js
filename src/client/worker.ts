enum OpCodes {
  /**
   * Op code used for receiving events from Strafe.
   */
  DISPATCH = 0,

  /**
   * Op code used for sending heartbeats to Strafe.
   */
  HEARTBEAT = 1,

  /**
   * Op code used for sending an identify payload to Strafe.
   */
  IDENTIFY = 2,

  /**
   * Op code used for updating and receiving updated presences.
   */
  PRESENCE = 3,

  /**
   * Op code used for receiving the hello event from Strafe.
   */
  HELLO = 10,
}

interface WebsocketMessage {
  message: string;
  error: { code: number; message: string };
}

class WebsocketWorkerClient {
  public ports: MessagePort[] = [];
  private ws: WebSocket | null = null;
  private gateway: string | null = null;
  private token: string | null = null;
  private apiUrl: string | null = null;

  private heartbeatInterval: NodeJS.Timeout | null = null;

  public initiated: boolean = false;

  public readyData: any = null;

  constructor() {}

  private emit<E extends keyof WebsocketMessage>(
    event: E,
    values: WebsocketMessage[E]
  ): void {
    this.ports.forEach((port) => {
      port.postMessage({ event, values });
    });
  }

  public async connect(apiUrl: string, token: string): Promise<void> {
    this.token = token;
    this.apiUrl = apiUrl;
    this.initiated = true;
    if (!this.gateway) {
      try {
        var res = await fetch(apiUrl + "/gateway");
      } catch (err) {
        this.emit("error", {
          code: 503,
          message:
            "Looks like the Strafe API is down. Please try reconnecting later.",
        });
        throw new Error(`Looks like ${apiUrl + "/gateway"} might be down!`);
      }

      const data = (await res.json()) as { ws: string };
      this.gateway = data.ws;
    }

    console.log("starting");

    this.ws = new WebSocket(this.gateway);

    this.ws!.addEventListener("open", () => {
      console.log("connected");
      this.identify();
    });

    this.ws!.addEventListener("message", (message) => {
      console.log("message", message);
      const { op, data } = JSON.parse(message.data.toString()) as {
        op: OpCodes;
        data: any;
      };
      if (op === OpCodes.HELLO) {
        const { heartbeat_interval } = data;
        this.startHeartbeat(heartbeat_interval);
        return;
      } else if (op === OpCodes.DISPATCH) { 
        this.readyData = message.data.toString(); // TODO: improve as this is old data
      }

      this.emit("message", message.data.toString());
    });

    this.ws.addEventListener("close", (event) => {
      console.log(event);
      this.emit("error", {
        code: 1006,
        message:
          "The websocket connection has been closed. Attempting to reconnect.",
      });
      if (event.code > 1000 && event.code != 4004) {
        setTimeout(() => {
          this.reconnect();
        }, 5000);
      }
    });
  }

  public send(message: { op: OpCodes; data: any }) {
    console.log("send", message);
    this.ws?.send(JSON.stringify(message));
  }

  private reconnect() {
    this.stopHeartbeat();
    this.ws = null;
    setTimeout(() => this.connect(this.apiUrl!, this.token!), 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }
  private startHeartbeat(interval: number) {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }
  private sendHeartbeat() {
    console.log("heartbeat")
    this.ws?.send(JSON.stringify({ op: OpCodes.HEARTBEAT }));
  }

  private identify(): void {
    const paylod = {
      op: OpCodes.IDENTIFY,
      data: {
        token: this.token,
      },
    };

    console.log("identify", paylod);
    this.ws?.send(JSON.stringify(paylod));
  }

  public emitReadyEvent() {
    this.emit("message", this.readyData);
  }
}

var client: WebsocketWorkerClient | null = null;

onconnect = function (e) {
  const port = e.ports[0];
  if (!client) client = new WebsocketWorkerClient();
  client.ports.push(port);

  port.addEventListener("message", (e) => {
    const { data } = e;
    switch (data.type) {
      case "connect":
        if (client!.initiated) return client!.emitReadyEvent();
        client!.connect(data.url, data.token);
        break;
      case "send":
        client!.send(data.message);
        break;
      default:
        throw new Error("Invalid message type");
        break;
    }
  });

  port.start();
};
// Compile using `tsc worker.ts`

import { Client } from "../client/Client";
import { P2PVoiceEventEmitter } from "../types/voice";

enum OP {
  IDENTIFY = 0,
  ACK = 1,
  SETTINGS = 2,
  NEGOTIATION = 3,

  ERROR = 20,
}

// Note: Negotiation pattern based on MDN: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity

export class P2PConnection extends P2PVoiceEventEmitter {
  public roomId: string;
  private token: string;

  public client: Client;

  public polite: boolean = false;

  public pc: RTCPeerConnection | null = null;
  public makingOffer: boolean = false;
  private ignoreOffer: boolean = false;

  public ws: WebSocket;

  public rtcConfig: RTCConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  }

  constructor(roomConfig: { token: string, roomId: string }, client: Client, signalingUrl: string = "ws://localhost:3001/portal/signaling/p2p") {
    super();

    this.roomId = roomConfig.roomId;
    this.token = roomConfig.token;
    this.client = client;

    this.ws = new WebSocket(signalingUrl);
    this.setupSignaling();
  }

  setupSignaling() {
    const ws = this.ws;
    ws.onopen = () => {
      this.send(OP.IDENTIFY, {
        token: this.token,
        id: this.client.user!.id
      });
    }

    ws.onclose = (d) => {
      console.warn("closed", d, d.reason);
    }

    ws.onmessage = (message) => {
      var data;
      try {
        data = JSON.parse(message.data) as { op: OP, data: any };
      } catch (e) {
        // TODO: handle error properly
        console.error("invalid json: ", e, message);
        return;
      }

      if (!data.op) {
        // handle properly
        return console.error("invalid data: ", data);
      }

      this.parseSignal(data);
    }
  }

  parseSignal(data: { op: OP, data: any }) {
    switch (data.op) {
      case OP.SETTINGS:
        this.polite = data.data.role === "polite" ? true : false;
        this.send(OP.ACK, { id: data.data.id });

        this.emit("callStart", null);

        this.startNegotiation();
        break;
      case OP.NEGOTIATION:
        this.handleNegotiation(data.data);
        break;
      case OP.ERROR:
        this.handleError(data.data);
        break;
    }
  }

  async handleNegotiation(data: { candidate?: any, description?: any}) {
    const { description, candidate } = data;
    try {
      if (description) {
        const offerCollision = 
          description.type === "offer" &&
          (this.makingOffer || this.pc!.signalingState !== "stable");
        
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) return;

        await this.pc!.setRemoteDescription(description);
        if (description.type === "offer") {
          await this.pc!.setLocalDescription();
          this.send(OP.NEGOTIATION, { description: this.pc!.localDescription });
        }
      } else if (candidate) {
        this.pc!.addIceCandidate(candidate).catch((err) => {
          if (!this.ignoreOffer) {
            throw err;
          }
        });
      }
    } catch(e) {
      console.error(e);
    }
  }

  handleError(data: any) {
    console.error(data);
  }

  startNegotiation() {
    this.pc = new RTCPeerConnection(this.rtcConfig);

    this.pc.ontrack = ({ track, streams }) => {
      track.onunmute = () => {
        this.emit("trackAdd", { track, stream: streams[0] });
        console.log("track added");
      }
      // TODO: implement track onmute
    }
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc!.setLocalDescription();
        this.send(OP.NEGOTIATION, { description: this.pc!.localDescription });
      } catch(e) {
        console.error(e);
      } finally {
        this.makingOffer = false;
      }
    }
    this.pc.onicecandidate = ({ candidate }) => {
      this.send(OP.NEGOTIATION, { candidate });
    }
  }

  public addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.pc!.addTrack(track, stream);
  }

  send(op: OP, data: any) {
    this.ws.send(JSON.stringify({ op, data }));
  }
}
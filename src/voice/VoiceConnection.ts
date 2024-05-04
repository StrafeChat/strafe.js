import { Room } from "livekit-client";
import { EventEmitter2, OnOptions, Listener } from "eventemitter2";
import { EventMap } from "../types/voice";

export class VoiceConnection extends EventEmitter2 {
  private joinToken: string | null;
  room: Room;

  constructor(token: string, signalingUrl: string) {
    super();
    this.joinToken = token;

    const room = new Room();
    this.room = room;

    room.connect(signalingUrl, token).then(() => {
      console.log("connected");
    });
  }

  /**
   * @inheritdoc
   * @param event - Event name 
   * @param listener - Callback function evoked when event is emitted
   * @param options 
   * @returns 
   */
  public on<E extends keyof EventMap>(event: E, listener: (args: EventMap[E]) => void, options?: boolean | OnOptions | undefined): this | Listener {
    return super.on(event, listener, options);
  }

  disconnect() {
    this.room.disconnect();
  }
}
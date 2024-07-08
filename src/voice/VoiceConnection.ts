import { RemoteParticipant, Room, RoomEvent, TrackPublication, RemoteTrackPublication } from "livekit-client";
import { EventEmitter2, OnOptions, Listener, ListenerFn } from "eventemitter2";
import { EventMap } from "../types/voice";

class VoiceEventEmitter extends EventEmitter2 {
  constructor() {
    super();
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
  /**
     * Attaches a listener for the specified event, which will be invoked only once.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
  public once<E extends keyof EventMap>(event: E, listener: (args: EventMap[E]) => void, options?: true | OnOptions | undefined): this | Listener {
    return super.once(event, listener, options);
  }
  /**
     * Removes the specified listener from the event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to remove.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
  public off<E extends keyof EventMap>(event: E, listener: (args: EventMap[E]) => void): this {
    return super.off(event, listener);
  }
  /**
     * Removes all listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
  public removeAllListeners<E extends keyof EventMap>(event?: E): this {
    return super.removeAllListeners(event);
  }
  /**
     * Returns a copy of the array of listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns An array of listeners for the event.
     * @typeParam E - The event type.
     */
  public listeners<E extends keyof EventMap>(event: E): ListenerFn[] {
    return super.listeners(event);
  }
  /**
     * Emits an event with the given arguments.
     * @method
     * @param event - The name of the event.
     * @param values - The arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     * @typeParam E - The event type.
     */
  public emit<E extends keyof EventMap>(event: E, values: EventMap[E]): boolean {
    return super.emit(event, values);
  }
  /**
     * Returns an array listing the events for which the emitter has registered listeners.
     * @method
     * @returns An array of event names.
     * @typeParam E - The event type.
     */
  public eventNames<E extends keyof EventMap>(): E[] {
    return super.eventNames() as E[];
  }
}

export class VoiceConnection extends VoiceEventEmitter {
  private joinToken: string | null;
  room: Room;

  localTracks: MediaStreamTrack[] = [];

  private _isMuted = false;

  /**
   * Creates a new VoiceConnection object.
   * @param token Grant token for the room, returned by the portal endpoint
   * @param signalingUrl The websocket url of the livekit server, defaults to "ws://localhost:7880"
   */
  constructor(token: string, signalingUrl: string = "ws://localhost:7880") {
    super();
    this.joinToken = token;

    const room = new Room();
    this.room = room;

    room.connect(signalingUrl, token).then(() => {
      console.log("connected");
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    const room = this.room;

    room.on("connected", () => {
      this.emit("connected", null);
    });

    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      this.emit("trackAdd", { publication: pub, participant });
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      this.emit("userJoin", participant);
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.emit("userLeave", participant);
    });

    room.on(RoomEvent.TrackMuted, (pub, part) => {
      this.emit("trackMute", { publication: pub, participant: part });
    });
    room.on(RoomEvent.TrackUnmuted, (pub, part) => {
      this.emit("trackUnmute", { publication: pub, participant: part });
    });
  }

  // TODO: implement simulcast handling
  public publishTracks(tracks: MediaStreamTrack[]): Promise<TrackPublication[]> {
    return new Promise((res, rej) => {
      this.localTracks.push(...tracks);
      const promises = tracks.map(t => {
        return this.room.localParticipant.publishTrack(t);
      });
      Promise.all(promises).then(ps => {
        return res(ps);
      }).catch(r => {
        throw "Track publication failed: " + r;
      });
    });
  }

  public isMuted(): boolean {
    return this._isMuted;
  }
  public mute(): void {
    this.localTracks.filter(t => t.kind === "audio").forEach(t => {
      t.enabled = false;
      //this.room.localParticipant.unpublishTrack(t);
    });
    this._isMuted = true;
  }
  public unmute(): void {
    this.localTracks.filter(t => t.kind === "audio").forEach(t => {
      t.enabled = true;
      //this.room.localParticipant.publishTrack(t);
    });
    this._isMuted = false;
  }

  public disconnect(): void {
    this.room.disconnect();
  }
}

export class Participant {
  /**
   * @see {@link https://docs.livekit.io/client-sdk-js/classes/RemoteParticipant.html} for Property explanations
   */
  public audioLevel: number = 0;
  public identity: string = "nil";
  public isSpeaking: boolean = false;
  public metadata: string = "";
  public name: string = "";
  // TODO: permissions
  public audioTrackPublications: Map<string, RemoteTrackPublication> = new Map<string, RemoteTrackPublication>();
  public trackPublications: Map<string, RemoteTrackPublication> = new Map<string, RemoteTrackPublication>();
  public videoTrackPublications: Map<string, RemoteTrackPublication> = new Map<string, RemoteTrackPublication>();

  constructor(remote: RemoteParticipant) {
    
  }
}
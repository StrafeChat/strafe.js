import { RemoteParticipant, Room, RoomEvent, TrackPublication, RemoteTrackPublication } from "livekit-client";
import { VoiceEventEmitter } from "../types/voice";

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
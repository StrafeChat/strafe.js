import type { Track, Participant, TrackPublication } from "livekit-client";

export interface EventMap {
  ready: any;
  error: any;
  reconnecting: any;
  connected: any;
  disconnected: any;
  trackAdd: { publication: TrackPublication, participant: Participant },
  userJoin: Participant,
  userLeave: Participant,
  trackMute: { publication: TrackPublication, participant: Participant },
  trackUnmute: { publication: TrackPublication, participant: Participant },
}
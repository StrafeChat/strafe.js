import { Track } from "livekit-client";

export interface EventMap {
  ready: any;
  error: any;
  reconnecting: any;
  connected: any;
  disconnected: any;
  trackAdd: Track
}

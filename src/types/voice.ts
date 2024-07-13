import type { Participant, TrackPublication } from "livekit-client";
import { EventEmitter2, OnOptions, Listener, ListenerFn } from "eventemitter2";

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

export interface P2PEventMap {
  callStart: any; // fired when the other user joins
  trackAdd: { track: MediaStreamTrack, stream: MediaStream };
}

export class P2PVoiceEventEmitter extends EventEmitter2 {
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
  public on<E extends keyof P2PEventMap>(event: E, listener: (args: P2PEventMap[E]) => void, options?: boolean | OnOptions | undefined): this | Listener {
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
  public once<E extends keyof P2PEventMap>(event: E, listener: (args: P2PEventMap[E]) => void, options?: true | OnOptions | undefined): this | Listener {
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
  public off<E extends keyof P2PEventMap>(event: E, listener: (args: P2PEventMap[E]) => void): this {
    return super.off(event, listener);
  }
  /**
     * Removes all listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
  public removeAllListeners<E extends keyof P2PEventMap>(event?: E): this {
    return super.removeAllListeners(event);
  }
  /**
     * Returns a copy of the array of listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns An array of listeners for the event.
     * @typeParam E - The event type.
     */
  public listeners<E extends keyof P2PEventMap>(event: E): ListenerFn[] {
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
  public emit<E extends keyof P2PEventMap>(event: E, values: P2PEventMap[E]): boolean {
    return super.emit(event, values);
  }
  /**
     * Returns an array listing the events for which the emitter has registered listeners.
     * @method
     * @returns An array of event names.
     * @typeParam E - The event type.
     */
  public eventNames<E extends keyof P2PEventMap>(): E[] {
    return super.eventNames() as E[];
  }
}

export class VoiceEventEmitter extends EventEmitter2 {
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

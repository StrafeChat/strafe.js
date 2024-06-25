import { EventEmitter2, Listener, ListenerFn, OnOptions } from "eventemitter2";
import { ClientUser } from "../structure/ClientUser";
import { ClientOptions, EventMap } from "../types";
import { WebsocketClient } from "./WebsocketClient";
import { SpaceManager } from "../managers/SpaceManager";
import { VoiceManager } from "../managers/VoiceManager";
/**
 * The main hub for interacting with strafe.
 * @extends EventEmitter2
 * @fires ready - Emitted when the client is ready.
 * @fires error - Emitted when an error occurs.
 */
export declare class Client extends EventEmitter2 {
    /**
     * The configuration for the client.
     */
    config: {
        equinox: string;
        nebula: string;
        livekit: string;
    };
    /**
     * The token associated with the client.
     */
    token: string | null;
    /**
     * The user associated with the client.
     */
    user: ClientUser | null;
    /**
     * The spaces cached on the client.
     */
    spaces: SpaceManager;
    /**
     * The voice interface for the client.
     */
    voice: VoiceManager;
    /**
     * Attaches a listener for the specified event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    on<E extends keyof EventMap>(event: E, listener: (args: EventMap[E]) => void, options?: boolean | OnOptions | undefined): this | Listener;
    /**
     * Attaches a listener for the specified event, which will be invoked only once.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    once<E extends keyof EventMap>(event: E, listener: (args: EventMap[E]) => void, options?: true | OnOptions | undefined): this | Listener;
    /**
     * Removes the specified listener from the event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to remove.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    off<E extends keyof EventMap>(event: E, listener: (args: EventMap[E]) => void): this;
    /**
     * Removes all listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    removeAllListeners<E extends keyof EventMap>(event?: E): this;
    /**
     * Returns a copy of the array of listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns An array of listeners for the event.
     * @typeParam E - The event type.
     */
    listeners<E extends keyof EventMap>(event: E): ListenerFn[];
    /**
     * Returns the number of listeners listening to the specified event.
     * @method
     * @param event - The name of the event.
     * @returns The count of listeners for the event.
     * @typeParam E - The event type.
     */
    listenerCount<E extends keyof EventMap>(event: E): number;
    /**
     * Emits an event with the given arguments.
     * @method
     * @param event - The name of the event.
     * @param values - The arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     * @typeParam E - The event type.
     */
    emit<E extends keyof EventMap>(event: E, values: EventMap[E]): boolean;
    /**
     * Returns an array listing the events for which the emitter has registered listeners.
     * @method
     * @returns An array of event names.
     * @typeParam E - The event type.
     */
    eventNames<E extends keyof EventMap>(): E[];
    /**
     * The websocket connection associated with the client.
     */
    readonly ws: WebsocketClient;
    /**
     * Constructs a new Client
     * @param options The options for the client.
     */
    constructor(options?: ClientOptions);
    /**
     * Logs the client in, establishing a WebSocket connection to strafe.
     * @param token The bot token
     */
    login(token: string): Promise<void>;
}

import { EventEmitter2, Listener, ListenerFn, OnOptions, OnceOptions, event } from "eventemitter2";
import { API, CDN } from "../config";
import { ClientUser } from "../structure/ClientUser";
import { ApiError, ClientOptions, EventMap, ISpace } from "../types";
import { chooseClient, WebsocketClient } from "./WebsocketClient";
import { SpaceManager } from "../managers/SpaceManager";
import { Space } from "../structure/Space";

/**
 * The main hub for interacting with strafe.
 * @extends EventEmitter2
 * @fires ready - Emitted when the client is ready.
 * @fires error - Emitted when an error occurs.
 */
export class Client extends EventEmitter2 {

    /**
     * The configuration for the client.
     */
    public config = {
        equinox: API,
        nebula: CDN,
    };

    /**
     * The token associated with the client.
     */
    public token: string | null = null;

    /**
     * The user associated with the client.
     */
    public user: ClientUser | null = null;

    /**
     * The spaces cached on the client.
     */
    public spaces = new SpaceManager(this);

    /**
     * Attaches a listener for the specified event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
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
     * Returns the number of listeners listening to the specified event.
     * @method
     * @param event - The name of the event.
     * @returns The count of listeners for the event.
     * @typeParam E - The event type.
     */
    public listenerCount<E extends keyof EventMap>(event: E): number {
        return super.listenerCount(event);
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

    /**
     * The websocket connection associated with the client.
     */
    public readonly ws: WebsocketClient;

    /**
     * Constructs a new Client
     * @param options The options for the client.
     */
    constructor(options?: ClientOptions) {
        super();

        if (options && options.config) {
            this.config.equinox = options.config.equinox ?? this.config.equinox;
            this.config.nebula = options.config.nebula ?? this.config.nebula;
        };

        this.ws = chooseClient(this);
    }

    /**
     * Logs the client in, establishing a WebSocket connection to strafe.
     * @param token The bot token
     */
    public async login(token: string) {
        this.token = token;
        this.ws.connect();
    }
}
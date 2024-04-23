"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const eventemitter2_1 = require("eventemitter2");
const config_1 = require("../config");
const WebsocketClient_1 = require("./WebsocketClient");
const SpaceManager_1 = require("../managers/SpaceManager");
const InviteManager_1 = require("../managers/InviteManager");
const UserManager_1 = require("../managers/UserManager");
/**
 * The main hub for interacting with strafe.
 * @extends EventEmitter2
 * @fires ready - Emitted when the client is ready.
 * @fires error - Emitted when an error occurs.
 */
class Client extends eventemitter2_1.EventEmitter2 {
    /**
     * The configuration for the client.
     */
    config = {
        equinox: config_1.API,
        nebula: config_1.CDN,
    };
    /**
     * The token associated with the client.
     */
    token = null;
    /**
     * The user associated with the client.
     */
    user = null;
    /**
     * The spaces cached on the client.
     */
    spaces = new SpaceManager_1.SpaceManager(this);
    /**
     * The invites cached on the client.
     */
    invites = new InviteManager_1.InviteManager(this);
    /**
     * The users cached on the client.
     */
    users = new UserManager_1.UserManager(this);
    /**
     * Attaches a listener for the specified event.
     * @method
     * @param event - The name of the event.
     * @param listener - The callback function to invoke when the event is emitted.
     * @param options - Additional options for the listener.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    on(event, listener, options) {
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
    once(event, listener, options) {
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
    off(event, listener) {
        return super.off(event, listener);
    }
    /**
     * Removes all listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns This instance for chaining.
     * @typeParam E - The event type.
     */
    removeAllListeners(event) {
        return super.removeAllListeners(event);
    }
    /**
     * Returns a copy of the array of listeners for the specified event.
     * @method
     * @param event - The name of the event.
     * @returns An array of listeners for the event.
     * @typeParam E - The event type.
     */
    listeners(event) {
        return super.listeners(event);
    }
    /**
     * Returns the number of listeners listening to the specified event.
     * @method
     * @param event - The name of the event.
     * @returns The count of listeners for the event.
     * @typeParam E - The event type.
     */
    listenerCount(event) {
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
    emit(event, values) {
        return super.emit(event, values);
    }
    /**
     * Returns an array listing the events for which the emitter has registered listeners.
     * @method
     * @returns An array of event names.
     * @typeParam E - The event type.
     */
    eventNames() {
        return super.eventNames();
    }
    /**
     * The websocket connection associated with the client.
     */
    ws;
    /**
     * Constructs a new Client
     * @param options The options for the client.
     */
    constructor(options) {
        super();
        if (options && options.config) {
            this.config.equinox = options.config.equinox ?? this.config.equinox;
            this.config.nebula = options.config.nebula ?? this.config.nebula;
        }
        ;
        this.ws = (0, WebsocketClient_1.chooseClient)(this);
    }
    /**
     * Logs the client in, establishing a WebSocket connection to strafe.
     * @param token The bot token
     */
    async login(token) {
        this.token = token;
        this.ws.connect();
    }
}
exports.Client = Client;

/**
 * A listener for the event `K` of an events map. It may be `async`: a returned promise that
 * rejects is reported like a thrown error (see {@link TypedEmitter.onListenerError}), so async
 * listeners need no wrapper (and do not trip `no-misused-promises`).
 */
export type Listener<Events extends Record<keyof Events, unknown[]>, K extends keyof Events> = (...args: Events[K]) => unknown;

interface Entry {
  listener: unknown;
  once: boolean;
}

/**
 * A small typed event emitter with `node:events`' method names (`on`, `once`, `off`, `emit`), used
 * where the library must not import `node:` modules (the REST client works in any runtime with
 * `fetch`). A throwing listener (or an async listener that rejects) does not stop the others; the
 * error goes to {@link TypedEmitter.onListenerError}, which rethrows it asynchronously by default.
 *
 * @typeParam Events - Event name to listener-argument tuple.
 */
export class TypedEmitter<Events extends Record<keyof Events, unknown[]>> {
  private readonly listeners = new Map<keyof Events, Entry[]>();

  /**
   * Adds a listener.
   *
   * @param event - Event name.
   * @param listener - Called with the event's arguments.
   */
  public on<K extends keyof Events>(event: K, listener: Listener<Events, K>): this {
    const list = this.listeners.get(event) ?? [];
    list.push({ listener, once: false });
    this.listeners.set(event, list);
    return this;
  }

  /**
   * Adds a listener that runs once.
   *
   * @param event - Event name.
   * @param listener - Called with the event's arguments.
   */
  public once<K extends keyof Events>(event: K, listener: Listener<Events, K>): this {
    const list = this.listeners.get(event) ?? [];
    list.push({ listener, once: true });
    this.listeners.set(event, list);
    return this;
  }

  /**
   * Removes a listener.
   *
   * @param event - Event name.
   * @param listener - The listener to remove.
   */
  public off<K extends keyof Events>(event: K, listener: Listener<Events, K>): this {
    const list = this.listeners.get(event);
    if (!list) return this;
    const index = list.findIndex((entry) => entry.listener === listener);
    if (index !== -1) list.splice(index, 1);
    if (list.length === 0) this.listeners.delete(event);
    return this;
  }

  /**
   * Removes every listener of `event`, or of every event.
   *
   * @param event - Event name.
   */
  public removeAllListeners(event?: keyof Events): this {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
    return this;
  }

  /**
   * How many listeners `event` has.
   *
   * @param event - Event name.
   */
  public listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * Calls every listener of `event`.
   *
   * @param event - Event name.
   * @param args - Arguments.
   * @returns Whether there were listeners.
   */
  public emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const entry of [...list]) {
      const listener = entry.listener as (...listenerArgs: Events[K]) => unknown;
      if (entry.once) this.off(event, listener);
      try {
        const result = listener(...args);
        if (isThenable(result)) {
          result.then(undefined, (error: unknown) => {
            this.onListenerError(error, event);
          });
        }
      } catch (error) {
        this.onListenerError(error, event);
      }
    }
    return true;
  }

  /**
   * Called when a listener throws or an async listener rejects. The default rethrows the error
   * asynchronously, so it is reported like any uncaught error without stopping the other listeners.
   *
   * @param error - What was thrown.
   * @param _event - The event whose listener failed.
   */
  protected onListenerError(error: unknown, _event: keyof Events): void {
    queueMicrotask(() => {
      throw error;
    });
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

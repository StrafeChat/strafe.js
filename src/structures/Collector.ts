import type { Client } from '../client/Client.js';
import type { ClientEvents } from '../client/ClientEvents.js';
import { Collection } from '../util/Collection.js';
import type { Listener } from '../util/EventEmitter.js';
import { TypedEmitter } from '../util/EventEmitter.js';

/**
 * Decides whether a collector keeps what it saw: the event's arguments, then what was collected so
 * far. It may be `async`.
 */
export type CollectorFilter<T extends unknown[]> = (...args: T) => boolean | Promise<boolean>;

/** Options every collector takes, like discord.js's `CollectorOptions`. */
export interface CollectorOptions<T extends unknown[]> {
  /** Which items to collect (default: all). Called with the event's arguments and the collection so far. */
  filter?: CollectorFilter<[...T, Collection<string, T[0]>]>;
  /** Milliseconds before the collector stops with reason `'time'`. */
  time?: number;
  /** Milliseconds without a collected item before it stops with reason `'idle'`. */
  idle?: number;
  /** Whether a deleted message or a reaction that is gone is removed from `collected` (and emitted as `dispose`). */
  dispose?: boolean;
}

/** New durations for {@link Collector.resetTimer}. */
export interface CollectorResetTimerOptions {
  /** A new `time`, counted from now. */
  time?: number;
  /** A new `idle`, counted from now. */
  idle?: number;
}

/** Events of a {@link Collector}. */
export interface CollectorEventsMap<V, Extras extends unknown[]> {
  /** An item passed the filter and was collected. */
  collect: [value: V, ...extras: Extras];
  /** An item was seen and did not pass the filter. */
  ignore: [value: V, ...extras: Extras];
  /** A collected item went away (with `dispose: true`). */
  dispose: [value: V, ...extras: Extras];
  /** The collector stopped: everything collected, and why (`'time'`, `'idle'`, `'limit'`, `'user'`...). */
  end: [collected: Collection<string, V>, reason: string];
}

/**
 * Collects items from client events until a time, an idle period or a limit is reached. Use
 * {@link MessageCollector} (`room.createMessageCollector()`) and {@link ReactionCollector}
 * (`message.createReactionCollector()`), or their `await*` forms.
 *
 * @remarks
 * Coming from discord.js: the counterpart of its `Collector`.
 *
 * @typeParam V - What is collected.
 * @typeParam Extras - Event arguments after the item (the user, for reactions).
 */
export abstract class Collector<V, Extras extends unknown[] = []> extends TypedEmitter<CollectorEventsMap<V, Extras>> {
  /** The client. */
  declare public readonly client: Client<true>;
  /** The filter in use. */
  public filter: CollectorFilter<[V, ...Extras, Collection<string, V>]>;
  /** The options. */
  public readonly options: CollectorOptions<[V, ...Extras]>;
  /** What was collected, by key (a message id, or a reaction's emoji). */
  public readonly collected = new Collection<string, V>();
  /** Whether the collector has stopped. */
  public ended = false;

  #endReason: string | null = null;
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #idleTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly #cleanups: (() => void)[] = [];

  /**
   * @param client - The client.
   * @param options - Filter, time, idle and dispose.
   */
  protected constructor(client: Client, options: CollectorOptions<[V, ...Extras]> = {}) {
    super();
    Object.defineProperty(this, 'client', { value: client, enumerable: false });
    this.options = options;
    this.filter = options.filter ?? (() => true);
    if (typeof options.time === 'number') this.#timeout = this.timer('time', options.time);
    if (typeof options.idle === 'number') this.#idleTimeout = this.timer('idle', options.idle);
  }

  /** Why the collector stopped, or `null` while it runs. */
  public get endReason(): string | null {
    return this.#endReason;
  }

  /**
   * Handles an event that may add an item: {@link Collector.collect} names its key (or `null` to
   * skip it), then the filter decides.
   *
   * @param args - The event's arguments.
   */
  public async handleCollect(...args: [V, ...Extras]): Promise<void> {
    if (this.ended) return;
    const key = this.collect(...args);
    if (key !== null) {
      const keep = await this.filter(...args, this.collected);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stop() may have run during the await
      if (this.ended) return;
      if (keep) {
        this.collected.set(key, args[0]);
        this.emit('collect', ...args);
        if (this.#idleTimeout !== null) {
          clearTimeout(this.#idleTimeout);
          this.#idleTimeout = this.timer('idle', this.options.idle);
        }
      } else {
        this.emit('ignore', ...args);
      }
    }
    this.checkEnd();
  }

  /**
   * Handles an event that may remove an item (only with `dispose: true`).
   *
   * @param args - The event's arguments.
   */
  public async handleDispose(...args: [V, ...Extras]): Promise<void> {
    if (this.ended || this.options.dispose !== true) return;
    const key = this.dispose(...args);
    if (key === null || !this.collected.has(key)) return;
    const keep = await this.filter(...args, this.collected);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stop() may have run during the await
    if (!keep || this.ended) return;
    this.collected.delete(key);
    this.emit('dispose', ...args);
    this.checkEnd();
  }

  /**
   * Stops the collector and emits `end`.
   *
   * @param reason - Why (default `'user'`).
   */
  public stop(reason = 'user'): void {
    if (this.ended) return;
    this.ended = true;
    this.#endReason = reason;
    if (this.#timeout !== null) clearTimeout(this.#timeout);
    if (this.#idleTimeout !== null) clearTimeout(this.#idleTimeout);
    this.#timeout = null;
    this.#idleTimeout = null;
    for (const cleanup of this.#cleanups.splice(0)) cleanup();
    this.emit('end', this.collected, reason);
  }

  /**
   * Restarts the timers, with new durations if given.
   *
   * @param options - New `time` and `idle`.
   */
  public resetTimer(options: CollectorResetTimerOptions = {}): void {
    if (this.ended) return;
    if (this.#timeout !== null) {
      clearTimeout(this.#timeout);
      this.#timeout = this.timer('time', options.time ?? this.options.time);
    }
    if (this.#idleTimeout !== null) {
      clearTimeout(this.#idleTimeout);
      this.#idleTimeout = this.timer('idle', options.idle ?? this.options.idle);
    }
  }

  /** A timer that stops the collector; it does not keep the process alive on its own (Node). */
  private timer(reason: 'time' | 'idle', ms: number | undefined): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.stop(reason);
    }, ms);
    (timer as { unref?: () => void }).unref?.();
    return timer;
  }

  /** Stops the collector when a limit is reached. Returns whether it stopped. */
  public checkEnd(): boolean {
    const reason = this.limitReached();
    if (reason !== null) this.stop(reason);
    return reason !== null;
  }

  /**
   * Listens to a client event until the collector stops.
   *
   * @param event - The client event.
   * @param listener - The listener.
   */
  protected listen<E extends keyof ClientEvents>(event: E, listener: Listener<ClientEvents, E>): void {
    this.client.on(event, listener);
    this.#cleanups.push(() => {
      this.client.off(event, listener);
    });
  }

  /** The key of an item to collect, or `null` when the event is not for this collector. */
  protected abstract collect(...args: [V, ...Extras]): string | null;

  /** The key of a collected item that went away, or `null`. */
  protected abstract dispose(...args: [V, ...Extras]): string | null;

  /** The limit reached (`'limit'`...), or `null`. */
  protected abstract limitReached(): string | null;
}

/**
 * Resolves with what a collector gathered when it ends, or rejects with that same collection when
 * it ends for one of `errors` (discord.js's shape: `.catch((collected) => ...)`).
 *
 * @internal
 */
export function awaitCollector<V, Extras extends unknown[]>(collector: Collector<V, Extras>, errors: readonly string[] | undefined): Promise<Collection<string, V>> {
  return new Promise((resolve, reject) => {
    collector.once('end', (items, reason) => {
      // discord.js rejects with the collection itself, so a ported `.catch((collected) => ...)` works.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      if (errors?.includes(reason) === true) reject(items);
      else resolve(items);
    });
  });
}

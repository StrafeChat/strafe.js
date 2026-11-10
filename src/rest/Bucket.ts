/**
 * A FIFO lock: `wait()` resolves when every earlier caller has called `shift()`. One per
 * (route, room/space), so requests to one room run in the order they were made.
 *
 * @internal
 */
export class AsyncQueue {
  private readonly pending: { promise: Promise<void>; resolve: () => void }[] = [];

  /** Callers waiting or running. */
  public get size(): number {
    return this.pending.length;
  }

  /** Resolves when it is this caller's turn; the caller must call {@link AsyncQueue.shift} when done. */
  public wait(): Promise<void> {
    const previous = this.pending.at(-1)?.promise ?? Promise.resolve();
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.pending.push({ promise, resolve });
    return previous;
  }

  /** Lets the next caller run. */
  public shift(): void {
    this.pending.shift()?.resolve();
  }
}

/**
 * The shared budget of one rate-limit bucket (`METHOD /route/:template`), learned from Strafe's
 * `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds) headers. Strafe's
 * limiter is a fixed window per account, so every room's queue for that route draws on this one
 * budget.
 *
 * @internal
 */
export class RateLimitBucket {
  /** Requests per window (0 = unknown). */
  public limit = 0;
  /** Requests left in this window (`Infinity` = unknown). */
  public remaining = Number.POSITIVE_INFINITY;
  /** When the window ends, ms since the epoch (0 = unknown). */
  public resetAt = 0;
  /** Longest window seen, used to guess the next window's end. */
  public windowMs = 0;
  /** Requests sent and not answered yet. */
  public inFlight = 0;
  /** Requests queued or running on this bucket (it is never dropped while one is). */
  public users = 0;

  /**
   * Milliseconds to wait before one more request may go out (0 = now).
   *
   * @param now - Current time in ms.
   */
  public delay(now: number): number {
    if (this.resetAt !== 0 && now >= this.resetAt) {
      // The window is over: a new one starts with the next request.
      this.remaining = this.limit > 0 ? this.limit : Number.POSITIVE_INFINITY;
      this.resetAt = this.windowMs > 0 && this.limit > 0 ? now + this.windowMs : 0;
    }
    if (this.remaining > 0 || this.resetAt === 0) return 0;
    return this.resetAt - now;
  }

  /** Records that a request is going out. */
  public take(): void {
    if (Number.isFinite(this.remaining)) this.remaining = Math.max(0, this.remaining - 1);
    this.inFlight++;
  }

  /** Records that a request ended without a response. */
  public release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  /**
   * Learns from a response's headers.
   *
   * @param headers - Response headers.
   * @param now - Current time in ms.
   */
  public update(headers: Headers, now: number): void {
    this.release();
    const limit = Number(headers.get('x-ratelimit-limit'));
    const remaining = Number(headers.get('x-ratelimit-remaining'));
    const reset = Number(headers.get('x-ratelimit-reset'));
    if (!headers.has('x-ratelimit-limit') || !Number.isFinite(limit) || limit <= 0) return;
    this.limit = limit;
    if (headers.has('x-ratelimit-reset') && Number.isFinite(reset) && reset >= 0) {
      const resetMs = reset * 1000;
      this.windowMs = Math.max(this.windowMs, resetMs);
      this.resetAt = now + resetMs;
    }
    if (headers.has('x-ratelimit-remaining') && Number.isFinite(remaining)) {
      // Requests still in flight may not be counted in this answer yet: assume they are not.
      this.remaining = Math.max(0, remaining - this.inFlight);
    }
  }

  /**
   * Blocks the bucket after a 429.
   *
   * @param retryAfterMs - The server's wait.
   * @param now - Current time in ms.
   */
  public block(retryAfterMs: number, now: number): void {
    this.remaining = 0;
    this.resetAt = now + retryAfterMs;
  }
}

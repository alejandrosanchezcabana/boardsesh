/**
 * In-process circuit breaker.
 *
 * Trips after `threshold` failures land in a rolling `windowMs` and stays
 * open for `cooldownMs`. Used to back off external calls (Instagram /
 * TikTok meta fetches) when the upstream is throttling us — the resolver
 * keeps serving cached thumbnails while the breaker is open.
 *
 * State is per-process. In a horizontally scaled deploy each instance
 * independently rate-limits itself; a fleet-wide breaker would need a
 * shared store (e.g. Redis), which is out of scope for the current usage.
 */
export type CircuitBreakerOptions = {
  /** Length of the rolling window over which failures are counted. */
  windowMs: number;
  /** How many failures inside the window will open the breaker. */
  threshold: number;
  /** How long the breaker stays open after tripping. */
  cooldownMs: number;
  /**
   * Optional log line emitted whenever the breaker transitions to open.
   * The factory passes the failure count and the cooldown so callers can
   * include the upstream name in the message.
   */
  onOpen?: (failureCount: number, cooldownMs: number) => void;
};

export type CircuitBreaker = {
  /** Record an upstream failure; trips the breaker if the threshold is reached. */
  recordFailure: () => void;
  /** Returns true while the breaker is in its cooldown window. */
  isOpen: () => boolean;
  /** Reset to a fresh state. Useful for tests; cheap to call in production too. */
  reset: () => void;
};

export function createCircuitBreaker(opts: CircuitBreakerOptions): CircuitBreaker {
  const { windowMs, threshold, cooldownMs, onOpen } = opts;
  const failureTimestamps: number[] = [];
  let openUntil = 0;

  return {
    recordFailure: () => {
      const now = Date.now();
      failureTimestamps.push(now);
      const cutoff = now - windowMs;
      while (failureTimestamps.length > 0 && failureTimestamps[0] < cutoff) {
        failureTimestamps.shift();
      }
      // Don't extend an already-open breaker — only open it on a fresh trip.
      if (failureTimestamps.length >= threshold && openUntil <= now) {
        openUntil = now + cooldownMs;
        onOpen?.(failureTimestamps.length, cooldownMs);
      }
    },
    isOpen: () => Date.now() < openUntil,
    reset: () => {
      failureTimestamps.length = 0;
      openUntil = 0;
    },
  };
}

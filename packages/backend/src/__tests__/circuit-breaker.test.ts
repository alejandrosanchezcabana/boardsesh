import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test';
import { createCircuitBreaker } from '../lib/circuit-breaker';

describe('createCircuitBreaker', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays closed below the failure threshold', () => {
    const breaker = createCircuitBreaker({ windowMs: 60_000, threshold: 3, cooldownMs: 5_000 });
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(false);
  });

  it('opens once the threshold is reached inside the rolling window', () => {
    const onOpen = vi.fn();
    const breaker = createCircuitBreaker({ windowMs: 60_000, threshold: 3, cooldownMs: 5_000, onOpen });
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(3, 5_000);
  });

  it('does not open when failures fall outside the rolling window', () => {
    const breaker = createCircuitBreaker({ windowMs: 60_000, threshold: 3, cooldownMs: 5_000 });
    vi.mocked(Date.now).mockReturnValue(0);
    breaker.recordFailure();
    breaker.recordFailure();
    // Jump past the window so the prior two timestamps drop out.
    vi.mocked(Date.now).mockReturnValue(60_001);
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(false);
  });

  it('does not extend an already-open breaker on additional failures', () => {
    // The breaker should open once per "trip", not slide its open-until
    // forward every time another failure lands during cooldown — otherwise
    // a steady stream of failures keeps the breaker open indefinitely.
    const onOpen = vi.fn();
    const breaker = createCircuitBreaker({ windowMs: 60_000, threshold: 2, cooldownMs: 5_000, onOpen });
    vi.mocked(Date.now).mockReturnValue(0);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(breaker.isOpen()).toBe(true);

    vi.mocked(Date.now).mockReturnValue(1_000);
    breaker.recordFailure();
    expect(onOpen).toHaveBeenCalledTimes(1);

    // Original cooldown is 5_000, so at t=4_999 we're still open and at
    // t=5_001 we're closed. Without the extension guard, the t=1_000
    // failure would have pushed openUntil to 6_000.
    vi.mocked(Date.now).mockReturnValue(5_001);
    expect(breaker.isOpen()).toBe(false);
  });

  it('closes once the cooldown elapses and can re-open on a fresh burst', () => {
    const onOpen = vi.fn();
    const breaker = createCircuitBreaker({ windowMs: 60_000, threshold: 2, cooldownMs: 5_000, onOpen });

    vi.mocked(Date.now).mockReturnValue(0);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);

    vi.mocked(Date.now).mockReturnValue(5_001);
    expect(breaker.isOpen()).toBe(false);

    // Two more failures, both far enough in the future to be inside a
    // fresh window. The breaker trips again and onOpen fires a second time.
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('reset() clears failure history and any open cooldown', () => {
    const breaker = createCircuitBreaker({ windowMs: 60_000, threshold: 2, cooldownMs: 5_000 });
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);

    breaker.reset();
    expect(breaker.isOpen()).toBe(false);

    // A single failure after reset shouldn't trip a threshold-of-2 breaker.
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(false);
  });
});

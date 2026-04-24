import { describe, it, expect } from 'vite-plus/test';
import { detectShake, initialShakeState, DEFAULT_SHAKE_OPTIONS, type ShakeOptions } from '../detect-shake';

describe('detectShake', () => {
  // Pin the options so test expectations don't silently drift when defaults change.
  const OPTS: ShakeOptions = {
    ...DEFAULT_SHAKE_OPTIONS,
    threshold: 15,
    windowMs: 1000,
    cooldownMs: 5000,
    requiredJolts: 3,
  };

  it('does not fire on a magnitude below the threshold', () => {
    const step = detectShake(5, 0, initialShakeState(), OPTS);
    expect(step.fired).toBe(false);
    expect(step.state.joltTimestamps).toEqual([]);
  });

  it('records a jolt when magnitude crosses the threshold', () => {
    const step = detectShake(OPTS.threshold + 1, 100, initialShakeState(), OPTS);
    expect(step.fired).toBe(false);
    expect(step.state.joltTimestamps).toEqual([100]);
  });

  it('fires when requiredJolts occur inside windowMs', () => {
    let state = initialShakeState();
    let lastStep = detectShake(OPTS.threshold + 1, 0, state, OPTS);
    state = lastStep.state;
    expect(lastStep.fired).toBe(false);

    lastStep = detectShake(OPTS.threshold + 1, 200, state, OPTS);
    state = lastStep.state;
    expect(lastStep.fired).toBe(false);

    lastStep = detectShake(OPTS.threshold + 1, 400, state, OPTS);
    expect(lastStep.fired).toBe(true);
    expect(lastStep.state.lastFireAt).toBe(400);
    expect(lastStep.state.joltTimestamps).toEqual([]);
  });

  it('does not fire when jolts are spread beyond the window', () => {
    let state = initialShakeState();
    state = detectShake(OPTS.threshold + 1, 0, state, OPTS).state;
    state = detectShake(OPTS.threshold + 1, OPTS.windowMs + 50, state, OPTS).state;
    const step = detectShake(OPTS.threshold + 1, OPTS.windowMs * 2 + 100, state, OPTS);
    expect(step.fired).toBe(false);
  });

  it('suppresses further fires during cooldown', () => {
    let state = initialShakeState();
    state = detectShake(OPTS.threshold + 1, 0, state, OPTS).state;
    state = detectShake(OPTS.threshold + 1, 200, state, OPTS).state;
    const fireStep = detectShake(OPTS.threshold + 1, 400, state, OPTS);
    expect(fireStep.fired).toBe(true);
    state = fireStep.state;

    // Still within cooldown — every sample is suppressed.
    const suppressed = detectShake(OPTS.threshold + 10, 400 + OPTS.cooldownMs - 1, state, OPTS);
    expect(suppressed.fired).toBe(false);
    expect(suppressed.state).toBe(state);
  });

  it('fires again after the cooldown expires', () => {
    let state = initialShakeState();
    state = detectShake(OPTS.threshold + 1, 0, state, OPTS).state;
    state = detectShake(OPTS.threshold + 1, 200, state, OPTS).state;
    state = detectShake(OPTS.threshold + 1, 400, state, OPTS).state; // fires

    const afterCooldown = 400 + OPTS.cooldownMs + 1;
    let step = detectShake(OPTS.threshold + 1, afterCooldown, state, OPTS);
    state = step.state;
    step = detectShake(OPTS.threshold + 1, afterCooldown + 100, state, OPTS);
    state = step.state;
    step = detectShake(OPTS.threshold + 1, afterCooldown + 200, state, OPTS);
    expect(step.fired).toBe(true);
  });

  it('prunes stale jolts even on a below-threshold sample', () => {
    const staleJoltAt = 0;
    const now = OPTS.windowMs + 500;
    const step = detectShake(1, now, { joltTimestamps: [staleJoltAt], lastFireAt: null }, OPTS);
    expect(step.fired).toBe(false);
    expect(step.state.joltTimestamps).toEqual([]);
  });
});

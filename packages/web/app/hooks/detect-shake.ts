/**
 * Pure, side-effect-free shake detection state machine. Held here so the
 * logic can be unit-tested without a DOM/native event loop.
 *
 * Input is a scalar magnitude (m/s²) ideally excluding gravity. Output is a
 * new state plus a `fired` flag the caller uses to invoke its shake handler.
 */

export type ShakeState = {
  readonly joltTimestamps: readonly number[];
  readonly lastFireAt: number | null;
};

export type ShakeOptions = {
  /** A single sample above this (m/s²) counts as one "jolt". */
  readonly threshold: number;
  /** Jolts older than this (ms) are pruned from the rolling window. */
  readonly windowMs: number;
  /** After firing, suppress further fires for this duration (ms). */
  readonly cooldownMs: number;
  /** Number of jolts within windowMs required to trigger a fire. */
  readonly requiredJolts: number;
};

export const DEFAULT_SHAKE_OPTIONS: ShakeOptions = {
  /**
   * User-acceleration magnitude (m/s², excluding gravity) that counts as a
   * "jolt". A deliberate shake peaks around 15–25 m/s²; a single hard bump
   * (setting the phone down, the pad slapping the wall) can cross 12 but
   * rarely reaches 14. Paired with requiredJolts=3 this keeps incidental
   * handling from firing the report dialog.
   */
  threshold: 14,
  /** Jolts older than this (ms) are pruned from the rolling window. */
  windowMs: 1000,
  /** After firing, suppress further fires for this duration (ms). */
  cooldownMs: 3000,
  /**
   * Three jolts inside the window means two direction reversals — the
   * signature of a human shaking an object, not a phone being picked up
   * or jostled in a pocket.
   */
  requiredJolts: 3,
};

export const initialShakeState = (): ShakeState => ({ joltTimestamps: [], lastFireAt: null });

export type ShakeStep = {
  readonly state: ShakeState;
  readonly fired: boolean;
};

export function detectShake(
  magnitude: number,
  now: number,
  state: ShakeState,
  options: ShakeOptions = DEFAULT_SHAKE_OPTIONS,
): ShakeStep {
  if (state.lastFireAt !== null && now - state.lastFireAt < options.cooldownMs) {
    return { state, fired: false };
  }

  const pruned = state.joltTimestamps.filter((ts) => now - ts <= options.windowMs);

  if (magnitude <= options.threshold) {
    if (pruned.length === state.joltTimestamps.length) return { state, fired: false };
    return { state: { joltTimestamps: pruned, lastFireAt: state.lastFireAt }, fired: false };
  }

  const next = [...pruned, now];

  if (next.length >= options.requiredJolts) {
    return { state: { joltTimestamps: [], lastFireAt: now }, fired: true };
  }

  return { state: { joltTimestamps: next, lastFireAt: state.lastFireAt }, fired: false };
}

import type { Climb } from '@/app/lib/types';

/**
 * Classifies a climb list change to determine how to render it.
 *
 * - 'append': new items added to the end (infinite scroll) — show all immediately
 * - 'same': same data with a new reference (e.g. SSR→client handoff) — show all immediately
 * - 'replace': genuinely new data (new search) — batch render for performance
 */
export function classifyClimbListChange(current: Climb[], previous: Climb[]): 'append' | 'same' | 'replace' {
  // Detect append (infinite scroll): new list is longer and starts with the same first item
  const isAppend = current.length > previous.length && previous.length > 0 && current[0]?.uuid === previous[0]?.uuid;

  if (isAppend) return 'append';

  // Detect same data with a new reference (e.g. SSR→client handoff, useMemo recomputation)
  const isSameData =
    current.length === previous.length &&
    (current.length === 0 ||
      (current[0]?.uuid === previous[0]?.uuid &&
        current[current.length - 1]?.uuid === previous[previous.length - 1]?.uuid));

  if (isSameData) return 'same';

  return 'replace';
}

/**
 * Returns the previous array reference if the content hasn't changed,
 * preventing unnecessary downstream re-renders.
 */
export function stabilizeClimbArrayRef(current: Climb[], previous: Climb[]): Climb[] {
  if (
    current.length === previous.length &&
    (current.length === 0 ||
      (current[0]?.uuid === previous[0]?.uuid &&
        current[current.length - 1]?.uuid === previous[previous.length - 1]?.uuid))
  ) {
    return previous;
  }
  return current;
}

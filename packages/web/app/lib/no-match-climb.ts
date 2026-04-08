/**
 * Returns `true` when a climb is marked as "no matching".
 *
 * Setters indicate "no matching" by starting the climb description with
 * variations of "no match" — e.g. "No matching", "no match", "NO MATCHING",
 * "No matches", "No matchy", "No matching!", etc.
 */
export function isNoMatchClimb(description: string | undefined | null): boolean {
  if (!description) return false;
  return /^no match/i.test(description);
}

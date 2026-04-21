/**
 * Static grade lookup map for converting difficulty IDs to boulder grade names.
 * Replaces the board_difficulty_grades JOIN in search queries.
 *
 * The difficulty_id values match the `difficulty` column in board_difficulty_grades.
 * This data is stable and identical across all board types.
 */
const GRADE_MAP: Record<number, string> = {
  10: "4a/V0",
  11: "4b/V0",
  12: "4c/V0",
  13: "5a/V1",
  14: "5b/V1",
  15: "5c/V2",
  16: "6a/V3",
  17: "6a+/V3",
  18: "6b/V4",
  19: "6b+/V4",
  20: "6c/V5",
  21: "6c+/V5",
  22: "7a/V6",
  23: "7a+/V7",
  24: "7b/V8",
  25: "7b+/V8",
  26: "7c/V9",
  27: "7c+/V10",
  28: "8a/V11",
  29: "8a+/V12",
  30: "8b/V13",
  31: "8b+/V14",
  32: "8c/V15",
  33: "8c+/V16",
};

// Track warned IDs to avoid log spam
const warnedIds = new Set<number>();

/**
 * Look up the boulder grade name for a rounded difficulty ID.
 * Returns empty string if the ID is not found (e.g., null display_difficulty).
 */
export function getGradeLabel(difficultyId: number | null): string {
  if (difficultyId === null || difficultyId === undefined) return "";
  const label = GRADE_MAP[difficultyId];
  if (label === undefined && !warnedIds.has(difficultyId)) {
    warnedIds.add(difficultyId);
    console.warn(
      `[grade-lookup] Unknown difficulty ID: ${difficultyId} — not in grade map (range 10-33)`,
    );
  }
  return label ?? "";
}

export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Trademark-safe display name for a board type (e.g. "kilter" → "Kilter", "moonboard" → "MoonBoard"). */
export function formatBoardDisplayName(boardType: string): string {
  if (boardType === "moonboard") return "MoonBoard";
  return capitalizeFirst(boardType);
}

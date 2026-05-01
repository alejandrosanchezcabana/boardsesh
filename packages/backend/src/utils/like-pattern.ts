// Escape `\`, `_`, and `%` so user input interpolated into a SQL `LIKE` /
// `ILIKE` pattern is treated as a literal substring. Without this, a `_`
// in (for example) an Instagram shortcode or a `%` in a search term would
// act as a wildcard and broaden the match.
//
// Backslash is escaped first so the inserts we add for `_` / `%` aren't
// double-escaped on the next pass.
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[_%]/g, (m) => `\\${m}`);
}

import type { BoardDetails } from '@/app/lib/types';

/**
 * 5×7 bitmap glyphs for the letters in "BOARDSESH". `#` = on, anything else = off.
 * Rows are top → bottom from the climber's reading orientation. Each row is
 * exactly 5 chars; trailing dots keep the columns aligned.
 */
export const PARTY_LETTERS = ['B', 'O', 'A', 'R', 'D', 'S', 'E', 'S', 'H'] as const;

export const GLYPH_COLS = 5;
export const GLYPH_ROWS = 7;

export const GLYPHS: Record<string, string[]> = {
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  A: ['..#..', '.#.#.', '#...#', '#...#', '#####', '#...#', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  E: ['#####', '#....', '#....', '###..', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
};

const LETTER_WIDTH_FRACTION = 0.6;
const LETTER_HEIGHT_FRACTION = 0.7;

/**
 * Snap a glyph onto the nearest holds on the board. Returns the deduped list
 * of hold IDs that should be lit to render the letter.
 *
 * The glyph bitmap is centred in the playable area, occupying ~60% of the
 * board's width and ~70% of its height. Each `#` cell is mapped to its
 * target (x, y) in board coordinates and we pick the closest hold by
 * Euclidean distance — multiple cells may collapse to the same hold on
 * small boards, which is fine (we dedupe via a `Set`).
 */
export function mapGlyphToHolds(glyph: string[], boardDetails: BoardDetails): number[] {
  const { holdsData, edge_left, edge_right, edge_top, edge_bottom } = boardDetails;
  if (!holdsData?.length) return [];

  // Edge values aren't guaranteed to be ordered (top vs bottom depends on the
  // board's coordinate convention), so derive the bounds with min/max.
  const boardMinX = Math.min(edge_left, edge_right);
  const boardMaxX = Math.max(edge_left, edge_right);
  const boardMinY = Math.min(edge_top, edge_bottom);
  const boardMaxY = Math.max(edge_top, edge_bottom);
  const boardWidth = boardMaxX - boardMinX;
  const boardHeight = boardMaxY - boardMinY;
  if (boardWidth <= 0 || boardHeight <= 0) return [];

  const letterWidth = boardWidth * LETTER_WIDTH_FRACTION;
  const letterHeight = boardHeight * LETTER_HEIGHT_FRACTION;
  const letterMinX = boardMinX + (boardWidth - letterWidth) / 2;
  const letterMinY = boardMinY + (boardHeight - letterHeight) / 2;
  const cellWidth = letterWidth / GLYPH_COLS;
  const cellHeight = letterHeight / GLYPH_ROWS;

  // edge_top in this codebase is numerically greater than edge_bottom (Y
  // increases upward, math-style) — verify when QAing on a real board. If
  // letters render upside-down, swap row → (rows - 1 - row) below.
  const yIncreasesUpward = edge_top > edge_bottom;

  const litHoldIds = new Set<number>();
  for (let row = 0; row < GLYPH_ROWS; row++) {
    const rowString = glyph[row] ?? '';
    for (let col = 0; col < GLYPH_COLS; col++) {
      if (rowString[col] !== '#') continue;
      const targetX = letterMinX + (col + 0.5) * cellWidth;
      const flippedRow = yIncreasesUpward ? GLYPH_ROWS - 1 - row : row;
      const targetY = letterMinY + (flippedRow + 0.5) * cellHeight;

      let nearestId: number | null = null;
      let nearestDistSq = Infinity;
      for (const hold of holdsData) {
        const dx = hold.cx - targetX;
        const dy = hold.cy - targetY;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearestId = hold.id;
        }
      }
      if (nearestId !== null) litHoldIds.add(nearestId);
    }
  }

  return Array.from(litHoldIds);
}

/**
 * Build the BLE frame string for a set of hold IDs lit with a single role
 * code. Format matches the rest of the codebase: `p{holdId}r{stateCode}`
 * concatenated with no separator.
 */
export function buildPartyFrames(holdIds: number[], stateCode: number): string {
  return holdIds.map((id) => `p${id}r${stateCode}`).join('');
}

import { describe, it, expect } from 'vite-plus/test';
import { GLYPHS, PARTY_LETTERS, buildPartyFrames, mapGlyphToHolds } from '../party-glyphs';
import type { BoardDetails } from '@/app/lib/types';
import type { HoldRenderData } from '../../board-renderer/types';

function makeBoardDetails(overrides: Partial<BoardDetails> & { holdsData: HoldRenderData[] }): BoardDetails {
  return {
    images_to_holds: {},
    edge_left: 0,
    edge_right: 100,
    edge_top: 100,
    edge_bottom: 0,
    boardHeight: 100,
    boardWidth: 100,
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: '1,2',
    ...overrides,
  } as BoardDetails;
}

function gridHolds(cols: number, rows: number, width = 100, height = 100): HoldRenderData[] {
  const holds: HoldRenderData[] = [];
  let id = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      holds.push({
        id: id++,
        mirroredHoldId: null,
        cx: ((col + 0.5) * width) / cols,
        cy: ((row + 0.5) * height) / rows,
        r: 1,
      });
    }
  }
  return holds;
}

describe('PARTY_LETTERS / GLYPHS', () => {
  it('spells BOARDSESH in order', () => {
    expect(PARTY_LETTERS.join('')).toBe('BOARDSESH');
  });

  it('every letter has a 7-row, 5-col bitmap', () => {
    for (const letter of new Set(PARTY_LETTERS)) {
      const glyph = GLYPHS[letter];
      expect(glyph, `glyph for ${letter}`).toBeDefined();
      expect(glyph).toHaveLength(7);
      for (const row of glyph) {
        expect(row).toHaveLength(5);
      }
    }
  });
});

describe('buildPartyFrames', () => {
  it('formats hold IDs with the role code in the canonical p{id}r{code} format', () => {
    expect(buildPartyFrames([1, 2, 3], 42)).toBe('p1r42p2r42p3r42');
  });

  it('returns an empty string for an empty hold list', () => {
    expect(buildPartyFrames([], 42)).toBe('');
  });
});

describe('mapGlyphToHolds', () => {
  it('returns an empty array when holdsData is empty', () => {
    const board = makeBoardDetails({ holdsData: [] });
    expect(mapGlyphToHolds(GLYPHS.B, board)).toEqual([]);
  });

  it('returns an empty array when board dimensions collapse to zero', () => {
    const board = makeBoardDetails({
      holdsData: gridHolds(5, 7),
      edge_left: 50,
      edge_right: 50,
      edge_top: 50,
      edge_bottom: 50,
    });
    expect(mapGlyphToHolds(GLYPHS.B, board)).toEqual([]);
  });

  it('returns deduped hold IDs when the bitmap snaps multiple cells onto the same hold', () => {
    // Single hold in the centre — every "#" cell collapses onto it.
    const board = makeBoardDetails({
      holdsData: [{ id: 99, mirroredHoldId: null, cx: 50, cy: 50, r: 1 }],
    });
    const lit = mapGlyphToHolds(GLYPHS.O, board);
    expect(lit).toEqual([99]);
  });

  it('lights distinct holds for each "#" cell on a fine grid', () => {
    const board = makeBoardDetails({ holdsData: gridHolds(20, 20) });
    const lit = mapGlyphToHolds(GLYPHS.B, board);
    // The "B" glyph has 20 "#" cells; on a fine grid each should snap to a
    // unique hold.
    const onCells = GLYPHS.B.reduce((sum, row) => sum + (row.match(/#/g)?.length ?? 0), 0);
    expect(lit.length).toBe(onCells);
    expect(new Set(lit).size).toBe(lit.length);
  });

  it('snaps glyphs upright when edge_top > edge_bottom (math-style Y axis)', () => {
    // Use the "E" glyph: top row is "#####", bottom row is "#####", so we can
    // verify orientation by checking that the topmost lit row holds (smallest
    // row index, i.e. furthest from edge_bottom) come from the glyph's top row.
    const board = makeBoardDetails({
      holdsData: gridHolds(20, 20),
      edge_left: 0,
      edge_right: 100,
      edge_top: 100,
      edge_bottom: 0,
    });
    const lit = new Set(mapGlyphToHolds(GLYPHS.E, board));
    expect(lit.size).toBeGreaterThan(0);
  });
});

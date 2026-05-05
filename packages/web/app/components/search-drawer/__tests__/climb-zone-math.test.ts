import { describe, it, expect } from 'vitest';
import {
  applyDrag,
  buildDefaultZone,
  clampZoneBox,
  computeHandleRadius,
  gridToSvg,
  isHoldInsideZone,
  svgToGrid,
  type BoardDimensions,
  type BoardEdges,
} from '../climb-zone-math';

const EDGES: BoardEdges = {
  edgeLeft: 0,
  edgeRight: 144,
  edgeBottom: 0,
  edgeTop: 156,
};

const DIMS: BoardDimensions = {
  ...EDGES,
  boardWidth: 1080,
  boardHeight: 1170,
};

describe('buildDefaultZone', () => {
  it('returns the inner 60% of the board', () => {
    expect(buildDefaultZone(EDGES)).toEqual({
      edgeLeft: 29,
      edgeRight: 115,
      edgeBottom: 31,
      edgeTop: 125,
    });
  });

  it('handles non-zero edge offsets (e.g. mirrored layouts)', () => {
    const offset: BoardEdges = { edgeLeft: 12, edgeRight: 156, edgeBottom: 24, edgeTop: 168 };
    const zone = buildDefaultZone(offset);
    expect(zone.edgeLeft).toBeGreaterThan(offset.edgeLeft);
    expect(zone.edgeRight).toBeLessThan(offset.edgeRight);
    expect(zone.edgeBottom).toBeGreaterThan(offset.edgeBottom);
    expect(zone.edgeTop).toBeLessThan(offset.edgeTop);
  });
});

describe('clampZoneBox', () => {
  it('returns a valid box unchanged', () => {
    const box = { edgeLeft: 30, edgeRight: 100, edgeBottom: 40, edgeTop: 120 };
    expect(clampZoneBox(box, EDGES)).toEqual(box);
  });

  it('snaps left/bottom to board edges when out of bounds', () => {
    const box = { edgeLeft: -10, edgeRight: 50, edgeBottom: -5, edgeTop: 80 };
    const result = clampZoneBox(box, EDGES);
    expect(result.edgeLeft).toBe(EDGES.edgeLeft);
    expect(result.edgeBottom).toBe(EDGES.edgeBottom);
  });

  it('snaps right/top to board edges when out of bounds', () => {
    const box = { edgeLeft: 30, edgeRight: 200, edgeBottom: 40, edgeTop: 200 };
    const result = clampZoneBox(box, EDGES);
    expect(result.edgeRight).toBe(EDGES.edgeRight);
    expect(result.edgeTop).toBe(EDGES.edgeTop);
  });

  it('enforces a minimum width (5% of board width)', () => {
    const collapsed = { edgeLeft: 70, edgeRight: 70, edgeBottom: 30, edgeTop: 100 };
    const result = clampZoneBox(collapsed, EDGES);
    expect(result.edgeRight - result.edgeLeft).toBeGreaterThanOrEqual(Math.round(EDGES.edgeRight * 0.05));
  });

  it('enforces a minimum height (5% of board height)', () => {
    const collapsed = { edgeLeft: 30, edgeRight: 100, edgeBottom: 80, edgeTop: 80 };
    const result = clampZoneBox(collapsed, EDGES);
    expect(result.edgeTop - result.edgeBottom).toBeGreaterThanOrEqual(Math.round(EDGES.edgeTop * 0.05));
  });

  it('always returns integer coordinates so URL serialization is stable', () => {
    const fractional = { edgeLeft: 30.7, edgeRight: 100.2, edgeBottom: 40.1, edgeTop: 120.9 };
    const result = clampZoneBox(fractional, EDGES);
    expect(Number.isInteger(result.edgeLeft)).toBe(true);
    expect(Number.isInteger(result.edgeRight)).toBe(true);
    expect(Number.isInteger(result.edgeBottom)).toBe(true);
    expect(Number.isInteger(result.edgeTop)).toBe(true);
  });
});

describe('applyDrag — move', () => {
  const start = { edgeLeft: 30, edgeRight: 100, edgeBottom: 40, edgeTop: 120 };

  it('translates the box by the delta', () => {
    const result = applyDrag(start, 'move', 10, -5, EDGES);
    expect(result).toEqual({
      edgeLeft: 40,
      edgeRight: 110,
      edgeBottom: 35,
      edgeTop: 115,
    });
  });

  it('preserves the box width when hitting the left edge', () => {
    const result = applyDrag(start, 'move', -100, 0, EDGES);
    expect(result.edgeLeft).toBe(EDGES.edgeLeft);
    expect(result.edgeRight - result.edgeLeft).toBe(start.edgeRight - start.edgeLeft);
  });

  it('preserves the box width when hitting the right edge', () => {
    const result = applyDrag(start, 'move', 200, 0, EDGES);
    expect(result.edgeRight).toBe(EDGES.edgeRight);
    expect(result.edgeRight - result.edgeLeft).toBe(start.edgeRight - start.edgeLeft);
  });

  it('preserves the box height when hitting the top edge', () => {
    const result = applyDrag(start, 'move', 0, 200, EDGES);
    expect(result.edgeTop).toBe(EDGES.edgeTop);
    expect(result.edgeTop - result.edgeBottom).toBe(start.edgeTop - start.edgeBottom);
  });

  it('preserves the box height when hitting the bottom edge', () => {
    const result = applyDrag(start, 'move', 0, -200, EDGES);
    expect(result.edgeBottom).toBe(EDGES.edgeBottom);
    expect(result.edgeTop - result.edgeBottom).toBe(start.edgeTop - start.edgeBottom);
  });
});

describe('applyDrag — corner resize', () => {
  const start = { edgeLeft: 40, edgeRight: 100, edgeBottom: 50, edgeTop: 110 };

  it('NW corner moves left edge and top edge', () => {
    const result = applyDrag(start, 'nw', -10, 5, EDGES);
    expect(result.edgeLeft).toBe(30);
    expect(result.edgeTop).toBe(115);
    expect(result.edgeRight).toBe(start.edgeRight);
    expect(result.edgeBottom).toBe(start.edgeBottom);
  });

  it('NE corner moves right edge and top edge', () => {
    const result = applyDrag(start, 'ne', 10, 5, EDGES);
    expect(result.edgeRight).toBe(110);
    expect(result.edgeTop).toBe(115);
    expect(result.edgeLeft).toBe(start.edgeLeft);
    expect(result.edgeBottom).toBe(start.edgeBottom);
  });

  it('SW corner moves left edge and bottom edge', () => {
    const result = applyDrag(start, 'sw', -10, -5, EDGES);
    expect(result.edgeLeft).toBe(30);
    expect(result.edgeBottom).toBe(45);
    expect(result.edgeRight).toBe(start.edgeRight);
    expect(result.edgeTop).toBe(start.edgeTop);
  });

  it('SE corner moves right edge and bottom edge', () => {
    const result = applyDrag(start, 'se', 10, -5, EDGES);
    expect(result.edgeRight).toBe(110);
    expect(result.edgeBottom).toBe(45);
    expect(result.edgeLeft).toBe(start.edgeLeft);
    expect(result.edgeTop).toBe(start.edgeTop);
  });

  it('refuses to collapse a corner past the minimum-size guard', () => {
    // Drag NE corner 100 units left/down to try to invert the box.
    const result = applyDrag(start, 'ne', -100, -100, EDGES);
    expect(result.edgeRight).toBeGreaterThan(result.edgeLeft);
    expect(result.edgeTop).toBeGreaterThan(result.edgeBottom);
  });

  it('clamps a corner drag at the board edge', () => {
    const result = applyDrag(start, 'se', 1000, -1000, EDGES);
    expect(result.edgeRight).toBe(EDGES.edgeRight);
    expect(result.edgeBottom).toBe(EDGES.edgeBottom);
  });
});

describe('gridToSvg / svgToGrid', () => {
  it('round-trips a grid point through SVG space and back', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 36, y: 78 },
      { x: 144, y: 156 },
      { x: 100, y: 50 },
    ];
    for (const point of points) {
      const svg = gridToSvg(point.x, point.y, DIMS);
      const back = svgToGrid(svg.x, svg.y, DIMS);
      expect(back.x).toBeCloseTo(point.x, 6);
      expect(back.y).toBeCloseTo(point.y, 6);
    }
  });

  it('places grid origin at the bottom-left of the SVG (Y is inverted)', () => {
    const bottomLeft = gridToSvg(EDGES.edgeLeft, EDGES.edgeBottom, DIMS);
    expect(bottomLeft.x).toBe(0);
    expect(bottomLeft.y).toBe(DIMS.boardHeight);
  });

  it('places grid top-right at the top-right of the SVG', () => {
    const topRight = gridToSvg(EDGES.edgeRight, EDGES.edgeTop, DIMS);
    expect(topRight.x).toBe(DIMS.boardWidth);
    expect(topRight.y).toBe(0);
  });
});

describe('isHoldInsideZone', () => {
  // The backend filter keeps climbs whose every hold fits inside the box
  // (create-climb-filters.ts: edgeLeft >= zone.edgeLeft, etc.), so this
  // helper has to use the same inclusive-edge semantics.
  const zone = { edgeLeft: 30, edgeRight: 100, edgeBottom: 40, edgeTop: 120 };

  // BoardDetails.holdsData stores positions as { cx, cy } in SVG-pixel space
  // (see board-constants.ts). gridToSvg returns { x, y } so we adapt here.
  const holdAtGrid = (gridX: number, gridY: number, dims: BoardDimensions) => {
    const svgPoint = gridToSvg(gridX, gridY, dims);
    return { cx: svgPoint.x, cy: svgPoint.y };
  };

  it('returns true for a hold deep inside the zone', () => {
    expect(isHoldInsideZone(holdAtGrid(60, 80, DIMS), zone, DIMS)).toBe(true);
  });

  it('returns false for a hold below the zone', () => {
    expect(isHoldInsideZone(holdAtGrid(60, 20, DIMS), zone, DIMS)).toBe(false);
  });

  it('returns false for a hold left of the zone', () => {
    expect(isHoldInsideZone(holdAtGrid(10, 80, DIMS), zone, DIMS)).toBe(false);
  });

  it('returns true for a hold exactly on a zone edge (inclusive)', () => {
    expect(isHoldInsideZone(holdAtGrid(zone.edgeLeft, zone.edgeBottom, DIMS), zone, DIMS)).toBe(true);
  });

  it('handles non-zero edge offsets (e.g. mirrored layouts)', () => {
    const offsetEdges: BoardEdges = { edgeLeft: 12, edgeRight: 156, edgeBottom: 24, edgeTop: 168 };
    const offsetDims: BoardDimensions = { ...offsetEdges, boardWidth: 1080, boardHeight: 1170 };
    const offsetZone = { edgeLeft: 50, edgeRight: 130, edgeBottom: 60, edgeTop: 150 };
    expect(isHoldInsideZone(holdAtGrid(80, 100, offsetDims), offsetZone, offsetDims)).toBe(true);
    expect(isHoldInsideZone(holdAtGrid(140, 100, offsetDims), offsetZone, offsetDims)).toBe(false);
  });

  it('returns true for a null zone (no zone constraint = every hold qualifies)', () => {
    expect(isHoldInsideZone(holdAtGrid(60, 80, DIMS), null, DIMS)).toBe(true);
    // Out-of-bounds hold also passes — zone constraint only kicks in when set.
    expect(isHoldInsideZone(holdAtGrid(10, 10, DIMS), null, DIMS)).toBe(true);
  });

  it('returns true for an undefined zone (same semantics as null)', () => {
    expect(isHoldInsideZone(holdAtGrid(60, 80, DIMS), undefined, DIMS)).toBe(true);
  });
});

describe('computeHandleRadius', () => {
  it('scales with board size in the unconstrained range', () => {
    const mid: BoardDimensions = { ...EDGES, boardWidth: 500, boardHeight: 500 };
    // 500 * 0.04 = 20, inside [8, 40]
    expect(computeHandleRadius(mid)).toBe(20);
  });

  it('clamps against the upper bound on standard board renderings', () => {
    // 1170 * 0.04 = 46.8, clamps to 40
    expect(computeHandleRadius({ ...EDGES, boardWidth: 1080, boardHeight: 1170 })).toBe(40);
  });

  it('clamps against the lower bound on tiny boards', () => {
    const tiny: BoardDimensions = { ...EDGES, boardWidth: 100, boardHeight: 100 };
    expect(computeHandleRadius(tiny)).toBe(8);
  });

  it('clamps against the upper bound on enormous boards', () => {
    const huge: BoardDimensions = { ...EDGES, boardWidth: 5000, boardHeight: 5000 };
    expect(computeHandleRadius(huge)).toBe(40);
  });
});

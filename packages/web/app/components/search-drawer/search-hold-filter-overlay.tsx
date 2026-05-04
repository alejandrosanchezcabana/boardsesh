'use client';

import React, { useMemo } from 'react';
import type { BoardDetails, HoldFilterEntry, HoldFilterMode, HoldFilterType, HoldsFilter } from '@/app/lib/types';
import { HOLD_STATE_MAP } from '../board-renderer/types';

type SearchHoldFilterOverlayProps = {
  boardDetails: BoardDetails;
  holdsFilter: HoldsFilter;
};

// Order matters: outer rings first. Drawing the most-typical filters
// (STARTING / HAND / FINISH / FOOT) outward keeps the wildcard ANY rings
// nested inside so users can still see the per-type rings on top.
const TYPE_DRAW_ORDER: readonly HoldFilterType[] = ['STARTING', 'HAND', 'FINISH', 'FOOT', 'ANY'];

/**
 * Renders one or more concentric SVG circles per filtered hold so users can
 * see at a glance which holds they've included / excluded and under which
 * type. Positioned absolutely on top of the BoardRenderer SVG and sized to
 * the same viewBox so the circles align with the board image.
 *
 * All circles use `pointerEvents='none'` so the click target underneath
 * (BoardRenderer's interaction layer) keeps receiving taps — otherwise
 * excluded holds with a dim fill would swallow the un-exclude click.
 */
const SearchHoldFilterOverlay: React.FC<SearchHoldFilterOverlayProps> = ({ boardDetails, holdsFilter }) => {
  const { boardWidth, boardHeight, holdsData, board_name } = boardDetails;

  // Per-board map of hold-type → display colour, derived once from
  // HOLD_STATE_MAP (same source the picker swatches use).
  const colorByType = useMemo(() => {
    const map = new Map<HoldFilterType, string>();
    const boardMap = HOLD_STATE_MAP[board_name];
    for (const entry of Object.values(boardMap)) {
      const type = entry.name as HoldFilterType;
      if (TYPE_DRAW_ORDER.includes(type) && !map.has(type)) {
        map.set(type, entry.displayColor ?? entry.color);
      }
    }
    return map;
  }, [board_name]);

  // Build a quick lookup of (holdId → render data). Avoids O(n*m) scans when
  // walking the filter map.
  const holdsById = useMemo(() => {
    const map = new Map<number, (typeof holdsData)[number]>();
    for (const hold of holdsData) map.set(hold.id, hold);
    return map;
  }, [holdsData]);

  return (
    <svg
      viewBox={`0 0 ${boardWidth} ${boardHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {Object.entries(holdsFilter).map(([holdIdRaw, entry]) => {
        const holdId = Number(holdIdRaw);
        const hold = holdsById.get(holdId);
        if (!hold || !entry) return null;
        const filters = collectActiveFilters(entry);
        if (filters.length === 0) return null;
        return (
          <HoldFilterMarker
            key={holdId}
            cx={hold.cx}
            cy={hold.cy}
            baseRadius={hold.r}
            filters={filters}
            colorByType={colorByType}
          />
        );
      })}
    </svg>
  );
};

export default SearchHoldFilterOverlay;

type ActiveFilter = { type: HoldFilterType; mode: HoldFilterMode };

function collectActiveFilters(entry: HoldFilterEntry): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const type of TYPE_DRAW_ORDER) {
    const mode = entry[type];
    if (mode === 'include' || mode === 'exclude') out.push({ type, mode });
  }
  return out;
}

type HoldFilterMarkerProps = {
  cx: number;
  cy: number;
  baseRadius: number;
  filters: ActiveFilter[];
  colorByType: Map<HoldFilterType, string>;
};

function HoldFilterMarker({ cx, cy, baseRadius, filters, colorByType }: HoldFilterMarkerProps) {
  // Stroke width scales with hold size — wider so the rings read clearly on
  // the board image; capped at 7 to keep dense boards readable.
  const strokeWidth = Math.min(7, Math.max(4, baseRadius * 0.32));
  // Pack concentric rings *inside* the hold radius instead of bulging outward.
  // The outer ring sits at the hold's edge; each subsequent ring nests
  // inward by ~22% of baseRadius. With 5 types (Start/Mid/Finish/Foot/Any)
  // the innermost ring still has positive radius and rings never spill onto
  // neighbouring holds.
  const ringStep = baseRadius * 0.22;

  // If any filter is "exclude", we render a single dim disc behind all the
  // rings so the entire hold reads as excluded (matches the picker swatch).
  const hasExclude = filters.some((f) => f.mode === 'exclude');

  return (
    <g pointerEvents="none">
      {hasExclude && <circle cx={cx} cy={cy} r={baseRadius} fill="rgba(0, 0, 0, 0.55)" />}
      {filters.map((filter, index) => {
        const ringRadius = Math.max(strokeWidth, baseRadius - index * ringStep);
        const color = colorByType.get(filter.type) ?? '#FFFFFF';
        return (
          <circle
            key={`${filter.type}-${filter.mode}`}
            cx={cx}
            cy={cy}
            r={ringRadius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      })}
      {hasExclude && (
        // Centred X marker so excluded holds read at a glance even when the
        // ring colour is hard to see against the board image. Stroke width
        // matches the rings so the visual weight is consistent.
        <ExcludeMarker cx={cx} cy={cy} radius={baseRadius * 0.55} strokeWidth={strokeWidth} />
      )}
    </g>
  );
}

function ExcludeMarker({
  cx,
  cy,
  radius,
  strokeWidth,
}: {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
}) {
  // Use a circle-with-slash glyph (∅) in white to mirror the picker swatch.
  return (
    <g stroke="#FFFFFF" strokeWidth={strokeWidth} fill="none" strokeLinecap="round">
      <circle cx={cx} cy={cy} r={radius} />
      <line x1={cx - radius * 0.7} y1={cy + radius * 0.7} x2={cx + radius * 0.7} y2={cy - radius * 0.7} />
    </g>
  );
}

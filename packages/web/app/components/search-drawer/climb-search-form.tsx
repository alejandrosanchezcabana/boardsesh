'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { track } from '@vercel/analytics';
import MuiButton from '@mui/material/Button';
import MuiTypography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MuiTooltip from '@mui/material/Tooltip';
import LayersIcon from '@mui/icons-material/Layers';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';

import type {
  BoardDetails,
  HoldFilterEntry,
  HoldFilterMode,
  HoldFilterType,
  HoldsFilter,
  ZoneBox,
} from '@/app/lib/types';
import { useUISearchParams } from '@/app/components/queue-control/ui-searchparams-provider';
import { themeTokens } from '@/app/theme/theme-config';
import BoardRenderer from '../board-renderer/board-renderer';
import HoldTypePicker from '../create-climb/hold-type-picker';
import CreateClimbHeatmapOverlay from '../create-climb/create-climb-heatmap-overlay';
import {
  applyDrag,
  buildDefaultZone,
  computeHandleRadius,
  gridToSvg,
  isHoldInsideZone,
  svgToGrid,
  type BoardDimensions,
  type DragMode,
} from './climb-zone-math';
import { useSearchHoldPicker } from './use-search-hold-picker';
import SearchHoldFilterOverlay from './search-hold-filter-overlay';
import styles from './search-form.module.css';

type ClimbSearchFormProps = {
  boardDetails: BoardDetails;
};

// Angle is part of the URL but not the BoardDetails object, so the heatmap
// query needs to read it from the pathname (the second-to-last segment in
// the routes that mount this component).
const getAngleFromPath = (pathname: string): number => {
  const segments = pathname.split('/');
  const angle = Number(segments[segments.length - 2]);
  return Number.isFinite(angle) ? angle : 40;
};

const HANDLE_OPACITY = 0.95;
const RECT_FILL_OPACITY = 0.18;
const RECT_STROKE_OPACITY = 0.9;

const ClimbSearchForm: React.FC<ClimbSearchFormProps> = ({ boardDetails }) => {
  const { t } = useTranslation('climbs');
  const { uiSearchParams, updateFilters } = useUISearchParams();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const pathname = usePathname();
  const angle = useMemo(() => getAngleFromPath(pathname), [pathname]);

  // Shrink the click radii on the BoardRenderer so a tap lands on the visible
  // hold image rather than the generous setter-mode click circle. Same
  // rationale as the previous standalone hold form.
  const tightenedBoardDetails = useMemo(
    () => ({
      ...boardDetails,
      holdsData: boardDetails.holdsData.map((hold) => ({ ...hold, r: hold.r * 0.5 })),
    }),
    [boardDetails],
  );

  const holdsById = useMemo(() => {
    const map = new Map<number, { cx: number; cy: number }>();
    for (const hold of boardDetails.holdsData) {
      map.set(hold.id, { cx: hold.cx, cy: hold.cy });
    }
    return map;
  }, [boardDetails.holdsData]);

  const { boardWidth, boardHeight, edge_left, edge_right, edge_bottom, edge_top } = boardDetails;
  const dims = useMemo<BoardDimensions>(
    () => ({
      boardWidth,
      boardHeight,
      edgeLeft: edge_left,
      edgeRight: edge_right,
      edgeBottom: edge_bottom,
      edgeTop: edge_top,
    }),
    [boardWidth, boardHeight, edge_left, edge_right, edge_bottom, edge_top],
  );

  const defaultZone = useMemo(() => buildDefaultZone(dims), [dims]);
  const handleRadius = computeHandleRadius(dims);
  const moveHandleRadius = handleRadius * 0.6;

  // Local zone mirrors the URL param so dragging stays smooth without
  // hammering the search debounce on every pointermove.
  const [localZone, setLocalZone] = useState<ZoneBox | null>(uiSearchParams.zoneBox);
  useEffect(() => {
    setLocalZone(uiSearchParams.zoneBox);
  }, [uiSearchParams.zoneBox]);

  const zoneEnabled = localZone !== null;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    mode: DragMode;
    pointerId: number;
    startGridX: number;
    startGridY: number;
    startBox: ZoneBox;
  } | null>(null);

  const svgPointToGrid = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const screenCtm = svg.getScreenCTM();
      if (!screenCtm) return null;
      const local = point.matrixTransform(screenCtm.inverse());
      return svgToGrid(local.x, local.y, dims);
    },
    [dims],
  );

  const holdsFilter: HoldsFilter = uiSearchParams.holdsFilter || {};

  const setHoldFilter = useCallback(
    (holdId: number, type: HoldFilterType, nextMode: HoldFilterMode | undefined) => {
      const next: HoldsFilter = { ...holdsFilter };
      let entry: HoldFilterEntry = { ...next[holdId] };
      if (nextMode === undefined) {
        delete entry[type];
      } else {
        // Don't allow mixing include and exclude on the same hold — switching
        // modes wipes any previously-set entries in the other mode so the
        // hold ends up consistently include-only or exclude-only.
        const otherMode: HoldFilterMode = nextMode === 'include' ? 'exclude' : 'include';
        const conflicts = Object.entries(entry).some(([, mode]) => mode === otherMode);
        if (conflicts) {
          entry = Object.fromEntries(Object.entries(entry).filter(([, mode]) => mode !== otherMode));
        }
        entry[type] = nextMode;
      }
      if (Object.keys(entry).length === 0) {
        delete next[holdId];
      } else {
        next[holdId] = entry;
      }
      updateFilters({ holdsFilter: next });
      track('Search Hold Filter Changed', {
        type,
        mode: nextMode ?? 'unset',
        boardLayout: boardDetails.layout_name || '',
      });
    },
    [boardDetails.layout_name, holdsFilter, updateFilters],
  );

  const clearHold = useCallback(
    (holdId: number) => {
      if (!(holdId in holdsFilter)) return;
      const next: HoldsFilter = { ...holdsFilter };
      delete next[holdId];
      updateFilters({ holdsFilter: next });
      track('Search Hold Filter Cleared', { boardLayout: boardDetails.layout_name || '' });
    },
    [boardDetails.layout_name, holdsFilter, updateFilters],
  );

  const picker = useSearchHoldPicker({
    holdsFilter,
    setHoldFilter,
    clearHold,
    // Don't auto-assign on first tap — the click-target circles around each
    // hold extend slightly beyond the visible hold image, so accidental taps
    // on apparent empty space would otherwise commit unintended filters.
    autoAssignOnFirstTap: false,
  });

  // The backend zone filter requires every hold of a climb to fit inside
  // the box. So a filter-hold sitting outside the zone guarantees zero
  // matches — drop it instead of leaving the user staring at empty results.
  const pruneHoldsToZone = useCallback(
    (zone: ZoneBox): HoldsFilter => {
      const next: HoldsFilter = {};
      for (const [holdIdRaw, entry] of Object.entries(holdsFilter)) {
        const hold = holdsById.get(Number(holdIdRaw));
        if (hold && entry && isHoldInsideZone(hold, zone, dims)) {
          next[Number(holdIdRaw)] = entry;
        }
      }
      return next;
    },
    [dims, holdsById, holdsFilter],
  );

  const handleEnable = useCallback(() => {
    setLocalZone(defaultZone);
    updateFilters({ zoneBox: defaultZone, holdsFilter: pruneHoldsToZone(defaultZone) });
    track('Search Zone Enabled', { boardLayout: boardDetails.layout_name || '' });
  }, [boardDetails.layout_name, defaultZone, pruneHoldsToZone, updateFilters]);

  const handleClear = useCallback(() => {
    setLocalZone(null);
    // No zone constraint = no need to touch holdsFilter; existing filter
    // holds keep working with their hold-only semantics.
    updateFilters({ zoneBox: null });
    track('Search Zone Cleared', { boardLayout: boardDetails.layout_name || '' });
  }, [boardDetails.layout_name, updateFilters]);

  const beginDrag = useCallback(
    (mode: DragMode) => (event: React.PointerEvent<SVGElement>) => {
      if (!localZone) return;
      const grid = svgPointToGrid(event.clientX, event.clientY);
      if (!grid) return;
      event.preventDefault();
      event.stopPropagation();
      (event.target as Element).setPointerCapture?.(event.pointerId);
      dragStateRef.current = {
        mode,
        pointerId: event.pointerId,
        startGridX: grid.x,
        startGridY: grid.y,
        startBox: localZone,
      };
    },
    [localZone, svgPointToGrid],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const grid = svgPointToGrid(event.clientX, event.clientY);
      if (!grid) return;
      setLocalZone(applyDrag(drag.startBox, drag.mode, grid.x - drag.startGridX, grid.y - drag.startGridY, dims));
    },
    [dims, svgPointToGrid],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragStateRef.current = null;
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      if (localZone) {
        updateFilters({ zoneBox: localZone, holdsFilter: pruneHoldsToZone(localZone) });
        track('Search Zone Updated', {
          boardLayout: boardDetails.layout_name || '',
          width: localZone.edgeRight - localZone.edgeLeft,
          height: localZone.edgeTop - localZone.edgeBottom,
        });
      }
    },
    [boardDetails.layout_name, localZone, pruneHoldsToZone, updateFilters],
  );

  const rectSvg = useMemo(() => {
    if (!localZone) return null;
    const topLeft = gridToSvg(localZone.edgeLeft, localZone.edgeTop, dims);
    const bottomRight = gridToSvg(localZone.edgeRight, localZone.edgeBottom, dims);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
      centerX: (topLeft.x + bottomRight.x) / 2,
      centerY: (topLeft.y + bottomRight.y) / 2,
    };
  }, [dims, localZone]);

  let includeCount = 0;
  let excludeCount = 0;
  for (const entry of Object.values(holdsFilter)) {
    if (!entry) continue;
    for (const mode of Object.values(entry)) {
      if (mode === 'include') includeCount++;
      else if (mode === 'exclude') excludeCount++;
    }
  }

  return (
    <div className={styles.holdSearchForm}>
      <div className={styles.holdSearchHeaderCompact}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <MuiTypography variant="body2" component="span" color="text.secondary">
            {t('search.holds.tapToToggle')}
          </MuiTypography>
          {includeCount > 0 && (
            <Chip
              label={t('search.holds.included', { count: includeCount })}
              size="small"
              sx={{ bgcolor: themeTokens.colors.success, color: 'common.white' }}
            />
          )}
          {excludeCount > 0 && (
            <Chip
              label={t('search.holds.excluded', { count: excludeCount })}
              size="small"
              sx={{ bgcolor: themeTokens.colors.error, color: 'common.white' }}
            />
          )}
          {zoneEnabled ? (
            <MuiButton size="small" variant="outlined" onClick={handleClear}>
              {t('search.zone.clear')}
            </MuiButton>
          ) : (
            <MuiButton size="small" variant="contained" onClick={handleEnable}>
              {t('search.zone.draw')}
            </MuiButton>
          )}
          <MuiTooltip title={showHeatmap ? t('search.holds.hideHeatmap') : t('search.holds.showHeatmap')}>
            <IconButton
              size="small"
              onClick={() => {
                const next = !showHeatmap;
                setShowHeatmap(next);
                track(`Heatmap ${next ? 'Shown' : 'Hidden'}`, { boardLayout: boardDetails.layout_name || '' });
              }}
              aria-label={showHeatmap ? t('search.holds.hideHeatmap') : t('search.holds.showHeatmap')}
            >
              {showHeatmap ? <LayersIcon fontSize="small" /> : <LayersOutlinedIcon fontSize="small" />}
            </IconButton>
          </MuiTooltip>
        </Stack>
      </div>

      <div className={styles.boardContainer}>
        <BoardRenderer
          boardDetails={tightenedBoardDetails}
          litUpHoldsMap={{}}
          mirrored={false}
          onHoldClick={picker.handleHoldClick}
        />
        <SearchHoldFilterOverlay
          boardDetails={boardDetails}
          holdsFilter={holdsFilter}
          activeHoldId={picker.activeHoldId}
        />
        <CreateClimbHeatmapOverlay
          boardDetails={tightenedBoardDetails}
          angle={angle}
          litUpHoldsMap={{}}
          opacity={0.7}
          enabled={showHeatmap}
          filtersOverride={uiSearchParams}
        />
        {rectSvg && localZone && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${boardWidth} ${boardHeight}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={styles.zoneOverlaySvg}
          >
            <rect
              x={rectSvg.x}
              y={rectSvg.y}
              width={rectSvg.width}
              height={rectSvg.height}
              fill={themeTokens.colors.primary}
              fillOpacity={RECT_FILL_OPACITY}
              stroke={themeTokens.colors.primary}
              strokeOpacity={RECT_STROKE_OPACITY}
              strokeWidth={Math.max(boardWidth, boardHeight) * 0.005}
              pointerEvents="none"
            />
            {/* Centre move handle replaces dragging the rect body so holds
                under the zone fill stay tappable. */}
            <circle
              cx={rectSvg.centerX}
              cy={rectSvg.centerY}
              r={moveHandleRadius}
              fill={themeTokens.colors.primary}
              fillOpacity={HANDLE_OPACITY}
              stroke={themeTokens.neutral[50]}
              strokeWidth={moveHandleRadius * 0.25}
              onPointerDown={beginDrag('move')}
              cursor="move"
              pointerEvents="auto"
            />
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
              const handleX = corner === 'nw' || corner === 'sw' ? localZone.edgeLeft : localZone.edgeRight;
              const handleY = corner === 'nw' || corner === 'ne' ? localZone.edgeTop : localZone.edgeBottom;
              const handlePos = gridToSvg(handleX, handleY, dims);
              const cursor = corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
              return (
                <circle
                  key={corner}
                  cx={handlePos.x}
                  cy={handlePos.y}
                  r={handleRadius}
                  fill={themeTokens.colors.primary}
                  fillOpacity={HANDLE_OPACITY}
                  stroke={themeTokens.neutral[50]}
                  strokeWidth={handleRadius * 0.25}
                  onPointerDown={beginDrag(corner)}
                  cursor={cursor}
                  pointerEvents="auto"
                />
              );
            })}
          </svg>
        )}
      </div>

      <HoldTypePicker
        mode="search"
        boardName={boardDetails.board_name}
        anchorEl={picker.anchorEl}
        currentEntry={picker.currentEntry}
        onFilterChange={picker.handleFilterChange}
        onClearAll={picker.handleClearAll}
        onClose={picker.handleClose}
      />
    </div>
  );
};

export default ClimbSearchForm;

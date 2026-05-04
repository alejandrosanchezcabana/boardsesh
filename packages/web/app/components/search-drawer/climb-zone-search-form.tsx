'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MuiButton from '@mui/material/Button';
import MuiTypography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { track } from '@vercel/analytics';
import type { BoardDetails, ZoneBox } from '@/app/lib/types';
import { getImageUrl } from '../board-renderer/util';
import { useUISearchParams } from '../queue-control/ui-searchparams-provider';
import { themeTokens } from '@/app/theme/theme-config';
import styles from './search-form.module.css';

type ClimbZoneSearchFormProps = {
  boardDetails: BoardDetails;
};

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const HANDLE_FRACTION = 0.04; // handle radius as a fraction of the smaller board dimension
const HANDLE_OPACITY = 0.95;
const RECT_FILL_OPACITY = 0.18;
const RECT_STROKE_OPACITY = 0.9;

const ClimbZoneSearchForm: React.FC<ClimbZoneSearchFormProps> = ({ boardDetails }) => {
  const { t } = useTranslation('climbs');
  const { uiSearchParams, updateFilters } = useUISearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    mode: DragMode;
    pointerId: number;
    startGridX: number;
    startGridY: number;
    startBox: ZoneBox;
  } | null>(null);

  const { boardWidth, boardHeight, edge_left, edge_right, edge_bottom, edge_top } = boardDetails;

  // Default zone covers the inner 60% of the board so the user immediately
  // sees a visible rectangle they can manipulate. Stored in board grid coords
  // (matching board_climbs.edge_*).
  const defaultZone = useMemo<ZoneBox>(() => {
    const widthGrid = edge_right - edge_left;
    const heightGrid = edge_top - edge_bottom;
    const padX = Math.round(widthGrid * 0.2);
    const padY = Math.round(heightGrid * 0.2);
    return {
      edgeLeft: edge_left + padX,
      edgeRight: edge_right - padX,
      edgeBottom: edge_bottom + padY,
      edgeTop: edge_top - padY,
    };
  }, [edge_left, edge_right, edge_bottom, edge_top]);

  // Local state mirrors the URL param so dragging stays smooth without
  // hammering the search debounce on every pointermove.
  const [localZone, setLocalZone] = useState<ZoneBox | null>(uiSearchParams.zoneBox);
  // Sync local state when the URL param changes from elsewhere (e.g. clear filters).
  React.useEffect(() => {
    setLocalZone(uiSearchParams.zoneBox);
  }, [uiSearchParams.zoneBox]);

  const enabled = localZone !== null;

  // Grid → SVG transform (matches the same math used in board-constants.ts).
  const xSpacing = boardWidth / (edge_right - edge_left);
  const ySpacing = boardHeight / (edge_top - edge_bottom);
  const gridToSvgX = useCallback((x: number) => (x - edge_left) * xSpacing, [edge_left, xSpacing]);
  const gridToSvgY = useCallback(
    (y: number) => boardHeight - (y - edge_bottom) * ySpacing,
    [boardHeight, edge_bottom, ySpacing],
  );

  const svgPointToGrid = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = point.matrixTransform(ctm.inverse());
      return {
        x: local.x / xSpacing + edge_left,
        y: edge_bottom + (boardHeight - local.y) / ySpacing,
      };
    },
    [boardHeight, edge_bottom, edge_left, xSpacing, ySpacing],
  );

  const clampBox = useCallback(
    (box: ZoneBox): ZoneBox => {
      const minWidth = Math.max(1, Math.round((edge_right - edge_left) * 0.05));
      const minHeight = Math.max(1, Math.round((edge_top - edge_bottom) * 0.05));
      let { edgeLeft: l, edgeRight: r, edgeBottom: b, edgeTop: tEdge } = box;
      l = Math.max(edge_left, Math.min(l, edge_right - minWidth));
      r = Math.min(edge_right, Math.max(r, l + minWidth));
      b = Math.max(edge_bottom, Math.min(b, edge_top - minHeight));
      tEdge = Math.min(edge_top, Math.max(tEdge, b + minHeight));
      return {
        edgeLeft: Math.round(l),
        edgeRight: Math.round(r),
        edgeBottom: Math.round(b),
        edgeTop: Math.round(tEdge),
      };
    },
    [edge_bottom, edge_left, edge_right, edge_top],
  );

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
      const dx = grid.x - drag.startGridX;
      const dy = grid.y - drag.startGridY;
      const start = drag.startBox;
      let next = { ...start };
      if (drag.mode === 'move') {
        next = {
          edgeLeft: start.edgeLeft + dx,
          edgeRight: start.edgeRight + dx,
          edgeBottom: start.edgeBottom + dy,
          edgeTop: start.edgeTop + dy,
        };
        const widthGrid = start.edgeRight - start.edgeLeft;
        const heightGrid = start.edgeTop - start.edgeBottom;
        if (next.edgeLeft < edge_left) {
          next.edgeLeft = edge_left;
          next.edgeRight = edge_left + widthGrid;
        }
        if (next.edgeRight > edge_right) {
          next.edgeRight = edge_right;
          next.edgeLeft = edge_right - widthGrid;
        }
        if (next.edgeBottom < edge_bottom) {
          next.edgeBottom = edge_bottom;
          next.edgeTop = edge_bottom + heightGrid;
        }
        if (next.edgeTop > edge_top) {
          next.edgeTop = edge_top;
          next.edgeBottom = edge_top - heightGrid;
        }
      } else {
        if (drag.mode === 'nw' || drag.mode === 'sw') next.edgeLeft = start.edgeLeft + dx;
        if (drag.mode === 'ne' || drag.mode === 'se') next.edgeRight = start.edgeRight + dx;
        // Screen-space "top" (visually upper) corresponds to higher edgeTop, lower visually = edgeBottom.
        if (drag.mode === 'nw' || drag.mode === 'ne') next.edgeTop = start.edgeTop + dy;
        if (drag.mode === 'sw' || drag.mode === 'se') next.edgeBottom = start.edgeBottom + dy;
      }
      setLocalZone(clampBox(next));
    },
    [clampBox, edge_bottom, edge_left, edge_right, edge_top, svgPointToGrid],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const drag = dragStateRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragStateRef.current = null;
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      if (localZone) {
        updateFilters({ zoneBox: localZone });
        track('Search Zone Updated', {
          boardLayout: boardDetails.layout_name || '',
          width: localZone.edgeRight - localZone.edgeLeft,
          height: localZone.edgeTop - localZone.edgeBottom,
        });
      }
    },
    [boardDetails.layout_name, localZone, updateFilters],
  );

  const handleEnable = () => {
    setLocalZone(defaultZone);
    updateFilters({ zoneBox: defaultZone });
    track('Search Zone Enabled', { boardLayout: boardDetails.layout_name || '' });
  };

  const handleClear = () => {
    setLocalZone(null);
    updateFilters({ zoneBox: null });
    track('Search Zone Cleared', { boardLayout: boardDetails.layout_name || '' });
  };

  const rectSvg = useMemo(() => {
    if (!localZone) return null;
    const x = gridToSvgX(localZone.edgeLeft);
    const y = gridToSvgY(localZone.edgeTop); // top of rect = max edgeTop
    const width = gridToSvgX(localZone.edgeRight) - x;
    const height = gridToSvgY(localZone.edgeBottom) - y;
    return { x, y, width, height };
  }, [gridToSvgX, gridToSvgY, localZone]);

  const handleRadius = Math.max(boardWidth, boardHeight) * HANDLE_FRACTION;

  return (
    <div className={styles.holdSearchForm}>
      <div className={styles.holdSearchHeaderCompact}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <MuiTypography variant="body2" component="span" color="text.secondary">
            {t('search.zone.description')}
          </MuiTypography>
          {enabled ? (
            <MuiButton size="small" variant="outlined" onClick={handleClear}>
              {t('search.zone.clear')}
            </MuiButton>
          ) : (
            <MuiButton size="small" variant="contained" onClick={handleEnable}>
              {t('search.zone.draw')}
            </MuiButton>
          )}
        </Stack>
      </div>

      <div className={styles.boardContainer}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${boardWidth} ${boardHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ width: '100%', height: 'auto', maxHeight: '55vh', touchAction: 'none' }}
        >
          {Object.keys(boardDetails.images_to_holds).map((imageUrl) => (
            <image
              key={imageUrl}
              href={getImageUrl(imageUrl, boardDetails.board_name)}
              width={boardWidth}
              height={boardHeight}
              preserveAspectRatio="none"
            />
          ))}

          {rectSvg && (
            <g>
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
                onPointerDown={beginDrag('move')}
                style={{ cursor: 'move' }}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                const cx =
                  corner === 'nw' || corner === 'sw'
                    ? gridToSvgX(localZone!.edgeLeft)
                    : gridToSvgX(localZone!.edgeRight);
                const cy =
                  corner === 'nw' || corner === 'ne'
                    ? gridToSvgY(localZone!.edgeTop)
                    : gridToSvgY(localZone!.edgeBottom);
                const cursor = corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
                return (
                  <circle
                    key={corner}
                    cx={cx}
                    cy={cy}
                    r={handleRadius}
                    fill={themeTokens.colors.primary}
                    fillOpacity={HANDLE_OPACITY}
                    stroke="#fff"
                    strokeWidth={handleRadius * 0.25}
                    onPointerDown={beginDrag(corner)}
                    style={{ cursor }}
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default ClimbZoneSearchForm;

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
import {
  applyDrag,
  buildDefaultZone,
  computeHandleRadius,
  gridToSvg,
  svgToGrid,
  type BoardDimensions,
  type DragMode,
} from './climb-zone-math';
import styles from './search-form.module.css';

type ClimbZoneSearchFormProps = {
  boardDetails: BoardDetails;
};

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

  // Local state mirrors the URL param so dragging stays smooth without
  // hammering the search debounce on every pointermove.
  const [localZone, setLocalZone] = useState<ZoneBox | null>(uiSearchParams.zoneBox);
  // Sync local state when the URL param changes from elsewhere (e.g. clear filters).
  React.useEffect(() => {
    setLocalZone(uiSearchParams.zoneBox);
  }, [uiSearchParams.zoneBox]);

  const enabled = localZone !== null;

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
      return svgToGrid(local.x, local.y, dims);
    },
    [dims],
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
    const topLeft = gridToSvg(localZone.edgeLeft, localZone.edgeTop, dims);
    const bottomRight = gridToSvg(localZone.edgeRight, localZone.edgeBottom, dims);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [dims, localZone]);

  const handleRadius = computeHandleRadius(dims);

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
          className={styles.zoneSvg}
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

          {rectSvg && localZone && (
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
                cursor="move"
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                const handleX =
                  corner === 'nw' || corner === 'sw' ? localZone.edgeLeft : localZone.edgeRight;
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

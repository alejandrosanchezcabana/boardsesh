'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { BoardDetails, HoldFilterEntry, HoldFilterMode, HoldFilterType, HoldsFilter } from '@/app/lib/types';
import { useUISearchParams } from '@/app/components/queue-control/ui-searchparams-provider';
import MuiTypography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MuiTooltip from '@mui/material/Tooltip';
import LayersIcon from '@mui/icons-material/Layers';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { track } from '@vercel/analytics';
import { useTranslation } from 'react-i18next';
import { themeTokens } from '@/app/theme/theme-config';
import BoardRenderer from '../board-renderer/board-renderer';
import HoldTypePicker from '../create-climb/hold-type-picker';
import CreateClimbHeatmapOverlay from '../create-climb/create-climb-heatmap-overlay';
import { useSearchHoldPicker } from './use-search-hold-picker';
import SearchHoldFilterOverlay from './search-hold-filter-overlay';
import styles from './search-form.module.css';

type ClimbHoldSearchFormProps = {
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

const ClimbHoldSearchForm: React.FC<ClimbHoldSearchFormProps> = ({ boardDetails }) => {
  const { t } = useTranslation('climbs');
  const { uiSearchParams, updateFilters } = useUISearchParams();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const pathname = usePathname();
  const angle = useMemo(() => getAngleFromPath(pathname), [pathname]);

  const holdsFilter: HoldsFilter = uiSearchParams.holdsFilter || {};

  const setHoldFilter = useCallback(
    (holdId: number, type: HoldFilterType, nextMode: HoldFilterMode | undefined) => {
      const next: HoldsFilter = { ...holdsFilter };
      const existing: HoldFilterEntry = { ...next[holdId] };
      if (nextMode === undefined) {
        delete existing[type];
      } else {
        existing[type] = nextMode;
      }
      if (Object.keys(existing).length === 0) {
        delete next[holdId];
      } else {
        next[holdId] = existing;
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
    // on apparent empty space would otherwise commit unintended filters. The
    // popover opens with no commitment; the user explicitly picks a swatch
    // to add a filter, or dismisses the popover to back out.
    autoAssignOnFirstTap: false,
  });

  // Tally include / exclude across all (hold, type) pairs so the chip count
  // reflects total filters, not just hold count. A hold with both
  // `STARTING:include` and `FOOT:exclude` contributes one to each total.
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
          boardDetails={boardDetails}
          // Pass empty map — the search overlay handles its own rendering on
          // top, and BoardRenderer will still draw transparent click-target
          // circles because onHoldClick is wired.
          litUpHoldsMap={{}}
          mirrored={false}
          onHoldClick={picker.handleHoldClick}
        />
        <SearchHoldFilterOverlay boardDetails={boardDetails} holdsFilter={holdsFilter} />
        <CreateClimbHeatmapOverlay
          boardDetails={boardDetails}
          angle={angle}
          litUpHoldsMap={{}}
          opacity={0.7}
          enabled={showHeatmap}
          filtersOverride={uiSearchParams}
        />
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

export default ClimbHoldSearchForm;

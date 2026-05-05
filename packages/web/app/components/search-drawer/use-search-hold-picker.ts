'use client';

import { useCallback, useRef, useState } from 'react';
import type { HoldsFilter, HoldFilterEntry, HoldFilterMode, HoldFilterType } from '@/app/lib/types';

type AnchorState = {
  holdId: number;
  anchor: Element;
};

type UseSearchHoldPickerOptions = {
  holdsFilter: HoldsFilter;
  // Update one type's mode for the given hold. `nextMode === undefined`
  // removes that type from the entry; an empty entry removes the hold from
  // the filter map entirely. The search form's own setter knows how to
  // do the immutability dance against `uiSearchParams.holdsFilter`.
  setHoldFilter: (holdId: number, type: HoldFilterType, nextMode: HoldFilterMode | undefined) => void;
  // Drop every type filter on the given hold (the picker's Clear button).
  clearHold: (holdId: number) => void;
  // First-tap behaviour. The default ('ANY' include) gives immediate visual
  // confirmation that the hold has been selected; pass false to skip and
  // let the picker open with no commitment yet.
  autoAssignOnFirstTap?: { type: HoldFilterType; mode: HoldFilterMode } | false;
};

/**
 * State plumbing for the search-mode HoldTypePicker. Tracks which hold the
 * user just tapped, the DOM element to anchor the popover against, and the
 * current per-hold filter entry so the picker can render the right swatches.
 *
 * Mirrors `useHoldTypePicker` (used by the setter) but with a multi-filter
 * data shape — search lets a single hold carry several type filters, while
 * the setter is one-state-per-hold.
 */
export function useSearchHoldPicker({
  holdsFilter,
  setHoldFilter,
  clearHold,
  autoAssignOnFirstTap = { type: 'ANY', mode: 'include' },
}: UseSearchHoldPickerOptions) {
  const [anchorState, setAnchorState] = useState<AnchorState | null>(null);

  const filterRef = useRef(holdsFilter);
  filterRef.current = holdsFilter;

  const handleHoldClick = useCallback(
    (holdId: number, anchor: Element) => {
      const existing = filterRef.current[holdId];
      const isBlank = !existing || Object.keys(existing).length === 0;
      if (isBlank && autoAssignOnFirstTap) {
        setHoldFilter(holdId, autoAssignOnFirstTap.type, autoAssignOnFirstTap.mode);
      }
      setAnchorState({ holdId, anchor });
    },
    [autoAssignOnFirstTap, setHoldFilter],
  );

  const handleFilterChange = useCallback(
    (type: HoldFilterType, nextMode: HoldFilterMode | undefined) => {
      if (!anchorState) return;
      setHoldFilter(anchorState.holdId, type, nextMode);
    },
    [anchorState, setHoldFilter],
  );

  const handleClearAll = useCallback(() => {
    if (!anchorState) return;
    clearHold(anchorState.holdId);
  }, [anchorState, clearHold]);

  const handleClose = useCallback(() => {
    setAnchorState(null);
  }, []);

  const currentEntry: HoldFilterEntry = anchorState ? (holdsFilter[anchorState.holdId] ?? {}) : {};

  return {
    anchorEl: anchorState?.anchor ?? null,
    activeHoldId: anchorState?.holdId ?? null,
    currentEntry,
    handleHoldClick,
    handleFilterChange,
    handleClearAll,
    handleClose,
  };
}

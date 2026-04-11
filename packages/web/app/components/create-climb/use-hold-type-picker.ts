import { useCallback, useState } from 'react';
import type { HoldState, LitUpHoldsMap } from '../board-renderer/types';

export type PickerSelection = HoldState | 'OFF';

interface PickerState {
  holdId: number;
  anchor: Element;
}

interface UseHoldTypePickerOptions {
  litUpHoldsMap: LitUpHoldsMap;
  setHoldState: (holdId: number, state: PickerSelection) => void;
}

/**
 * Shared state plumbing for the HoldTypePicker. Tracks which hold the user
 * just tapped (and the DOM element to anchor the popover against), and wires
 * the picker's `onSelect` / `onClose` callbacks back to the create-climb hook
 * so they don't have to be re-implemented per consumer.
 */
export function useHoldTypePicker({ litUpHoldsMap, setHoldState }: UseHoldTypePickerOptions) {
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

  const handleHoldClick = useCallback((holdId: number, anchor: Element) => {
    setPickerState({ holdId, anchor });
  }, []);

  const handleSelect = useCallback(
    (state: PickerSelection) => {
      if (!pickerState) return;
      setHoldState(pickerState.holdId, state);
      setPickerState(null);
    },
    [pickerState, setHoldState],
  );

  const handleClose = useCallback(() => {
    setPickerState(null);
  }, []);

  const currentState: PickerSelection = pickerState
    ? litUpHoldsMap[pickerState.holdId]?.state ?? 'OFF'
    : 'OFF';

  return {
    anchorEl: pickerState?.anchor ?? null,
    currentState,
    handleHoldClick,
    handleSelect,
    handleClose,
  };
}

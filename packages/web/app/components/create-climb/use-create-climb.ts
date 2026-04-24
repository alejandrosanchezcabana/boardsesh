'use client';

import { useState, useCallback, useMemo } from 'react';
import type { LitUpHoldsMap, HoldState } from '../board-renderer/types';
import { HOLD_STATE_MAP, STATE_TO_PRIMARY_CODE } from '../board-renderer/types';
import type { BoardName } from '@/app/lib/types';

type UseCreateClimbOptions = {
  initialHoldsMap?: LitUpHoldsMap;
};

export function useCreateClimb(boardName: BoardName, options?: UseCreateClimbOptions) {
  const [litUpHoldsMap, setLitUpHoldsMap] = useState<LitUpHoldsMap>(options?.initialHoldsMap ?? {});

  // Derived state: count holds by type
  const startingCount = useMemo(
    () => Object.values(litUpHoldsMap).filter((h) => h.state === 'STARTING').length,
    [litUpHoldsMap],
  );

  const finishCount = useMemo(
    () => Object.values(litUpHoldsMap).filter((h) => h.state === 'FINISH').length,
    [litUpHoldsMap],
  );

  const totalHolds = useMemo(
    () => Object.values(litUpHoldsMap).filter((h) => h.state !== 'OFF').length,
    [litUpHoldsMap],
  );

  const isValid = totalHolds > 0;

  const setHoldState = useCallback(
    (holdId: number, nextState: HoldState | 'OFF') => {
      setLitUpHoldsMap((prev) => {
        // Clearing a hold removes it from the map.
        if (nextState === 'OFF') {
          if (!(holdId in prev)) return prev;
          const { [holdId]: _removed, ...rest } = prev;
          void _removed;
          return rest;
        }

        // Enforce max-2 STARTING / FINISH limits as a safety net — the picker
        // already disables these options when at the cap.
        const currentHold = prev[holdId];
        const isAlreadyThisState = currentHold?.state === nextState;
        if (!isAlreadyThisState) {
          if (nextState === 'STARTING') {
            const startingCount = Object.values(prev).filter((h) => h.state === 'STARTING').length;
            if (startingCount >= 2) return prev;
          }
          if (nextState === 'FINISH') {
            const finishCount = Object.values(prev).filter((h) => h.state === 'FINISH').length;
            if (finishCount >= 2) return prev;
          }
        }

        const stateCode = STATE_TO_PRIMARY_CODE[boardName][nextState];
        if (stateCode === undefined) {
          return prev;
        }

        const holdInfo = HOLD_STATE_MAP[boardName][stateCode];
        if (!holdInfo) {
          return prev;
        }

        return {
          ...prev,
          [holdId]: {
            state: nextState,
            color: holdInfo.color,
            displayColor: holdInfo.displayColor || holdInfo.color,
          },
        };
      });
    },
    [boardName],
  );

  // Generate frames string in Aurora format: p{holdId}r{stateCode}p{holdId}r{stateCode}...
  const generateFramesString = useCallback(() => {
    const stateToCode = STATE_TO_PRIMARY_CODE[boardName];
    return Object.entries(litUpHoldsMap)
      .filter(([, hold]) => hold.state !== 'OFF')
      .map(([holdId, hold]) => {
        const code = stateToCode[hold.state];
        return `p${holdId}r${code}`;
      })
      .join('');
  }, [litUpHoldsMap, boardName]);

  // Reset all holds
  const resetHolds = useCallback(() => {
    setLitUpHoldsMap({});
  }, []);

  // Replace the entire holds map in one shot (used when loading a draft back into the form).
  const loadHolds = useCallback((next: LitUpHoldsMap) => {
    setLitUpHoldsMap(next);
  }, []);

  return {
    litUpHoldsMap,
    setHoldState,
    generateFramesString,
    startingCount,
    finishCount,
    totalHolds,
    isValid,
    resetHolds,
    loadHolds,
  };
}

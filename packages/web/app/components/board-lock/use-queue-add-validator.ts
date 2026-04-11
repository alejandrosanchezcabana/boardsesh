'use client';

import { useCallback } from 'react';
import type { Climb, BoardDetails } from '@/app/lib/types';
import { canAddClimbToBoard } from '@/app/lib/board-compatibility';
import { useActiveBoardLock } from './use-active-board-lock';
import { useQueueBridgeBoardInfo } from '../queue-control/queue-bridge-context';
import { useSnackbar } from '../providers/snackbar-provider';

function formatBoardName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatClimbBoardName(climb: Climb): string {
  if (climb.boardType) return formatBoardName(climb.boardType);
  return 'a different board';
}

function sizeLabel(target: BoardDetails): string {
  if (target.size_name) return target.size_name;
  return `${formatBoardName(target.board_name)} board`;
}

/**
 * Returns a validator that checks whether a climb can be added to the
 * user's currently-anchored queue. If the climb isn't compatible, a
 * Snackbar error is surfaced and the validator returns `false` so the
 * caller can short-circuit.
 *
 * The validation target prefers the active session / Bluetooth lock,
 * then falls back to the local queue's board details. When neither is
 * present, all adds are allowed.
 */
export function useQueueAddValidator(): (climb: Climb) => boolean {
  const { lockedBoard } = useActiveBoardLock();
  const { boardDetails: fallbackBoard } = useQueueBridgeBoardInfo();
  const { showMessage } = useSnackbar();

  return useCallback(
    (climb: Climb) => {
      const target = lockedBoard ?? fallbackBoard;
      if (!target) return true;
      const result = canAddClimbToBoard(climb, target);
      if (result.ok) return true;

      const targetBoardLabel = formatBoardName(target.board_name);
      switch (result.reason) {
        case 'board_name':
          showMessage(
            `That climb is set on ${formatClimbBoardName(climb)}. Your queue is on ${targetBoardLabel}.`,
            'error',
          );
          break;
        case 'layout':
          showMessage(
            `That climb is on a different ${targetBoardLabel} layout.`,
            'error',
          );
          break;
        case 'holds_out_of_range':
          showMessage(
            `That climb uses holds your ${sizeLabel(target)} doesn't have.`,
            'error',
          );
          break;
      }
      return false;
    },
    [lockedBoard, fallbackBoard, showMessage],
  );
}

'use client';

import { useCallback } from 'react';
import type { BoardDetails, BoardRouteIdentity } from '@/app/lib/types';
import { useActiveBoardLock } from './use-active-board-lock';
import { useBoardSwitchConfirm } from './board-switch-confirm-provider';
import { disconnectAllBluetooth } from '../board-bluetooth-control/bluetooth-status-store';

function isSameBoard(
  a: BoardDetails | BoardRouteIdentity,
  b: BoardDetails | BoardRouteIdentity,
): boolean {
  // set_ids intentionally excluded: changing hold sets is a minor config
  // change that does not warrant a board-switch confirmation.
  return (
    a.board_name === b.board_name &&
    a.layout_id === b.layout_id &&
    a.size_id === b.size_id
  );
}

export type BoardSwitchTarget = BoardDetails | BoardRouteIdentity;

/**
 * Returns a function that intercepts a primary-board switch. If the user
 * has an active session or a live Bluetooth connection AND the target
 * board is different, a confirmation dialog is shown. On confirm,
 * Bluetooth is disconnected (session is left alone) and `onConfirmed` is
 * invoked. Otherwise `onConfirmed` runs immediately.
 */
export function useBoardSwitchGuard(): (target: BoardSwitchTarget, onConfirmed: () => void) => void {
  const { lockedBoard, reason } = useActiveBoardLock();
  const confirmCtx = useBoardSwitchConfirm();

  return useCallback(
    (target, onConfirmed) => {
      if (!lockedBoard || !reason) {
        onConfirmed();
        return;
      }
      if (isSameBoard(lockedBoard, target)) {
        onConfirmed();
        return;
      }
      // No provider mounted (tests, isolated component rendering). Fall
      // back to an immediate call-through rather than crashing.
      if (!confirmCtx) {
        onConfirmed();
        return;
      }
      confirmCtx.confirmBoardSwitch({
        reason,
        lockedBoard,
        target,
        onConfirmed: () => {
          // Always drop any live Bluetooth connections so the board
          // stops receiving frames for hardware it's not wired to.
          // Session is intentionally left alive so the future
          // multi-board session path can continue to work.
          disconnectAllBluetooth();
          onConfirmed();
        },
      });
    },
    [lockedBoard, reason, confirmCtx],
  );
}

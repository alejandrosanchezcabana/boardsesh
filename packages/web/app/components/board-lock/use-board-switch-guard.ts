'use client';

import { useCallback } from 'react';
import type { BoardDetails, BoardRouteIdentity } from '@/app/lib/types';
import { useActiveBoardLock } from './use-active-board-lock';
import { useBoardSwitchConfirm } from './board-switch-confirm-provider';
import { disconnectAllBluetooth } from '../board-bluetooth-control/bluetooth-status-store';

function sameSetIds(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

function isSameBoard(
  a: BoardDetails | BoardRouteIdentity,
  b: BoardDetails | BoardRouteIdentity,
): boolean {
  return (
    a.board_name === b.board_name &&
    a.layout_id === b.layout_id &&
    a.size_id === b.size_id &&
    sameSetIds(a.set_ids, b.set_ids)
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

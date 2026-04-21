"use client";

import { useCallback } from "react";
import type { Climb } from "@/app/lib/types";
import { canAddClimbToBoard } from "@/app/lib/board-compatibility";
import { useActiveBoardLock } from "./use-active-board-lock";
import { useQueueBridgeBoardInfo } from "../queue-control/queue-bridge-context";
import { useSnackbar } from "../providers/snackbar-provider";
import { queueAddErrorMessage } from "./queue-add-error-messages";

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
      showMessage(queueAddErrorMessage(climb, target, result), "error");
      return false;
    },
    [lockedBoard, fallbackBoard, showMessage],
  );
}

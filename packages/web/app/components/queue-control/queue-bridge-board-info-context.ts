'use client';

import { createContext, useContext } from 'react';
import type { Angle, BoardDetails } from '@/app/lib/types';

export type QueueBridgeBoardInfo = {
  boardDetails: BoardDetails | null;
  angle: Angle;
  hasActiveQueue: boolean;
  /**
   * True once the persistent session has finished restoring from IndexedDB
   * (or immediately when a board-route injector is active). Consumers that
   * want to read `hasActiveQueue`/`boardDetails` on mount must wait for this
   * flag — otherwise they race the async restore and see stale defaults.
   */
  isHydrated: boolean;
};

export const QueueBridgeBoardInfoContext = createContext<QueueBridgeBoardInfo>({
  boardDetails: null,
  angle: 0,
  hasActiveQueue: false,
  isHydrated: false,
});

export function useQueueBridgeBoardInfo() {
  return useContext(QueueBridgeBoardInfoContext);
}

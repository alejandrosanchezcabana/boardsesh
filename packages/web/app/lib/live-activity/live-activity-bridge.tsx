'use client';

import { useLiveActivity } from './use-live-activity';
import type { ClimbQueueItem } from '@/app/components/queue-control/types';
import type { BoardDetails } from '../types';

interface LiveActivityBridgeProps {
  queue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
  boardDetails: BoardDetails | null;
  sessionId: string | null;
  isSessionActive: boolean;
}

export default function LiveActivityBridge(props: LiveActivityBridgeProps) {
  useLiveActivity(props);
  return null;
}

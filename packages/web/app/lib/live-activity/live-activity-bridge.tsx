'use client';

import { useEffect, useRef } from 'react';
import { useLiveActivity } from './use-live-activity';
import { isNativeApp, getPlatform } from '../ble/capacitor-utils';
import type { ClimbQueueItem } from '@/app/components/queue-control/types';
import type { BoardDetails } from '../types';

interface LiveActivityBridgeProps {
  queue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
  boardDetails: BoardDetails | null;
  sessionId: string | null;
  isSessionActive: boolean;
  onSetCurrentClimb?: (item: ClimbQueueItem) => void;
  /** Called when a widget navigation includes a correlationId (party mode optimistic path). */
  onWidgetNavigate?: (item: ClimbQueueItem, correlationId: string) => void;
}

export default function LiveActivityBridge({
  onSetCurrentClimb,
  onWidgetNavigate,
  ...props
}: LiveActivityBridgeProps) {
  useLiveActivity(props);

  // Listen for widget next/previous button taps and navigate the queue.
  const queueRef = useRef(props.queue);
  queueRef.current = props.queue;
  const onSetCurrentClimbRef = useRef(onSetCurrentClimb);
  onSetCurrentClimbRef.current = onSetCurrentClimb;
  const onWidgetNavigateRef = useRef(onWidgetNavigate);
  onWidgetNavigateRef.current = onWidgetNavigate;

  useEffect(() => {
    if (!isNativeApp() || getPlatform() !== 'ios') return;
    const plugin = window.Capacitor?.Plugins?.LiveActivity;
    if (!plugin?.addListener) return;

    const handle = plugin.addListener('queueNavigate', (data: Record<string, unknown>) => {
      const currentIndex = data.currentIndex as number;
      const correlationId = data.correlationId as string | undefined;
      const queue = queueRef.current;
      if (currentIndex < 0 || currentIndex >= queue.length) return;

      const item = queue[currentIndex];

      // If we have a correlationId and the optimistic handler, use it.
      // This dispatches directly to the reducer without sending a JS mutation
      // (the native WebSocket already sent the server mutation).
      if (correlationId && onWidgetNavigateRef.current) {
        onWidgetNavigateRef.current(item, correlationId);
        return;
      }

      // Fallback: solo mode or no correlationId.
      onSetCurrentClimbRef.current?.(item);
    });

    // addListener may return a Promise or a handle directly depending on Capacitor version.
    // Use a cleaned-up flag to handle the case where cleanup runs before a Promise resolves.
    let cleaned = false;
    const removeRef: { remove?: () => void } = {};
    const applyHandle = (h: { remove: () => void }) => {
      if (cleaned) { h.remove(); } else { removeRef.remove = h.remove; }
    };
    if (handle && typeof (handle as { remove?: () => void }).remove === 'function') {
      applyHandle(handle as { remove: () => void });
    } else if (handle && typeof (handle as Promise<{ remove: () => void }>).then === 'function') {
      (handle as Promise<{ remove: () => void }>).then(applyHandle);
    }

    return () => {
      cleaned = true;
      removeRef.remove?.();
    };
  }, []);

  return null;
}

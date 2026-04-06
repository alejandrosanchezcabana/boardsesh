'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isNativeApp, getPlatform } from '../ble/capacitor-utils';
import {
  startLiveActivitySession,
  endLiveActivitySession,
  updateLiveActivity,
  updateLiveActivityClimb,
  isLiveActivityAvailable,
} from './live-activity-plugin';
import { getBackendWsUrl } from '../backend-url';
import type { ClimbQueueItem } from '@/app/components/queue-control/types';
import type { BoardDetails } from '../types';

interface UseLiveActivityOptions {
  queue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
  boardDetails: BoardDetails | null;
  sessionId: string | null;
  isSessionActive: boolean;
}

export function useLiveActivity({
  queue,
  currentClimbQueueItem,
  boardDetails,
  sessionId,
  isSessionActive,
}: UseLiveActivityOptions): void {
  const isActiveRef = useRef(false);
  const generationRef = useRef(0);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Keep refs for values the start callback needs without triggering restarts
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentClimbRef = useRef(currentClimbQueueItem);
  currentClimbRef.current = currentClimbQueueItem;

  // Memoize queue serialization so it only recomputes when the queue array changes,
  // not on every currentClimbQueueItem navigation.
  const serializedQueue = useMemo(
    () =>
      queue.map((q) => ({
        uuid: q.uuid,
        climbUuid: q.climb.uuid,
        climbName: q.climb.name,
        difficulty: q.climb.difficulty,
        angle: q.climb.angle,
        frames: q.climb.frames,
        setterUsername: q.climb.setter_username,
      })),
    [queue],
  );
  const serializedQueueRef = useRef(serializedQueue);
  serializedQueueRef.current = serializedQueue;

  // Stabilize boardDetails by value so reference changes don't restart the session
  const boardKey = boardDetails
    ? `${boardDetails.board_name}:${boardDetails.layout_id}:${boardDetails.size_id}:${Array.isArray(boardDetails.set_ids) ? boardDetails.set_ids.join(',') : boardDetails.set_ids}`
    : null;
  const stableBoardDetails = useMemo(() => boardDetails, [boardKey]);

  // Check availability once
  useEffect(() => {
    if (!isNativeApp() || getPlatform() !== 'ios') return;
    let cancelled = false;
    isLiveActivityAvailable().then((result) => {
      if (!cancelled) setAvailable(result);
    });
    return () => { cancelled = true; };
  }, []);

  // Start/end session — reacts to session activation, content presence, and board config.
  // Does NOT restart when the current climb changes.
  const hasContent = queue.length > 0 || currentClimbQueueItem !== null;
  const shouldBeActive = isSessionActive && hasContent && stableBoardDetails !== null && available === true;

  useEffect(() => {
    if (!isNativeApp() || getPlatform() !== 'ios') return;
    if (!available) return;

    if (shouldBeActive && !isActiveRef.current && stableBoardDetails) {
      const serverUrl = typeof window !== 'undefined' ? window.location.origin : '';

      isActiveRef.current = true;
      const startGeneration = ++generationRef.current;

      startLiveActivitySession({
        sessionId: sessionIdRef.current ?? `local-${Date.now()}`,
        serverUrl,
        wsUrl: getBackendWsUrl() ?? undefined,
        boardName: stableBoardDetails.board_name,
        layoutId: stableBoardDetails.layout_id,
        sizeId: stableBoardDetails.size_id,
        setIds: Array.isArray(stableBoardDetails.set_ids) ? stableBoardDetails.set_ids.join(',') : String(stableBoardDetails.set_ids),
      }).then(() => {
        if (!isActiveRef.current || generationRef.current !== startGeneration) return;
        // Send an initial update so the widget doesn't stay on "Loading...".
        const q = queueRef.current;
        const displayItem = currentClimbRef.current ?? (q.length > 0 ? q[0] : null);
        if (!displayItem) return;
        const idx = q.findIndex((item) => item.uuid === displayItem.uuid);
        if (idx === -1) return;
        updateLiveActivity({
          climbName: displayItem.climb.name,
          climbDifficulty: displayItem.climb.difficulty,
          angle: displayItem.climb.angle,
          currentIndex: idx,
          totalClimbs: q.length,
          hasNext: idx < q.length - 1,
          hasPrevious: idx > 0,
          climbUuid: displayItem.climb.uuid,
          queue: serializedQueueRef.current,
        });
      });
    } else if (!shouldBeActive && isActiveRef.current) {
      endLiveActivitySession();
      isActiveRef.current = false;
    }

    return () => {
      if (isActiveRef.current) {
        endLiveActivitySession();
        isActiveRef.current = false;
      }
    };
  }, [shouldBeActive, stableBoardDetails, available]);

  // Track whether the queue-sync effect fired this render cycle so the
  // climb-nav effect can skip its redundant lightweight update.
  const queueSyncedRef = useRef(false);

  // Effect 1: Queue sync — sends the full queue when items change (add/remove/reorder).
  // Only depends on serializedQueue, not currentClimbQueueItem.
  useEffect(() => {
    if (!isActiveRef.current || !stableBoardDetails) return;

    const displayItem = currentClimbRef.current ?? (queueRef.current.length > 0 ? queueRef.current[0] : null);
    if (!displayItem) return;

    const currentIndex = queueRef.current.findIndex((q) => q.uuid === displayItem.uuid);
    if (currentIndex === -1) return;

    // Mark that we already sent a full update this cycle.
    queueSyncedRef.current = true;
    // Reset on next microtask so the climb-nav effect (same render) sees it,
    // but future renders start clean.
    queueMicrotask(() => { queueSyncedRef.current = false; });

    updateLiveActivity({
      climbName: displayItem.climb.name,
      climbDifficulty: displayItem.climb.difficulty,
      angle: displayItem.climb.angle,
      currentIndex,
      totalClimbs: queueRef.current.length,
      hasNext: currentIndex < queueRef.current.length - 1,
      hasPrevious: currentIndex > 0,
      climbUuid: displayItem.climb.uuid,
      queue: serializedQueue,
    });
  }, [serializedQueue, stableBoardDetails]);

  // Effect 2: Climb navigation — lightweight update with only scalar data.
  // Fires when the current climb changes without a queue change.
  useEffect(() => {
    if (!isActiveRef.current || !stableBoardDetails) return;
    // Skip if the queue-sync effect already sent a full update this cycle.
    if (queueSyncedRef.current) return;

    const displayItem = currentClimbQueueItem ?? (queue.length > 0 ? queue[0] : null);
    if (!displayItem) return;

    const currentIndex = queue.findIndex((q) => q.uuid === displayItem.uuid);
    if (currentIndex === -1) return;

    updateLiveActivityClimb({
      climbName: displayItem.climb.name,
      climbDifficulty: displayItem.climb.difficulty,
      angle: displayItem.climb.angle,
      currentIndex,
      totalClimbs: queue.length,
      hasNext: currentIndex < queue.length - 1,
      hasPrevious: currentIndex > 0,
      climbUuid: displayItem.climb.uuid,
    });
  }, [currentClimbQueueItem, queue, stableBoardDetails]);
}

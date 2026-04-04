import { useEffect, useRef } from 'react';
import type { SubscriptionQueueEvent, SessionUser } from '@boardsesh/shared-schema';
import type { ClimbQueueItem } from '../../queue-control/types';

const RECONCILIATION_TIMEOUT_MS = 15000;

export interface UseOfflineReconciliationParams {
  offlineBuffer: {
    getBufferedAdditions: () => ClimbQueueItem[];
    clearBuffer: () => void;
    hasPendingAdditions: boolean;
    bufferAddition: (item: ClimbQueueItem) => void;
  };
  isDisconnected: boolean;
  isPersistentSessionActive: boolean;
  hasConnected: boolean;
  users: SessionUser[];
  lastReceivedSequence: number | null;
  persistentSession: {
    addQueueItem: (item: ClimbQueueItem) => Promise<void>;
    setQueue: (queue: ClimbQueueItem[], currentClimb?: ClimbQueueItem | null) => Promise<void>;
    setCurrentClimb: (item: ClimbQueueItem | null, shouldAddToQueue?: boolean, correlationId?: string) => Promise<void>;
    subscribeToQueueEvents: (callback: (event: SubscriptionQueueEvent) => void) => () => void;
  };
  currentQueue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
}

/**
 * Watches for offline-to-online transitions and reconciles local queue
 * changes with the server.
 *
 * **Client-wins conditions** (full local state pushed to server):
 * - Only 1 user in the session (solo party session), OR
 * - Remote session hasn't changed while we were offline (same sequence number)
 *
 * **Server-wins with additions merge** (default):
 * - Server queue state is authoritative
 * - Only locally-added items are pushed to the server
 * - Removals, reorders, current-climb changes made offline are discarded
 *
 * Note on timing: the FullSync event may arrive before this effect subscribes
 * (React effects are async). The 15-second safety timeout handles this case.
 * Since addQueueItem/setQueue are idempotent, the worst outcome is a redundant
 * server round-trip.
 */
export function useOfflineReconciliation({
  offlineBuffer,
  isDisconnected,
  isPersistentSessionActive,
  hasConnected,
  users,
  lastReceivedSequence,
  persistentSession,
  currentQueue,
  currentClimbQueueItem,
}: UseOfflineReconciliationParams) {
  const wasOfflineRef = useRef(isDisconnected);
  const isReconcilingRef = useRef(false);
  const currentQueueRef = useRef(currentQueue);
  const currentClimbRef = useRef(currentClimbQueueItem);
  const sequenceAtDisconnectRef = useRef<number | null>(null);

  // Keep refs fresh
  currentQueueRef.current = currentQueue;
  currentClimbRef.current = currentClimbQueueItem;

  // Capture the sequence number when offline so we can compare on reconnect.
  // We continuously update while offline in case the sequence was updated
  // just before the disconnect was detected.
  useEffect(() => {
    if (isDisconnected) {
      sequenceAtDisconnectRef.current = lastReceivedSequence;
    }
  }, [isDisconnected, lastReceivedSequence]);

  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = isDisconnected;

    // Detect offline-to-online transition
    if (!wasOffline || isDisconnected) return;
    if (!isPersistentSessionActive || !hasConnected) return;
    if (!offlineBuffer.hasPendingAdditions) return;
    if (isReconcilingRef.current) return;

    isReconcilingRef.current = true;

    /**
     * Determine whether the client's full local state should win.
     * This is safe when no other user could have modified the queue:
     * - Only 1 user in the session (us), OR
     * - The server sequence hasn't advanced (no changes while we were offline)
     */
    function shouldClientWin(serverSequence: number): boolean {
      // Solo session — no one else could have changed anything
      if (users.length <= 1) return true;
      // Server state unchanged since we went offline
      if (sequenceAtDisconnectRef.current !== null && serverSequence === sequenceAtDisconnectRef.current) return true;
      return false;
    }

    async function reconcileClientWins() {
      // Push the full local queue state to the server
      const localQueue = currentQueueRef.current;
      const localCurrentClimb = currentClimbRef.current;
      try {
        await persistentSession.setQueue(localQueue, localCurrentClimb);
        if (localCurrentClimb) {
          await persistentSession.setCurrentClimb(localCurrentClimb, false);
        }
      } catch (error) {
        console.error('[OfflineReconciliation] Failed to push full local state:', error);
      }
      offlineBuffer.clearBuffer();
      isReconcilingRef.current = false;
    }

    async function reconcileAdditionsOnly(serverQueue: ClimbQueueItem[]) {
      const pending = offlineBuffer.getBufferedAdditions();
      const serverUuids = new Set(serverQueue.map(item => item.uuid));

      for (const item of pending) {
        if (serverUuids.has(item.uuid)) continue;
        try {
          await persistentSession.addQueueItem(item);
        } catch (error) {
          console.error('[OfflineReconciliation] Failed to add buffered item:', item.climb?.name, error);
        }
      }

      offlineBuffer.clearBuffer();
      isReconcilingRef.current = false;
    }

    // Subscribe to queue events and wait for FullSync
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = persistentSession.subscribeToQueueEvents((event: SubscriptionQueueEvent) => {
      if (event.__typename === 'FullSync') {
        if (timeoutId) clearTimeout(timeoutId);
        unsubscribe();

        if (shouldClientWin(event.sequence)) {
          reconcileClientWins();
        } else {
          const serverQueue = (event.state?.queue ?? []) as ClimbQueueItem[];
          reconcileAdditionsOnly(serverQueue);
        }
      }
    });

    // Safety timeout: if no FullSync arrives, reconcile against current state
    timeoutId = setTimeout(() => {
      unsubscribe();
      // On timeout, fall back to additions-only (we can't determine server sequence)
      reconcileAdditionsOnly(currentQueueRef.current);
    }, RECONCILIATION_TIMEOUT_MS);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
      isReconcilingRef.current = false;
    };
  }, [isDisconnected, isPersistentSessionActive, hasConnected, offlineBuffer, persistentSession, users]);
}

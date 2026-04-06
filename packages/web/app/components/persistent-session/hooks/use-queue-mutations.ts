import { useCallback, useRef } from 'react';
import { execute, Client } from '../../graphql-queue/graphql-client';
import {
  ADD_QUEUE_ITEM,
  REMOVE_QUEUE_ITEM,
  SET_CURRENT_CLIMB,
  MIRROR_CURRENT_CLIMB,
  SET_QUEUE,
} from '@boardsesh/shared-schema';
import type { ClimbQueueItem as LocalClimbQueueItem } from '../../queue-control/types';
import type { Session } from '../types';
import { toClimbQueueItemInput } from '../types';

interface UseQueueMutationsArgs {
  client: Client | null;
  session: Session | null;
}

export interface QueueMutationsActions {
  addQueueItem: (item: LocalClimbQueueItem, position?: number) => Promise<void>;
  removeQueueItem: (uuid: string) => Promise<void>;
  setCurrentClimb: (item: LocalClimbQueueItem | null, shouldAddToQueue?: boolean, correlationId?: string) => Promise<void>;
  mirrorCurrentClimb: (mirrored: boolean) => Promise<void>;
  setQueue: (queue: LocalClimbQueueItem[], currentClimbQueueItem?: LocalClimbQueueItem | null) => Promise<void>;
}

/**
 * Serialize-and-supersede pattern for mutations where only the latest call matters.
 * Ensures at most one mutation is in-flight at a time. If a new call arrives while
 * one is in-flight, the latest args are stored (superseding any previously queued args).
 * When the in-flight mutation completes, the pending one is sent.
 *
 * This prevents out-of-order execution when users trigger rapid successive mutations
 * (e.g., rapidly changing the active climb).
 */
export interface LatestWinsMutationRefs<TArgs> {
  inFlightRef: { current: boolean };
  pendingRef: { current: TArgs | null };
}

export function createLatestWinsMutationRefs<TArgs>(): LatestWinsMutationRefs<TArgs> {
  return {
    inFlightRef: { current: false },
    pendingRef: { current: null },
  };
}

export async function executeWithLatestWins<TArgs>(
  refs: LatestWinsMutationRefs<TArgs>,
  args: TArgs,
  executeFn: (args: TArgs) => Promise<void>,
): Promise<void> {
  if (refs.inFlightRef.current) {
    // A mutation is already in-flight. Store the latest args, superseding any prior pending.
    refs.pendingRef.current = args;
    return;
  }

  refs.inFlightRef.current = true;
  try {
    await executeFn(args);
  } catch (error) {
    console.error('Failed to send mutation:', error);
  }

  // Drain: keep sending until no more pending args
  while (refs.pendingRef.current !== null) {
    const next = refs.pendingRef.current;
    refs.pendingRef.current = null;
    try {
      await executeFn(next);
    } catch (error) {
      console.error('Failed to send coalesced mutation:', error);
    }
  }

  refs.inFlightRef.current = false;
}

export function useQueueMutations({ client, session }: UseQueueMutationsArgs): QueueMutationsActions {
  // Use refs so callbacks have stable identity (never recreate)
  const clientRef = useRef(client);
  const sessionRef = useRef(session);
  clientRef.current = client;
  sessionRef.current = session;

  // Serialize-and-supersede refs for setCurrentClimb to prevent out-of-order mutations
  const setCurrentClimbRefsRef = useRef(createLatestWinsMutationRefs<{
    item: LocalClimbQueueItem | null;
    shouldAddToQueue?: boolean;
    correlationId?: string;
  }>());

  const addQueueItem = useCallback(
    async (item: LocalClimbQueueItem, position?: number) => {
      if (!clientRef.current || !sessionRef.current) throw new Error('Not connected to session');
      await execute(clientRef.current, {
        query: ADD_QUEUE_ITEM,
        variables: { item: toClimbQueueItemInput(item), position },
      });
    },
    [],
  );

  const removeQueueItem = useCallback(
    async (uuid: string) => {
      if (!clientRef.current || !sessionRef.current) throw new Error('Not connected to session');
      await execute(clientRef.current, {
        query: REMOVE_QUEUE_ITEM,
        variables: { uuid },
      });
    },
    [],
  );

  const setCurrentClimb = useCallback(
    async (item: LocalClimbQueueItem | null, shouldAddToQueue?: boolean, correlationId?: string) => {
      if (!clientRef.current || !sessionRef.current) throw new Error('Not connected to session');
      await executeWithLatestWins(
        setCurrentClimbRefsRef.current,
        { item, shouldAddToQueue, correlationId },
        async (args) => {
          if (!clientRef.current || !sessionRef.current) throw new Error('Not connected to session');
          await execute(clientRef.current, {
            query: SET_CURRENT_CLIMB,
            variables: {
              item: args.item ? toClimbQueueItemInput(args.item) : null,
              shouldAddToQueue: args.shouldAddToQueue,
              correlationId: args.correlationId,
            },
          });
        },
      );
    },
    [],
  );

  const mirrorCurrentClimb = useCallback(
    async (mirrored: boolean) => {
      if (!clientRef.current || !sessionRef.current) throw new Error('Not connected to session');
      await execute(clientRef.current, {
        query: MIRROR_CURRENT_CLIMB,
        variables: { mirrored },
      });
    },
    [],
  );

  const setQueue = useCallback(
    async (newQueue: LocalClimbQueueItem[], newCurrentClimbQueueItem?: LocalClimbQueueItem | null) => {
      if (!clientRef.current || !sessionRef.current) throw new Error('Not connected to session');
      await execute(clientRef.current, {
        query: SET_QUEUE,
        variables: {
          queue: newQueue.map(toClimbQueueItemInput),
          currentClimbQueueItem: newCurrentClimbQueueItem ? toClimbQueueItemInput(newCurrentClimbQueueItem) : undefined,
        },
      });
    },
    [],
  );

  return {
    addQueueItem,
    removeQueueItem,
    setCurrentClimb,
    mirrorCurrentClimb,
    setQueue,
  };
}

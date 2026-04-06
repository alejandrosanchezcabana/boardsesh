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

export function useQueueMutations({ client, session }: UseQueueMutationsArgs): QueueMutationsActions {
  // Use refs so callbacks have stable identity (never recreate)
  const clientRef = useRef(client);
  const sessionRef = useRef(session);
  clientRef.current = client;
  sessionRef.current = session;

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
      await execute(clientRef.current, {
        query: SET_CURRENT_CLIMB,
        variables: {
          item: item ? toClimbQueueItemInput(item) : null,
          shouldAddToQueue,
          correlationId,
        },
      });
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

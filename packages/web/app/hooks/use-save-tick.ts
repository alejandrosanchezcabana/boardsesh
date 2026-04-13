'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWsAuthToken } from './use-ws-auth-token';
import { useSession } from 'next-auth/react';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  SAVE_TICK,
  type SaveTickMutationVariables,
  type SaveTickMutationResponse,
} from '@/app/lib/graphql/operations';
import type { BoardName } from '@/app/lib/types';
import type { TickStatus, LogbookEntry } from './use-logbook';
import { clearTickDraft } from '@/app/lib/tick-draft-db';

// Options for saving a tick (local storage, no Aurora required)
export interface SaveTickOptions {
  climbUuid: string;
  angle: number;
  isMirror: boolean;
  status: TickStatus;
  attemptCount: number;
  quality?: number;
  difficulty?: number;
  isBenchmark: boolean;
  comment: string;
  climbedAt: string;
  sessionId?: string;
  layoutId?: number;
  sizeId?: number;
  setIds?: string;
}

/**
 * Hook to save a tick (logbook entry) via GraphQL mutation.
 * Provides optimistic updates and automatic cache invalidation.
 */
export function useSaveTick(boardName: BoardName) {
  const { token } = useWsAuthToken();
  const { status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: SaveTickOptions) => {
      if (sessionStatus !== 'authenticated') {
        throw new Error('Not authenticated');
      }
      if (!token) {
        throw new Error('Auth token not available');
      }

      const client = createGraphQLHttpClient(token);
      const variables: SaveTickMutationVariables = {
        input: {
          boardType: boardName,
          climbUuid: options.climbUuid,
          angle: options.angle,
          isMirror: options.isMirror,
          status: options.status,
          attemptCount: options.attemptCount,
          quality: options.quality,
          difficulty: options.difficulty,
          isBenchmark: options.isBenchmark,
          comment: options.comment,
          climbedAt: options.climbedAt,
          sessionId: options.sessionId,
          layoutId: options.layoutId,
          sizeId: options.sizeId,
          setIds: options.setIds,
        },
      };

      const response = await client.request<SaveTickMutationResponse>(SAVE_TICK, variables);
      return response.saveTick;
    },
    onMutate: async (options) => {
      // Cancel outgoing logbook queries
      await queryClient.cancelQueries({ queryKey: ['logbook', boardName] });

      // Create optimistic entry
      const tempUuid = `temp-${Date.now()}`;
      const optimisticEntry: LogbookEntry = {
        uuid: tempUuid,
        climb_uuid: options.climbUuid,
        angle: options.angle,
        is_mirror: options.isMirror,
        tries: options.attemptCount,
        quality: options.quality ?? null,
        difficulty: options.difficulty ?? null,
        comment: options.comment,
        climbed_at: options.climbedAt,
        is_ascent: options.status === 'flash' || options.status === 'send',
        status: options.status,
      };

      // Optimistically update all matching logbook queries
      queryClient.setQueriesData<LogbookEntry[]>(
        { queryKey: ['logbook', boardName] },
        (old) => (old ? [optimisticEntry, ...old] : [optimisticEntry]),
      );

      return { tempUuid };
    },
    onSuccess: (savedTick, options, context) => {
      // Replace temp entry with real data
      if (context?.tempUuid) {
        queryClient.setQueriesData<LogbookEntry[]>(
          { queryKey: ['logbook', boardName] },
          (old) =>
            old?.map((entry) =>
              entry.uuid === context.tempUuid
                ? { ...entry, uuid: savedTick.uuid }
                : entry,
            ),
        );
      }
      // Clear any IndexedDB draft for this climb (belt-and-suspenders with QuickTickBar's .then)
      clearTickDraft(options.climbUuid, options.angle);
    },
    onError: (_err, _options, context) => {
      // Rollback optimistic update. User-facing error feedback is handled by
      // the caller (e.g. QuickTickBar's .catch → onError callback) to avoid
      // duplicate snackbars.
      if (context?.tempUuid) {
        queryClient.setQueriesData<LogbookEntry[]>(
          { queryKey: ['logbook', boardName] },
          (old) => old?.filter((entry) => entry.uuid !== context.tempUuid),
        );
      }
    },
  });
}

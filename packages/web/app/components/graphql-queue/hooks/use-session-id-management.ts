import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { getBaseBoardPath } from '@/app/lib/url-utils';
import { saveSessionToHistory } from '@/app/lib/session-history-db';
import { getClimbSessionCookie, setClimbSessionCookie, clearClimbSessionCookie } from '@/app/lib/climb-session-cookie';
import { usePersistentSession } from '../../persistent-session';
import { useConnectionSettings } from '../../connection-manager/connection-settings-context';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  END_SESSION as END_SESSION_GQL,
  type EndSessionResponse,
} from '@/app/lib/graphql/operations/sessions';
import type { SessionSummary } from '@boardsesh/shared-schema';
import { autoSaveToHealthKit } from '@/app/lib/healthkit/healthkit-auto-save';
import type { ClimbQueueItem } from '../../queue-control/types';

interface UseSessionIdManagementParams {
  isOffBoardMode: boolean;
  propsBaseBoardPath?: string;
  currentQueue: ClimbQueueItem[];
  currentClimbQueueItem: ClimbQueueItem | null;
}

export function useSessionIdManagement({
  isOffBoardMode,
  propsBaseBoardPath,
  currentQueue,
  currentClimbQueueItem,
}: UseSessionIdManagementParams) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { backendUrl } = useConnectionSettings();
  const { token: wsAuthToken } = useWsAuthToken();
  const persistentSession = usePersistentSession();

  // Session ID source differs by mode:
  // - Board mode: read from cookie (previously URL ?session= param)
  // - Off-board mode: read from persistent IndexedDB storage
  const sessionIdFromCookie = getClimbSessionCookie();
  const persistentSessionId = persistentSession.activeSession?.sessionId ?? null;
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    isOffBoardMode ? persistentSessionId : sessionIdFromCookie,
  );

  // Backward compat: migrate ?session= URL param to cookie and strip from URL
  useEffect(() => {
    if (isOffBoardMode) return;
    const sessionFromUrl = searchParams.get('session');
    if (sessionFromUrl) {
      setClimbSessionCookie(sessionFromUrl);
      setActiveSessionId(sessionFromUrl);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('session');
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }
  }, [searchParams, isOffBoardMode, pathname, router]);

  // Sync activeSessionId from persistent session (off-board mode only)
  useEffect(() => {
    if (!isOffBoardMode) return;
    setActiveSessionId(persistentSessionId);
  }, [isOffBoardMode, persistentSessionId]);

  // Sync when persistent session is deactivated externally (e.g. sesh-settings-drawer
  // calling deactivateSession() directly). We track the previous persistentSessionId
  // so we only clear on an active→inactive transition, not on initial mount where
  // persistentSessionId starts null before IndexedDB loads.
  const prevPersistentSessionIdRef = useRef(persistentSessionId);
  useEffect(() => {
    const prev = prevPersistentSessionIdRef.current;
    prevPersistentSessionIdRef.current = persistentSessionId;

    if (prev && !persistentSessionId) {
      clearClimbSessionCookie();
      setActiveSessionId(null);
    }
  }, [persistentSessionId]);

  const sessionId = activeSessionId;

  // Compute base board path
  const baseBoardPath = useMemo(
    () => propsBaseBoardPath ?? getBaseBoardPath(pathname),
    [propsBaseBoardPath, pathname],
  );

  // Check if persistent session is active for this board
  const isPersistentSessionActive = persistentSession.activeSession?.sessionId === sessionId &&
    (persistentSession.activeSession?.boardPath
      ? getBaseBoardPath(persistentSession.activeSession.boardPath)
      : '') === baseBoardPath;

  // Session summary state
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [sessionSummaryBoardType, setSessionSummaryBoardType] = useState<string | null>(null);
  const [sessionSummaryHealthKitWorkoutId, setSessionSummaryHealthKitWorkoutId] = useState<string | null>(null);
  const dismissSessionSummary = useCallback(() => {
    setSessionSummary(null);
    setSessionSummaryBoardType(null);
    setSessionSummaryHealthKitWorkoutId(null);
  }, []);

  // Session management functions
  const startSession = useCallback(
    async (options?: { discoverable?: boolean; name?: string; sessionId?: string }) => {
      if (isOffBoardMode) throw new Error('Cannot start a session outside of a board route');
      if (!backendUrl) throw new Error('Backend URL not configured');

      const newSessionId = options?.sessionId || uuidv4();

      if (currentQueue.length > 0 || currentClimbQueueItem) {
        persistentSession.setInitialQueueForSession(
          newSessionId, currentQueue, currentClimbQueueItem, options?.name,
        );
      }

      setClimbSessionCookie(newSessionId);
      setActiveSessionId(newSessionId);

      await saveSessionToHistory({
        id: newSessionId,
        name: options?.name || null,
        boardPath: pathname,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });

      return newSessionId;
    },
    [backendUrl, pathname, currentQueue, currentClimbQueueItem, persistentSession, isOffBoardMode],
  );

  const joinSession = useCallback(
    async (sessionIdToJoin: string) => {
      if (isOffBoardMode) throw new Error('Cannot join a session outside of a board route');
      if (!backendUrl) throw new Error('Backend URL not configured');

      setClimbSessionCookie(sessionIdToJoin);
      setActiveSessionId(sessionIdToJoin);

      await saveSessionToHistory({
        id: sessionIdToJoin,
        name: null,
        boardPath: pathname,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });
    },
    [backendUrl, pathname, isOffBoardMode],
  );

  const endSession = useCallback(() => {
    const endingSessionId = activeSessionId;
    // Capture board type before deactivation clears the active session
    const boardType = persistentSession.activeSession?.parsedParams?.board_name ?? '';
    const token = wsAuthToken;

    persistentSession.deactivateSession();
    clearClimbSessionCookie();
    setActiveSessionId(null);

    if (endingSessionId && token) {
      const client = createGraphQLHttpClient(token);
      client.request<EndSessionResponse>(END_SESSION_GQL, { sessionId: endingSessionId })
        .then(async (response: EndSessionResponse) => {
          if (response.endSession) {
            setSessionSummary(response.endSession);
            setSessionSummaryBoardType(boardType);
            // Fire-and-forget HealthKit auto-save
            const workoutId = await autoSaveToHealthKit(response.endSession, boardType, token);
            if (workoutId) {
              setSessionSummaryHealthKitWorkoutId(workoutId);
            }
          }
        })
        .catch((err: unknown) => console.error('[QueueContext] Failed to get session summary:', err));
    }
  }, [persistentSession, isOffBoardMode, activeSessionId, wsAuthToken]);

  return {
    sessionId,
    activeSessionId,
    baseBoardPath,
    isPersistentSessionActive,
    persistentSession,
    backendUrl,
    searchParams,
    router,
    pathname,
    isOffBoardMode,
    startSession,
    joinSession,
    endSession,
    sessionSummary,
    sessionSummaryBoardType,
    sessionSummaryHealthKitWorkoutId,
    dismissSessionSummary,
  };
}

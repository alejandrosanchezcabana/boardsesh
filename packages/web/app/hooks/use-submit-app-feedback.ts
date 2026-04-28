'use client';

import { useMutation } from '@tanstack/react-query';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  SUBMIT_APP_FEEDBACK,
  type SubmitAppFeedbackMutationVariables,
  type SubmitAppFeedbackMutationResponse,
} from '@/app/lib/graphql/operations';
import type { SubmitAppFeedbackInput, AppFeedbackBoardName, FeedbackContextInput } from '@boardsesh/shared-schema';
import { getPlatform } from '@/app/lib/ble/capacitor-utils';
import { getAppVersion } from '@/app/lib/app-info';
import { useWsAuthToken } from './use-ws-auth-token';
import { useQueueBridgeBoardInfo } from '@/app/components/queue-control/queue-bridge-board-info-context';
import { usePersistentSession } from '@/app/components/persistent-session';

/**
 * Fields callers provide. `platform`/`appVersion` are injected by the helper;
 * board + queue + session context is injected by the React hook so call sites
 * never have to thread it through manually.
 */
export type SubmitAppFeedbackPayload = Omit<
  SubmitAppFeedbackInput,
  'platform' | 'appVersion' | 'boardName' | 'layoutId' | 'sizeId' | 'setIds' | 'angle' | 'context'
>;

const KNOWN_BOARD_NAMES: ReadonlySet<string> = new Set(['kilter', 'tension', 'moonboard']);
const URL_MAX = 1000;
const UA_MAX = 512;

function asBoardName(name: string | undefined): AppFeedbackBoardName | null {
  return name && KNOWN_BOARD_NAMES.has(name) ? (name as AppFeedbackBoardName) : null;
}

function clip(value: string | undefined | null, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

function compactContext(input: FeedbackContextInput): FeedbackContextInput | null {
  const out: FeedbackContextInput = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 0) {
      (out as Record<string, string>)[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Stateless submit helper. Use this when you don't have access to a
 * QueryClientProvider (e.g. a handler on a rarely-rendered button) and
 * want to fire the mutation directly. Auth token is optional — when
 * omitted, the submission is anonymous. Board/queue context is NOT
 * injected here — pass it via `payload` or use the React hook.
 */
export async function submitAppFeedback(
  payload: SubmitAppFeedbackPayload &
    Partial<Pick<SubmitAppFeedbackInput, 'boardName' | 'layoutId' | 'sizeId' | 'setIds' | 'angle' | 'context'>>,
  token?: string | null,
): Promise<boolean> {
  const platform = getPlatform();
  const appVersion = await getAppVersion();
  const client = createGraphQLHttpClient(token ?? null);
  const variables: SubmitAppFeedbackMutationVariables = {
    input: { ...payload, platform, appVersion },
  };
  const response = await client.request<SubmitAppFeedbackMutationResponse>(SUBMIT_APP_FEEDBACK, variables);
  return response.submitAppFeedback;
}

/**
 * Fire-and-report submission of app feedback. The mutation is public; the
 * auth token is attached when available so the backend associates the
 * feedback with the user. The UI should close optimistically before awaiting
 * — an error surfaces a toast but does not reopen the prompt.
 *
 * Reads board, current-climb, and party-session state from the bridge/session
 * contexts at submission time so every caller (rating prompts, drawer
 * feedback, bug reports) gets enriched without threading props.
 */
export function useSubmitAppFeedback() {
  const { token } = useWsAuthToken();
  const { boardDetails, angle } = useQueueBridgeBoardInfo();
  const ps = usePersistentSession();

  return useMutation({
    mutationFn: (payload: SubmitAppFeedbackPayload): Promise<boolean> => {
      // Prefer the active party session's board (matches sesh-settings-drawer).
      const board = ps.activeSession?.boardDetails ?? boardDetails;
      const climb = (ps.activeSession ? ps.currentClimbQueueItem : ps.localCurrentClimbQueueItem)?.climb;

      const enrichment: Pick<
        SubmitAppFeedbackInput,
        'boardName' | 'layoutId' | 'sizeId' | 'setIds' | 'angle' | 'context'
      > = {
        boardName: asBoardName(board?.board_name),
        layoutId: board?.layout_id ?? null,
        sizeId: board?.size_id ?? null,
        setIds: board?.set_ids ?? null,
        angle: board ? angle : null,
        context: compactContext({
          climbUuid: climb?.uuid,
          climbName: climb?.name,
          difficulty: climb?.difficulty ?? undefined,
          sessionId: ps.activeSession?.sessionId,
          sessionName: ps.activeSession?.sessionName,
          url:
            typeof window !== 'undefined'
              ? clip(window.location.pathname + window.location.search, URL_MAX)
              : undefined,
          userAgent: typeof navigator !== 'undefined' ? clip(navigator.userAgent, UA_MAX) : undefined,
        }),
      };

      return submitAppFeedback({ ...payload, ...enrichment }, token);
    },
  });
}

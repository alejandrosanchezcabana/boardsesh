import { QueueActionsType, QueueDataType } from '../queue-control/types';
import type { ConnectionState } from '../connection-manager/websocket-connection-manager';
import type { SessionSummary } from '@boardsesh/shared-schema';
import type { ReactNode } from 'react';
import type { ParsedBoardRouteParameters, BoardDetails } from '@/app/lib/types';

// Stable action functions extended with session management
export interface GraphQLQueueActionsType extends QueueActionsType {
  startSession: (options?: { discoverable?: boolean; name?: string; sessionId?: string }) => Promise<string>;
  joinSession: (sessionId: string) => Promise<void>;
  endSession: () => void;
  dismissSessionSummary: () => void;
}

// Frequently-changing state data extended with session state
export interface GraphQLQueueDataType extends QueueDataType {
  isSessionActive: boolean;
  sessionId: string | null;
  sessionSummary: SessionSummary | null;
  sessionGoal: string | null;
  connectionState: ConnectionState;
  canMutate: boolean;
  isDisconnected: boolean;
}

// Combined type for backward compatibility
export type GraphQLQueueContextType = GraphQLQueueActionsType & GraphQLQueueDataType;

export type GraphQLQueueContextProps = {
  parsedParams: ParsedBoardRouteParameters;
  boardDetails: BoardDetails;
  children: ReactNode;
  // When provided, the provider operates in "off-board" mode:
  // uses this path instead of computing from pathname, reads session ID
  // from persistent session instead of URL, and skips URL manipulation.
  baseBoardPath?: string;
};

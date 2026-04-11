// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import type { BoardDetails } from '@/app/lib/types';
import type { ActiveSessionInfo } from '../../persistent-session/types';

type SessionState = { activeSession: ActiveSessionInfo | null };

let mockSessionState: SessionState = { activeSession: null };
let mockBluetoothConnected = false;
let mockBridgeBoardDetails: BoardDetails | null = null;

vi.mock('../../persistent-session', () => ({
  usePersistentSessionState: () => mockSessionState,
}));

vi.mock('../../board-bluetooth-control/bluetooth-status-store', () => ({
  useBluetoothConnectedStatus: () => mockBluetoothConnected,
}));

vi.mock('../../queue-control/queue-bridge-context', () => ({
  useQueueBridgeBoardInfo: () => ({
    boardDetails: mockBridgeBoardDetails,
    angle: 0,
    hasActiveQueue: !!mockBridgeBoardDetails,
  }),
}));

import { useActiveBoardLock } from '../use-active-board-lock';

function makeBoard(partial: Partial<BoardDetails> = {}): BoardDetails {
  return {
    images_to_holds: {},
    holdsData: [],
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
    boardHeight: 0,
    boardWidth: 0,
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: [1],
    ...partial,
  };
}

describe('useActiveBoardLock', () => {
  beforeEach(() => {
    mockSessionState = { activeSession: null };
    mockBluetoothConnected = false;
    mockBridgeBoardDetails = null;
  });

  it('returns no lock when nothing is active', () => {
    const { result } = renderHook(() => useActiveBoardLock());
    expect(result.current.lockedBoard).toBeNull();
    expect(result.current.reason).toBeNull();
  });

  it('returns session lock when a party session is active', () => {
    const sessionBoard = makeBoard({ board_name: 'tension', layout_id: 2 });
    mockSessionState = {
      activeSession: {
        sessionId: 'session-1',
        boardPath: '/tension/2/1/1/40',
        boardDetails: sessionBoard,
        parsedParams: { board_name: 'tension', layout_id: 2, size_id: 1, set_ids: [1], angle: 40 },
      },
    };

    const { result } = renderHook(() => useActiveBoardLock());
    expect(result.current.lockedBoard).toBe(sessionBoard);
    expect(result.current.reason).toBe('session');
  });

  it('returns bluetooth lock when connected and a bridge board is known', () => {
    const bridgeBoard = makeBoard({ board_name: 'kilter', layout_id: 1 });
    mockBluetoothConnected = true;
    mockBridgeBoardDetails = bridgeBoard;

    const { result } = renderHook(() => useActiveBoardLock());
    expect(result.current.lockedBoard).toBe(bridgeBoard);
    expect(result.current.reason).toBe('bluetooth');
  });

  it('prefers session over bluetooth when both are present', () => {
    const sessionBoard = makeBoard({ board_name: 'tension', layout_id: 2 });
    mockSessionState = {
      activeSession: {
        sessionId: 'session-1',
        boardPath: '/tension/2/1/1/40',
        boardDetails: sessionBoard,
        parsedParams: { board_name: 'tension', layout_id: 2, size_id: 1, set_ids: [1], angle: 40 },
      },
    };
    mockBluetoothConnected = true;
    mockBridgeBoardDetails = makeBoard({ board_name: 'kilter' });

    const { result } = renderHook(() => useActiveBoardLock());
    expect(result.current.lockedBoard).toBe(sessionBoard);
    expect(result.current.reason).toBe('session');
  });

  it('returns no lock when bluetooth is connected but no bridge board is known', () => {
    mockBluetoothConnected = true;
    mockBridgeBoardDetails = null;

    const { result } = renderHook(() => useActiveBoardLock());
    expect(result.current.lockedBoard).toBeNull();
    expect(result.current.reason).toBeNull();
  });
});

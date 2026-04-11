// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { BoardDetails, BoardRouteIdentity } from '@/app/lib/types';
import type { ActiveBoardLock } from '../use-active-board-lock';

let mockLock: ActiveBoardLock = { lockedBoard: null, reason: null };
const mockConfirmBoardSwitch = vi.fn();
let mockConfirmCtx: { confirmBoardSwitch: typeof mockConfirmBoardSwitch } | null = {
  confirmBoardSwitch: mockConfirmBoardSwitch,
};
const mockDisconnectAll = vi.fn();

vi.mock('../use-active-board-lock', () => ({
  useActiveBoardLock: () => mockLock,
}));

vi.mock('../board-switch-confirm-provider', () => ({
  useBoardSwitchConfirm: () => mockConfirmCtx,
}));

vi.mock('../../board-bluetooth-control/bluetooth-status-store', () => ({
  disconnectAllBluetooth: () => mockDisconnectAll(),
}));

import { useBoardSwitchGuard } from '../use-board-switch-guard';

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

function makeTarget(partial: Partial<BoardRouteIdentity> = {}): BoardRouteIdentity {
  return {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: [1],
    ...partial,
  };
}

describe('useBoardSwitchGuard', () => {
  beforeEach(() => {
    mockLock = { lockedBoard: null, reason: null };
    mockConfirmBoardSwitch.mockReset();
    mockConfirmCtx = { confirmBoardSwitch: mockConfirmBoardSwitch };
    mockDisconnectAll.mockReset();
  });

  it('calls onConfirmed immediately when no lock is active', () => {
    const { result } = renderHook(() => useBoardSwitchGuard());
    const onConfirmed = vi.fn();

    act(() => {
      result.current(makeTarget({ board_name: 'tension' }), onConfirmed);
    });

    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(mockConfirmBoardSwitch).not.toHaveBeenCalled();
  });

  it('calls onConfirmed immediately when switching to the same board', () => {
    mockLock = {
      lockedBoard: makeBoard({ board_name: 'kilter', layout_id: 1, size_id: 2, set_ids: [1, 2] }),
      reason: 'session',
    };
    const { result } = renderHook(() => useBoardSwitchGuard());
    const onConfirmed = vi.fn();

    act(() => {
      result.current(
        makeTarget({ board_name: 'kilter', layout_id: 1, size_id: 2, set_ids: [2, 1] }),
        onConfirmed,
      );
    });

    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(mockConfirmBoardSwitch).not.toHaveBeenCalled();
  });

  it('opens confirmation dialog when switching to a different board', () => {
    mockLock = {
      lockedBoard: makeBoard({ board_name: 'kilter', layout_id: 1 }),
      reason: 'session',
    };
    const { result } = renderHook(() => useBoardSwitchGuard());
    const onConfirmed = vi.fn();

    act(() => {
      result.current(makeTarget({ board_name: 'tension', layout_id: 2 }), onConfirmed);
    });

    expect(mockConfirmBoardSwitch).toHaveBeenCalledOnce();
    expect(onConfirmed).not.toHaveBeenCalled();
    const call = mockConfirmBoardSwitch.mock.calls[0][0];
    expect(call.reason).toBe('session');
  });

  it('disconnects bluetooth and invokes onConfirmed when the dialog is confirmed', () => {
    mockLock = {
      lockedBoard: makeBoard({ board_name: 'kilter', layout_id: 1 }),
      reason: 'bluetooth',
    };
    const { result } = renderHook(() => useBoardSwitchGuard());
    const onConfirmed = vi.fn();

    act(() => {
      result.current(makeTarget({ board_name: 'tension', layout_id: 2 }), onConfirmed);
    });

    // Simulate the provider firing the dialog's confirm callback.
    const args = mockConfirmBoardSwitch.mock.calls[0][0];
    act(() => {
      args.onConfirmed();
    });

    expect(mockDisconnectAll).toHaveBeenCalledOnce();
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it('falls back to immediate call-through when the confirm provider is missing', () => {
    mockLock = {
      lockedBoard: makeBoard({ board_name: 'kilter' }),
      reason: 'session',
    };
    mockConfirmCtx = null;

    const { result } = renderHook(() => useBoardSwitchGuard());
    const onConfirmed = vi.fn();

    act(() => {
      result.current(makeTarget({ board_name: 'tension' }), onConfirmed);
    });

    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(mockConfirmBoardSwitch).not.toHaveBeenCalled();
  });
});

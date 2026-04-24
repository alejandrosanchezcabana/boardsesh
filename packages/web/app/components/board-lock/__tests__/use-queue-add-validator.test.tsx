// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { renderHook } from '@testing-library/react';
import React from 'react';
import type { BoardDetails, Climb } from '@/app/lib/types';
import type { ActiveBoardLock } from '../use-active-board-lock';
import { useQueueAddValidator } from '../use-queue-add-validator';

let mockLock: ActiveBoardLock = { lockedBoard: null, reason: null };
let mockFallbackBoard: BoardDetails | null = null;
const mockShowMessage = vi.fn();

vi.mock('../use-active-board-lock', () => ({
  useActiveBoardLock: () => mockLock,
}));

vi.mock('../../queue-control/queue-bridge-board-info-context', () => ({
  useQueueBridgeBoardInfo: () => ({
    boardDetails: mockFallbackBoard,
    angle: 0,
    hasActiveQueue: false,
  }),
}));

vi.mock('../../providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: mockShowMessage }),
}));

function holdsData(ids: number[]) {
  return ids.map((id) => ({ id, mirroredHoldId: null, cx: 0, cy: 0, r: 1 }));
}

function makeBoard(partial: Partial<BoardDetails> = {}): BoardDetails {
  return {
    images_to_holds: {},
    holdsData: holdsData([1, 2, 3, 4]),
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

function makeClimb(partial: Partial<Climb> = {}): Climb {
  return {
    uuid: 'c1',
    setter_username: 't',
    name: 'T',
    frames: 'p1r15p2r12',
    angle: 40,
    ascensionist_count: 0,
    difficulty: '',
    quality_average: '',
    stars: 0,
    difficulty_error: '',
    benchmark_difficulty: null,
    ...partial,
  };
}

describe('useQueueAddValidator', () => {
  beforeEach(() => {
    mockLock = { lockedBoard: null, reason: null };
    mockFallbackBoard = null;
    mockShowMessage.mockReset();
  });

  it('allows any add when no lock and no fallback board exist', () => {
    const { result } = renderHook(() => useQueueAddValidator());
    expect(result.current(makeClimb({ boardType: 'tension' }))).toBe(true);
    expect(mockShowMessage).not.toHaveBeenCalled();
  });

  it('validates against the session-locked board before the fallback', () => {
    mockLock = {
      lockedBoard: makeBoard({ board_name: 'kilter' }),
      reason: 'session',
    };
    mockFallbackBoard = makeBoard({ board_name: 'tension' });

    const { result } = renderHook(() => useQueueAddValidator());

    // Wrong board_name — rejected with message.
    expect(result.current(makeClimb({ boardType: 'tension' }))).toBe(false);
    expect(mockShowMessage).toHaveBeenCalledOnce();
    expect(mockShowMessage.mock.calls[0][0]).toContain('Tension');
    expect(mockShowMessage.mock.calls[0][1]).toBe('error');
  });

  it('uses the fallback board when there is no active lock', () => {
    mockFallbackBoard = makeBoard({ board_name: 'kilter', holdsData: holdsData([1, 2, 3]) });

    const { result } = renderHook(() => useQueueAddValidator());

    // Climb referencing a hold not on the fallback board is rejected.
    expect(result.current(makeClimb({ frames: 'p7r15' }))).toBe(false);
    expect(mockShowMessage).toHaveBeenCalledOnce();
    expect(mockShowMessage.mock.calls[0][0]).toMatch(/holds/);
  });

  it('allows compatible climbs without firing a Snackbar', () => {
    mockLock = {
      lockedBoard: makeBoard({ holdsData: holdsData([1, 2, 3, 4, 5]) }),
      reason: 'session',
    };
    const { result } = renderHook(() => useQueueAddValidator());
    expect(result.current(makeClimb({ frames: 'p1r15p3r12p5r14' }))).toBe(true);
    expect(mockShowMessage).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Climb, Angle, BoardDetails, BoardName } from '@/app/lib/types';
import type { LogbookEntry } from '@/app/hooks/use-logbook';

// --- Mocks (must be hoisted before imports of the module under test) ---

const mockSaveTick = vi.fn();
const mockLogbookRef: { current: LogbookEntry[] } = { current: [] };

vi.mock('../../components/board-provider/board-provider-context', () => ({
  useBoardProvider: () => ({
    saveTick: mockSaveTick,
    logbook: mockLogbookRef.current,
    boardName: 'kilter' as BoardName,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    isInitialized: true,
    getLogbook: vi.fn(),
    saveClimb: vi.fn(),
  }),
}));

const mockFireConfetti = vi.fn();
vi.mock('../use-confetti', () => ({
  useConfetti: () => mockFireConfetti,
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/app/lib/tick-draft-db', () => ({
  saveTickDraft: vi.fn(),
  clearTickDraft: vi.fn(),
}));

// Import after mocks.
import {
  hasPriorHistoryForClimb,
  buildTickTarget,
  useTickSave,
  type UseTickSaveOptions,
} from '../use-tick-save';
import { saveTickDraft } from '@/app/lib/tick-draft-db';

// --- Fixtures ---

function makeClimb(overrides: Partial<Climb> = {}): Climb {
  return {
    uuid: 'climb-1',
    name: 'Test Climb',
    difficulty: 'V5',
    frames: 'p1r42',
    quality_average: '3.5',
    angle: 40,
    ascensionist_count: 10,
    display_difficulty: 5,
    difficulty_average: 12.5,
    setter_username: 'setter',
    ...overrides,
  } as Climb;
}

function makeBoardDetails(overrides: Partial<BoardDetails> = {}): BoardDetails {
  return {
    board_name: 'kilter' as BoardName,
    layout_id: 1,
    size_id: 10,
    set_ids: [1, 2],
    layout_name: 'Original',
    size_name: '12x12',
    size_description: 'Full',
    set_names: ['Standard'],
    supportsMirroring: true,
    images_to_holds: {},
    holdsData: {},
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
    boardHeight: 100,
    boardWidth: 100,
    ...overrides,
  } as BoardDetails;
}

function makeLogbookEntry(overrides: Partial<LogbookEntry> = {}): LogbookEntry {
  return {
    uuid: 'log-1',
    climb_uuid: 'climb-1',
    angle: 40,
    is_mirror: false,
    tries: 1,
    quality: null,
    difficulty: null,
    comment: '',
    climbed_at: '2025-01-01T00:00:00Z',
    is_ascent: false,
    status: 'attempt',
    ...overrides,
  };
}

// --- Tests ---

describe('hasPriorHistoryForClimb', () => {
  it('returns false when no ascents/attempts and no logbook entries', () => {
    const climb = makeClimb({ uuid: 'c1' });
    expect(hasPriorHistoryForClimb(climb, [])).toBe(false);
  });

  it('returns true when userAscents > 0', () => {
    const climb = makeClimb({ uuid: 'c1', userAscents: 2, userAttempts: 0 });
    expect(hasPriorHistoryForClimb(climb, [])).toBe(true);
  });

  it('returns true when userAttempts > 0', () => {
    const climb = makeClimb({ uuid: 'c1', userAscents: 0, userAttempts: 3 });
    expect(hasPriorHistoryForClimb(climb, [])).toBe(true);
  });

  it('returns false when userAscents and userAttempts are both 0', () => {
    const climb = makeClimb({ uuid: 'c1', userAscents: 0, userAttempts: 0 });
    // Even if the logbook has a matching entry, the counts take priority.
    const logbook = [makeLogbookEntry({ climb_uuid: 'c1' })];
    expect(hasPriorHistoryForClimb(climb, logbook)).toBe(false);
  });

  it('returns true when logbook has matching entry (no counts on climb)', () => {
    const climb = makeClimb({ uuid: 'c1' });
    const logbook = [makeLogbookEntry({ climb_uuid: 'c1' })];
    expect(hasPriorHistoryForClimb(climb, logbook)).toBe(true);
  });

  it('returns false when logbook has only non-matching entries', () => {
    const climb = makeClimb({ uuid: 'c1' });
    const logbook = [
      makeLogbookEntry({ climb_uuid: 'other-climb' }),
      makeLogbookEntry({ climb_uuid: 'another-climb' }),
    ];
    expect(hasPriorHistoryForClimb(climb, logbook)).toBe(false);
  });
});

describe('buildTickTarget', () => {
  it('builds correct TickTarget with hasPriorHistory computed from logbook', () => {
    const climb = makeClimb({ uuid: 'c1' });
    const angle = 40 as Angle;
    const boardDetails = makeBoardDetails();
    const logbook = [makeLogbookEntry({ climb_uuid: 'c1' })];

    const target = buildTickTarget(climb, angle, boardDetails, logbook);

    expect(target.climb).toBe(climb);
    expect(target.angle).toBe(angle);
    expect(target.boardDetails).toBe(boardDetails);
    expect(target.hasPriorHistory).toBe(true);
  });

  it('builds TickTarget with hasPriorHistory=false when no history', () => {
    const climb = makeClimb({ uuid: 'c1' });
    const angle = 40 as Angle;
    const boardDetails = makeBoardDetails();

    const target = buildTickTarget(climb, angle, boardDetails, []);

    expect(target.hasPriorHistory).toBe(false);
  });

  it('uses userAscents when present on climb', () => {
    const climb = makeClimb({ uuid: 'c1', userAscents: 1, userAttempts: 0 });
    const angle = 40 as Angle;
    const boardDetails = makeBoardDetails();

    const target = buildTickTarget(climb, angle, boardDetails, []);

    expect(target.hasPriorHistory).toBe(true);
  });
});

describe('useTickSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveTick.mockResolvedValue(undefined);
    mockLogbookRef.current = [];
  });

  function makeOptions(overrides: Partial<UseTickSaveOptions> = {}): UseTickSaveOptions {
    return {
      tickTarget: {
        climb: makeClimb(),
        angle: 40 as Angle,
        boardDetails: makeBoardDetails(),
        hasPriorHistory: false,
      },
      quality: null,
      difficulty: undefined,
      attemptCount: 1,
      comment: '',
      onSave: vi.fn(),
      ...overrides,
    };
  }

  it('save() fires confetti and calls onSave', () => {
    const onSave = vi.fn();
    const opts = makeOptions({ onSave });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.save();
    });

    expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mockSaveTick).toHaveBeenCalledTimes(1);
  });

  it('saveAttempt() fires confetti with the origin element and calls onSave', () => {
    const onSave = vi.fn();
    const opts = makeOptions({ onSave });
    const originElement = document.createElement('button');

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.saveAttempt(originElement);
    });

    expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    expect(mockFireConfetti).toHaveBeenCalledWith(originElement);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mockSaveTick).toHaveBeenCalledTimes(1);
  });

  it('returns early when tickTarget is null', () => {
    const onSave = vi.fn();
    const opts = makeOptions({ tickTarget: null, onSave });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.save();
    });

    expect(mockFireConfetti).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(mockSaveTick).not.toHaveBeenCalled();
  });

  it('saveAttempt returns early when tickTarget is null', () => {
    const onSave = vi.fn();
    const opts = makeOptions({ tickTarget: null, onSave });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.saveAttempt();
    });

    expect(mockFireConfetti).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(mockSaveTick).not.toHaveBeenCalled();
  });

  it('save() sends status flash when no prior history and attemptCount=1', () => {
    const opts = makeOptions({
      tickTarget: {
        climb: makeClimb(),
        angle: 40 as Angle,
        boardDetails: makeBoardDetails(),
        hasPriorHistory: false,
      },
      attemptCount: 1,
    });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.save();
    });

    const call = mockSaveTick.mock.calls[0][0];
    expect(call.status).toBe('flash');
  });

  it('save() sends status send when hasPriorHistory is true', () => {
    const opts = makeOptions({
      tickTarget: {
        climb: makeClimb(),
        angle: 40 as Angle,
        boardDetails: makeBoardDetails(),
        hasPriorHistory: true,
      },
      attemptCount: 1,
    });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.save();
    });

    const call = mockSaveTick.mock.calls[0][0];
    expect(call.status).toBe('send');
  });

  it('save() sends status send when attemptCount > 1', () => {
    const opts = makeOptions({
      tickTarget: {
        climb: makeClimb(),
        angle: 40 as Angle,
        boardDetails: makeBoardDetails(),
        hasPriorHistory: false,
      },
      attemptCount: 3,
    });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.save();
    });

    const call = mockSaveTick.mock.calls[0][0];
    expect(call.status).toBe('send');
  });

  it('saveAttempt() always sends status attempt', () => {
    const opts = makeOptions({
      tickTarget: {
        climb: makeClimb(),
        angle: 40 as Angle,
        boardDetails: makeBoardDetails(),
        hasPriorHistory: false,
      },
      attemptCount: 1,
    });

    const { result } = renderHook(() => useTickSave(opts));

    act(() => {
      result.current.saveAttempt();
    });

    const call = mockSaveTick.mock.calls[0][0];
    expect(call.status).toBe('attempt');
  });

  it('save() calls onError and saves a draft when saveTick rejects', async () => {
    mockSaveTick.mockRejectedValue(new Error('Network error'));
    const onError = vi.fn();
    const onSave = vi.fn();
    const opts = makeOptions({ onSave, onError, comment: 'beta note' });

    const { result } = renderHook(() => useTickSave(opts));

    await act(async () => {
      result.current.save();
      // Flush the rejected promise
      await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(saveTickDraft).toHaveBeenCalledTimes(1);
    expect(saveTickDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        climbUuid: 'climb-1',
        angle: 40,
        comment: 'beta note',
        status: 'flash',
      }),
    );
  });

  it('saveAttempt() calls onError and saves a draft when saveTick rejects', async () => {
    mockSaveTick.mockRejectedValue(new Error('Network error'));
    const onError = vi.fn();
    const onSave = vi.fn();
    const opts = makeOptions({ onSave, onError });

    const { result } = renderHook(() => useTickSave(opts));

    await act(async () => {
      result.current.saveAttempt();
      await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(saveTickDraft).toHaveBeenCalledTimes(1);
    expect(saveTickDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        climbUuid: 'climb-1',
        angle: 40,
        status: 'attempt',
      }),
    );
  });
});

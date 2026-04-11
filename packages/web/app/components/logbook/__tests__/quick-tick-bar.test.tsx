import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { Angle, BoardDetails, BoardName, Climb } from '@/app/lib/types';
import type { LogbookEntry } from '@/app/hooks/use-logbook';

// --- Mocks (must be hoisted before imports of the component under test) ---

const mockSaveTick = vi.fn();
const mockLogbookRef: { current: LogbookEntry[] } = { current: [] };

vi.mock('../../board-provider/board-provider-context', () => ({
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

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

// Import after mocks.
import { QuickTickBar, hasPriorHistoryForClimb } from '../quick-tick-bar';

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

const defaultProps = {
  currentClimb: makeClimb(),
  angle: 40 as Angle,
  boardDetails: makeBoardDetails(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  comment: '',
  commentOpen: false,
  onCommentToggle: vi.fn(),
  commentFocused: false,
};

/**
 * Simulate a horizontal swipe on the bar root.
 * react-swipeable uses touch events internally, so we dispatch native touch
 * events with TouchEvent-shaped fields that the library reads.
 */
function simulateSwipe(el: HTMLElement, deltaX: number) {
  const startX = 200;
  const startY = 100;
  const endX = startX + deltaX;

  fireEvent.touchStart(el, {
    touches: [{ clientX: startX, clientY: startY }],
  });
  // A couple of intermediate points so react-swipeable recognises a swipe.
  fireEvent.touchMove(el, {
    touches: [{ clientX: startX + deltaX / 2, clientY: startY }],
  });
  fireEvent.touchMove(el, {
    touches: [{ clientX: endX, clientY: startY }],
  });
  fireEvent.touchEnd(el, {
    changedTouches: [{ clientX: endX, clientY: startY }],
  });
}

describe('QuickTickBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogbookRef.current = [];
    mockSaveTick.mockResolvedValue(undefined);
    defaultProps.onSave = vi.fn();
    defaultProps.onCancel = vi.fn();
    defaultProps.onCommentToggle = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hasPriorHistoryForClimb helper', () => {
    it('prefers userAscents/userAttempts on the climb when present', () => {
      const climbFresh = makeClimb({ uuid: 'c1', userAscents: 0, userAttempts: 0 });
      const climbAttempted = makeClimb({ uuid: 'c2', userAscents: 0, userAttempts: 3 });
      const climbSent = makeClimb({ uuid: 'c3', userAscents: 1, userAttempts: 0 });

      // Logbook contents should be ignored when the climb carries counts.
      const logbook = [makeLogbookEntry({ climb_uuid: 'c1' })];

      expect(hasPriorHistoryForClimb(climbFresh, logbook)).toBe(false);
      expect(hasPriorHistoryForClimb(climbAttempted, [])).toBe(true);
      expect(hasPriorHistoryForClimb(climbSent, [])).toBe(true);
    });

    it('falls back to the logbook when the climb has no counts', () => {
      const climb = makeClimb({ uuid: 'c1' });
      // Climb is created via makeClimb without userAscents / userAttempts.
      expect(hasPriorHistoryForClimb(climb, [])).toBe(false);
      expect(
        hasPriorHistoryForClimb(climb, [makeLogbookEntry({ climb_uuid: 'c1' })]),
      ).toBe(true);
      expect(
        hasPriorHistoryForClimb(climb, [makeLogbookEntry({ climb_uuid: 'other' })]),
      ).toBe(false);
    });
  });

  describe('layout', () => {
    it('renders the controls in the expected order: rating, comment toggle, grade, attempt, confirm — all clustered to the right', () => {
      render(<QuickTickBar {...defaultProps} />);

      const rating = screen.getByTestId('quick-tick-rating');
      const commentToggle = screen.getByRole('button', { name: /toggle comment/i });
      const gradeLabel = screen.getByTestId('quick-tick-grade');
      const attemptBtn = screen.getByTestId('quick-tick-attempt');
      const confirmBtn = screen.getByTestId('quick-tick-confirm');

      // Rating sits directly inside the single flex row alongside the
      // comment toggle, grade label, attempt and confirm buttons. The
      // "swipe left to dismiss" hint is no longer rendered here — it lives
      // as a transient toast above the queue control bar instead.
      const controls = rating.parentElement!;
      expect(commentToggle.parentElement).toBe(controls);
      expect(gradeLabel.parentElement).toBe(controls);
      expect(attemptBtn.parentElement).toBe(controls);
      expect(confirmBtn.parentElement).toBe(controls);

      // Siblings of .controls must appear in this order: rating, comment
      // toggle, grade label, attempt (X), confirm (tick). The grade sits
      // immediately to the left of the attempt button and the confirm
      // button is the final element.
      const siblings = Array.from(controls.children) as HTMLElement[];
      const ratingIdx = siblings.indexOf(rating);
      const commentIdx = siblings.indexOf(commentToggle);
      const gradeIdx = siblings.indexOf(gradeLabel);
      const attemptIdx = siblings.indexOf(attemptBtn);
      const confirmIdx = siblings.indexOf(confirmBtn);
      expect(ratingIdx).toBeLessThan(commentIdx);
      expect(commentIdx).toBeLessThan(gradeIdx);
      expect(gradeIdx).toBeLessThan(attemptIdx);
      expect(confirmIdx).toBe(attemptIdx + 1);
    });

    it('does not render the swipe hint inline — the hint lives above the bar as a transient toast', () => {
      render(<QuickTickBar {...defaultProps} />);
      expect(screen.queryByTestId('quick-tick-hint')).toBeNull();
    });

    it('invokes onCommentToggle when the comment button is tapped', () => {
      render(<QuickTickBar {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /toggle comment/i }));
      expect(defaultProps.onCommentToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('save behaviour — history-aware default', () => {
    it('saves as flash with attemptCount 1 when the logbook is empty', async () => {
      mockLogbookRef.current = [];
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      expect(mockSaveTick).toHaveBeenCalledTimes(1);
      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('flash');
      expect(call.attemptCount).toBe(1);
      expect(call.climbUuid).toBe('climb-1');
      expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    });

    it('saves as send with attemptCount 1 when there is one prior log', async () => {
      mockLogbookRef.current = [
        makeLogbookEntry({ uuid: 'p1', climb_uuid: 'climb-1', angle: 40 }),
      ];
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('send');
      expect(call.attemptCount).toBe(1);
    });

    it('still logs a single send row (attemptCount 1) when there are multiple prior logs', async () => {
      mockLogbookRef.current = [
        makeLogbookEntry({ uuid: 'p1', status: 'attempt' }),
        makeLogbookEntry({ uuid: 'p2', status: 'attempt' }),
        makeLogbookEntry({ uuid: 'p3', status: 'attempt' }),
      ];
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('send');
      expect(call.attemptCount).toBe(1);
    });

    it('ignores logbook rows for other climbs when deciding flash vs send', async () => {
      mockLogbookRef.current = [
        makeLogbookEntry({ uuid: 'other-climb', climb_uuid: 'climb-other', angle: 40 }),
      ];
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('flash');
      expect(call.attemptCount).toBe(1);
    });

    it('saves the attempt button as status attempt with attemptCount 1 regardless of history', async () => {
      mockLogbookRef.current = [
        makeLogbookEntry({ uuid: 'p1' }),
        makeLogbookEntry({ uuid: 'p2' }),
      ];
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        screen.getByTestId('quick-tick-attempt').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('attempt');
      expect(call.attemptCount).toBe(1);
      expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    });

    it('uses userAscents on the climb to default to send without touching the logbook', async () => {
      // Logbook is intentionally empty — the fast path should look at the
      // climb's own counts and still treat this as a send.
      mockLogbookRef.current = [];
      const climbWithHistory = makeClimb({ userAscents: 2, userAttempts: 0 });

      render(<QuickTickBar {...defaultProps} currentClimb={climbWithHistory} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('send');
      expect(call.attemptCount).toBe(1);
    });

    it('uses userAttempts on the climb to default to send without touching the logbook', async () => {
      mockLogbookRef.current = [];
      const climbWithAttempts = makeClimb({ userAscents: 0, userAttempts: 1 });

      render(<QuickTickBar {...defaultProps} currentClimb={climbWithAttempts} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.status).toBe('send');
      expect(call.attemptCount).toBe(1);
    });

    it('reflects the quality rating in the save payload', async () => {
      render(<QuickTickBar {...defaultProps} />);

      // MUI Rating renders radio inputs for each star value.
      const threeStars = screen.getAllByRole('radio', { name: /3 star/i })[0];
      fireEvent.click(threeStars);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.quality).toBe(3);
    });

    it('does not call onSave when saveTick rejects and leaves the bar mounted', async () => {
      mockSaveTick.mockRejectedValueOnce(new Error('network down'));
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      expect(mockSaveTick).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSave).not.toHaveBeenCalled();
      // Bar should still be mounted and usable for a retry.
      expect(screen.getByTestId('quick-tick-bar')).toBeTruthy();
      const confirm = screen.getByTestId('quick-tick-confirm') as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
    });
  });

  describe('null currentClimb on mount', () => {
    it('renders without crashing when currentClimb is initially null', () => {
      render(<QuickTickBar {...defaultProps} currentClimb={null} />);
      expect(screen.getByTestId('quick-tick-bar')).toBeTruthy();
    });

    it('does not call saveTick when currentClimb is null and confirm is clicked', async () => {
      render(<QuickTickBar {...defaultProps} currentClimb={null} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      expect(mockSaveTick).not.toHaveBeenCalled();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('defers the snapshot until a non-null climb arrives', async () => {
      const climb = makeClimb({ uuid: 'deferred-climb' });
      const { rerender } = render(<QuickTickBar {...defaultProps} currentClimb={null} />);

      // Snapshot should be absent — confirm should be a no-op.
      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });
      expect(mockSaveTick).not.toHaveBeenCalled();

      // Now provide a climb — the snapshot should be initialized.
      rerender(<QuickTickBar {...defaultProps} currentClimb={climb} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      expect(mockSaveTick).toHaveBeenCalledTimes(1);
      expect(mockSaveTick.mock.calls[0][0].climbUuid).toBe('deferred-climb');
    });
  });

  describe('climb snapshot', () => {
    it('keeps ticking the original climb even when currentClimb prop changes', async () => {
      const originalClimb = makeClimb({ uuid: 'original-climb' });
      const newClimb = makeClimb({ uuid: 'new-climb' });

      // Original climb has no prior history.
      // The new climb has 5 prior rows — if the component ever resolved the
      // "live" props instead of its snapshot, we would see send/6 below.
      mockLogbookRef.current = [
        makeLogbookEntry({ uuid: 'n1', climb_uuid: 'new-climb' }),
        makeLogbookEntry({ uuid: 'n2', climb_uuid: 'new-climb' }),
        makeLogbookEntry({ uuid: 'n3', climb_uuid: 'new-climb' }),
        makeLogbookEntry({ uuid: 'n4', climb_uuid: 'new-climb' }),
        makeLogbookEntry({ uuid: 'n5', climb_uuid: 'new-climb' }),
      ];

      const { rerender } = render(
        <QuickTickBar {...defaultProps} currentClimb={originalClimb} />,
      );

      // Simulate another party member advancing the queue mid-tick.
      rerender(<QuickTickBar {...defaultProps} currentClimb={newClimb} />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      const call = mockSaveTick.mock.calls[0][0];
      expect(call.climbUuid).toBe('original-climb');
      expect(call.status).toBe('flash');
      expect(call.attemptCount).toBe(1);
    });
  });

  describe('swipe to dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('calls onCancel when swiped left past the threshold', () => {
      render(<QuickTickBar {...defaultProps} />);
      const bar = screen.getByTestId('quick-tick-bar');

      simulateSwipe(bar, -120);

      // Exit animation is scheduled via setTimeout — advance to flush it.
      act(() => {
        vi.runAllTimers();
      });

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when swipe is below the threshold', () => {
      render(<QuickTickBar {...defaultProps} />);
      const bar = screen.getByTestId('quick-tick-bar');

      simulateSwipe(bar, -40);

      act(() => {
        vi.runAllTimers();
      });

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });

    it('ignores swipes while the commentFocused prop is true', () => {
      // The comment TextField lives in the parent QueueControlBar, so the
      // bar learns that the user is typing via the `commentFocused` prop.
      render(<QuickTickBar {...defaultProps} commentFocused={true} />);

      const bar = screen.getByTestId('quick-tick-bar');
      simulateSwipe(bar, -200);

      act(() => {
        vi.runAllTimers();
      });

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('controlled comment prop', () => {
    it('forwards the comment prop in the save payload', async () => {
      render(<QuickTickBar {...defaultProps} comment="sick send" />);

      await act(async () => {
        screen.getByTestId('quick-tick-confirm').click();
      });

      expect(mockSaveTick).toHaveBeenCalledTimes(1);
      expect(mockSaveTick.mock.calls[0][0].comment).toBe('sick send');
    });
  });

  describe('displayedGrades — grade window logic', () => {
    // The component only narrows the grade list when the climb's difficulty
    // string matches a difficulty_name in TENSION_KILTER_GRADES exactly
    // (e.g. '6c/V5'). Strings like 'V5' produce no match, so climbGradeId
    // is undefined and all 24 grades are shown.

    it('shows all 24 grades when the climb difficulty does not match any grade name', () => {
      // makeClimb() defaults to difficulty: 'V5', which has no entry in the
      // grade list (names use the full '6c/V5' format).
      render(<QuickTickBar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      // 24 grade rows + 1 "—" (no-grade) row
      expect(items).toHaveLength(25);
    });

    it('shows all 24 grades when the climb has no difficulty set', () => {
      const climb = makeClimb({ difficulty: undefined });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(25);
    });

    it('shows a 5-grade window (±2) around a mid-range matched grade', () => {
      // '6c/V5' is difficulty_id 20 at index 10 in the grade array.
      // window: max(0, 10-2)=8 … min(24, 10+3)=13  →  indices 8–12.
      // Those map to: 6b/V4, 6b+/V4, 6c/V5, 6c+/V5, 7a/V6
      const climb = makeClimb({ difficulty: '6c/V5' });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(6); // 5 grade rows + "—"

      const gradeLabels = items.slice(1).map((el) => el.textContent);
      expect(gradeLabels).toEqual(['V4', 'V4', 'V5', 'V5', 'V6']);
    });

    it('clamps the lower boundary: V0 at index 0 yields only 3 grades', () => {
      // '4a/V0' is difficulty_id 10 at index 0.
      // start = max(0, 0-2) = 0, end = min(24, 0+3) = 3  →  3 grades
      const climb = makeClimb({ difficulty: '4a/V0' });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(4); // 3 grade rows + "—"

      const gradeLabels = items.slice(1).map((el) => el.textContent);
      expect(gradeLabels).toEqual(['V0', 'V0', 'V0']);
    });

    it('clamps the upper boundary: V16 at the last index yields only 3 grades', () => {
      // '8c+/V16' is difficulty_id 33 at index 23 (last entry).
      // start = max(0, 23-2) = 21, end = min(24, 23+3) = 24  →  3 grades
      const climb = makeClimb({ difficulty: '8c+/V16' });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(4); // 3 grade rows + "—"

      const gradeLabels = items.slice(1).map((el) => el.textContent);
      expect(gradeLabels).toEqual(['V14', 'V15', 'V16']);
    });

    it('near-low boundary: second grade (4b/V0 at index 1) yields 4 grades', () => {
      // start = max(0, 1-2) = 0, end = min(24, 1+3) = 4  →  4 grades
      const climb = makeClimb({ difficulty: '4b/V0' });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(5); // 4 grade rows + "—"
    });

    it('near-high boundary: second-to-last grade (8c/V15 at index 22) yields 4 grades', () => {
      // start = max(0, 22-2) = 20, end = min(24, 22+3) = 24  →  4 grades
      const climb = makeClimb({ difficulty: '8c/V15' });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);
      fireEvent.click(screen.getByTestId('quick-tick-grade'));

      const items = screen.getAllByRole('menuitem');
      expect(items).toHaveLength(5); // 4 grade rows + "—"
    });
  });

  describe('grade menu autoFocus', () => {
    it('focuses the matched grade item when the menu opens', async () => {
      // '6c/V5' matches difficulty_id 20 exactly, so currentGradeId = 20
      // and isCurrent is true for that MenuItem.  autoFocus={isCurrent} means
      // React calls .focus() on that element when the menu mounts.
      const climb = makeClimb({ difficulty: '6c/V5' });
      render(<QuickTickBar {...defaultProps} currentClimb={climb} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('quick-tick-grade'));
      });

      // Wait for MUI's focus management to settle.
      await waitFor(() => {
        const active = document.activeElement;
        expect(active?.getAttribute('role')).toBe('menuitem');
        // The focused item should carry the Mui-selected class (selected={isCurrent})
        // confirming it is the current-grade item, not just the first item.
        expect(active?.classList.contains('Mui-selected')).toBe(true);
        expect(active?.textContent).toBe('V5');
      });
    });

    it('does not auto-focus any grade item when the climb has no matched difficulty', async () => {
      // When climbGradeId is undefined, currentGradeId is also undefined and
      // isCurrent is false for every row, so no item has autoFocus={true}.
      // MUI falls back to focusing the first focusable item in the menu (the
      // "—" option), which does NOT have Mui-selected.
      render(<QuickTickBar {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('quick-tick-grade'));
      });

      await waitFor(() => {
        const items = screen.getAllByRole('menuitem');
        const selectedItems = items.filter((el) => el.classList.contains('Mui-selected'));
        expect(selectedItems).toHaveLength(0);
      });
    });
  });
});

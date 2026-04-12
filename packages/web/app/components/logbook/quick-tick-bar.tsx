'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSwipeable } from 'react-swipeable';
import Stack from '@mui/material/Stack';
import { track } from '@vercel/analytics';
import { Angle, Climb, BoardDetails } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import type { LogbookEntry, TickStatus } from '@/app/hooks/use-logbook';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import { TickControls } from './tick-controls';
import styles from './quick-tick-bar.module.css';

/** Snapshot of the tick target taken when the bar is first opened with a valid climb. */
interface TickTarget {
  climb: Climb;
  angle: Angle;
  boardDetails: BoardDetails;
  /** Whether the user has any prior logbook history for this climb at open time. */
  hasPriorHistory: boolean;
}

export interface QuickTickBarProps {
  currentClimb: Climb | null;
  angle: Angle;
  boardDetails: BoardDetails;
  onSave: () => void;
  onCancel: () => void;
  /** Current comment text. Owned by the parent so the comment field can live
   *  outside this bar (above the queue control bar) without causing reflow. */
  comment: string;
  /** Whether the parent is currently rendering the comment input. */
  commentOpen: boolean;
  /** Called when the user taps the comment button inside this bar. */
  onCommentToggle: () => void;
  /** Whether the parent's comment input currently has focus. Used to disable
   *  the swipe-to-dismiss gesture so the user can type without the bar
   *  sliding away under them. */
  commentFocused: boolean;
}

const SWIPE_DISMISS_THRESHOLD = 80;
const EXIT_DURATION_MS = 220;
const SNAP_BACK_DURATION_MS = 180;

/**
 * Stateful tick entry wrapper. Manages the tick target snapshot, form state
 * (quality, difficulty, attempts), save logic, and swipe-to-dismiss gesture.
 * Renders TickControls for the actual UI buttons.
 *
 * Designed to be embedded in the queue control bar's button cluster position
 * (replacing the normal navigation/action buttons when tick mode is active).
 */
export const QuickTickBar: React.FC<QuickTickBarProps> = ({
  currentClimb,
  angle,
  boardDetails,
  onSave,
  onCancel,
  comment,
  commentOpen,
  onCommentToggle,
  commentFocused,
}) => {
  const { saveTick, logbook } = useBoardProvider();

  // Snapshot the target climb the first time we get a non-null climb.
  // All subsequent saves use this snapshot, not the live props.
  const [tickTarget, setTickTarget] = useState<TickTarget | null>(() =>
    currentClimb ? buildTickTarget(currentClimb, angle, boardDetails, logbook) : null,
  );
  useEffect(() => {
    if (!tickTarget && currentClimb) {
      setTickTarget(buildTickTarget(currentClimb, angle, boardDetails, logbook));
    }
    // Intentionally only re-runs while we have no snapshot yet. Once set, the
    // snapshot is intentionally sticky until the component unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClimb, tickTarget]);

  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const grades = TENSION_KILTER_GRADES;

  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  // Fall back to matching the climb's own difficulty string against the
  // grade list so the menu can highlight the "current" grade even before
  // the user picks an override.
  const climbGradeId = useMemo(() => {
    const source = tickTarget?.climb.difficulty ?? currentClimb?.difficulty;
    if (!source) return undefined;
    return grades.find((g) => g.difficulty_name === source)?.difficulty_id;
  }, [tickTarget, currentClimb, grades]);
  const currentGradeId = difficulty ?? climbGradeId;

  // When the climb already has an established grade, only show a narrow
  // window of 5 grades (two softer, two harder) around it so the user can
  // nudge up or down without scrolling through the full V0 → V16 list.
  // Projects without a grade still see every option.
  const displayedGrades = useMemo(() => {
    if (climbGradeId === undefined) return grades;
    const idx = grades.findIndex((g) => g.difficulty_id === climbGradeId);
    if (idx === -1) return grades;
    const start = Math.max(0, idx - 2);
    const end = Math.min(grades.length, idx + 3);
    return grades.slice(start, end);
  }, [grades, climbGradeId]);

  const climbDifficulty = tickTarget?.climb.difficulty ?? currentClimb?.difficulty ?? undefined;

  const handleSave = useCallback(
    async (isAscent: boolean) => {
      if (!tickTarget || isSaving) return;

      const { climb, angle: targetAngle, boardDetails: targetBoard, hasPriorHistory } = tickTarget;

      // Status is history-aware for sends: a first-go send with no prior
      // history is a flash, otherwise it's a send. Multi-try sends can't be
      // flashes by definition. Non-ascents always save as `attempt`, with
      // the selected count representing how many tries the user made.
      let status: TickStatus;
      if (isAscent) {
        status = hasPriorHistory || attemptCount > 1 ? 'send' : 'flash';
      } else {
        status = 'attempt';
      }

      setIsSaving(true);
      try {
        await saveTick({
          climbUuid: climb.uuid,
          angle: Number(targetAngle),
          isMirror: !!climb.mirrored,
          status,
          attemptCount,
          quality: quality ?? undefined,
          difficulty,
          isBenchmark: false,
          comment: comment || '',
          climbedAt: new Date().toISOString(),
          layoutId: targetBoard.layout_id,
          sizeId: targetBoard.size_id,
          setIds: Array.isArray(targetBoard.set_ids)
            ? targetBoard.set_ids.join(',')
            : String(targetBoard.set_ids),
        });

        track('Quick Tick Saved', {
          boardLayout: targetBoard.layout_name || '',
          status,
          attemptCount,
          hasQuality: quality !== null,
          hasDifficulty: difficulty !== undefined,
          hasComment: comment.length > 0,
        });

        onSave();
      } catch {
        // Error surfaced via snackbar inside useSaveTick.
        track('Quick Tick Failed', {
          boardLayout: targetBoard.layout_name || '',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [tickTarget, quality, difficulty, comment, isSaving, saveTick, onSave, attemptCount],
  );

  const handleConfirm = useCallback(() => handleSave(true), [handleSave]);
  const handleFail = useCallback(() => handleSave(false), [handleSave]);

  const triggerDismiss = useCallback(() => {
    if (isDismissing) return;
    setIsDismissing(true);
    // Slide the bar fully off-screen to the left, then tell the parent to close.
    setSwipeOffset(-window.innerWidth);
    dismissTimeoutRef.current = setTimeout(() => {
      onCancel();
    }, EXIT_DURATION_MS);
  }, [isDismissing, onCancel]);

  const swipeEnabled = !commentFocused && !isSaving && !isDismissing;

  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!swipeEnabled) return;
      // Only track horizontal left drags.
      if (Math.abs(eventData.deltaY) > Math.abs(eventData.deltaX)) return;
      if (eventData.deltaX > 0) {
        setSwipeOffset(0);
        return;
      }
      setSwipeOffset(eventData.deltaX);
    },
    onSwipedLeft: (eventData) => {
      if (!swipeEnabled) return;
      if (Math.abs(eventData.deltaX) >= SWIPE_DISMISS_THRESHOLD) {
        triggerDismiss();
      } else {
        setSwipeOffset(0);
      }
    },
    onSwiped: (eventData) => {
      if (!swipeEnabled) return;
      // Reset if we ended on any non-left direction.
      if (eventData.dir !== 'Left') {
        setSwipeOffset(0);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 10,
  });

  const rootStyle = useMemo<React.CSSProperties>(() => {
    const transition = isDismissing
      ? `transform ${EXIT_DURATION_MS}ms ease-out, opacity ${EXIT_DURATION_MS}ms ease-out`
      : swipeOffset === 0
        ? `transform ${SNAP_BACK_DURATION_MS}ms ease-out`
        : 'none';
    return {
      transform: `translateX(${swipeOffset}px)`,
      opacity: isDismissing ? 0 : 1,
      transition,
    };
  }, [swipeOffset, isDismissing]);

  // Apply swipe handlers only when gesture capture is allowed so focused
  // comment text selection, or in-flight saves, don't get hijacked.
  const rootHandlers = swipeEnabled ? swipeHandlers : {};

  return (
    <div
      {...rootHandlers}
      className={styles.tickBar}
      style={rootStyle}
      data-testid="quick-tick-bar"
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <TickControls
          quality={quality}
          onQualityChange={setQuality}
          attemptCount={attemptCount}
          onAttemptCountChange={setAttemptCount}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          climbDifficulty={climbDifficulty}
          displayedGrades={displayedGrades}
          currentGradeId={currentGradeId}
          commentOpen={commentOpen}
          onCommentToggle={onCommentToggle}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onFail={handleFail}
        />
      </Stack>
    </div>
  );
};

/**
 * Decide whether the user has any prior history for a climb at open time.
 *
 * Fast path: the climb payload already carries `userAscents` and
 * `userAttempts` counts from the climb list query, so in the common case we
 * avoid walking the logbook entirely. When those fields are missing (e.g. the
 * climb was fetched through a slim query that does not include the user
 * aggregation), we fall back to filtering the in-memory logbook by climb
 * uuid. Exposed for tests.
 */
export function hasPriorHistoryForClimb(
  climb: Climb,
  logbook: LogbookEntry[],
): boolean {
  const ascents = climb.userAscents;
  const attempts = climb.userAttempts;
  if (ascents != null || attempts != null) {
    return (ascents ?? 0) + (attempts ?? 0) > 0;
  }
  // Fallback: slim climb payload — consult the local logbook instead.
  return logbook.some((entry) => entry.climb_uuid === climb.uuid);
}

function buildTickTarget(
  climb: Climb,
  angle: Angle,
  boardDetails: BoardDetails,
  logbook: LogbookEntry[],
): TickTarget {
  return {
    climb,
    angle,
    boardDetails,
    hasPriorHistory: hasPriorHistoryForClimb(climb, logbook),
  };
}

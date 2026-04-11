'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSwipeable } from 'react-swipeable';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
// NOTE: the "swipe left to dismiss" hint is intentionally NOT rendered here —
// it lives above the queue control bar as a transient toast so it doesn't
// push the stars out of alignment with the action buttons.
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import { track } from '@vercel/analytics';
import { Angle, Climb, BoardDetails } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import type { LogbookEntry, TickStatus } from '@/app/hooks/use-logbook';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import { themeTokens } from '@/app/theme/theme-config';
import { formatVGrade, getSoftVGradeColor } from '@/app/lib/grade-colors';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
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
 * Inline tick entry bar. Designed to be embedded in a parent row (e.g. the queue
 * control bar) in place of the climb title. The component owns its own snapshot
 * of the climb so that mid-flow changes to the active climb (party session
 * navigation, etc.) do not cause the user to lose their in-progress tick.
 *
 * Tapping the tick button logs one row for the climb. The user picks the
 * attempt count (1–9+) from the attempts counter to the left of the tick
 * button; the saved row carries that count. Status is history-aware: a first
 * attempt with no prior history records as `flash`, otherwise as `send`.
 * Totals are derived server-side by aggregating rows.
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
  const isDark = useIsDarkMode();

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
  const [gradeAnchorEl, setGradeAnchorEl] = useState<HTMLElement | null>(null);
  const [attemptAnchorEl, setAttemptAnchorEl] = useState<HTMLElement | null>(null);
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

  const selectedGrade = difficulty
    ? grades.find((g) => g.difficulty_id === difficulty)
    : undefined;

  // Prefer the user's override (which carries the full "font/v" difficulty
  // name so formatVGrade can disambiguate V5 vs V5+), otherwise fall back
  // to the snapshot climb's own difficulty string.
  const displayDifficulty =
    selectedGrade?.difficulty_name ?? tickTarget?.climb.difficulty ?? currentClimb?.difficulty ?? '';
  const vGrade = formatVGrade(displayDifficulty);
  const gradeLabel = vGrade ?? (displayDifficulty || '—');
  const gradeColor = getSoftVGradeColor(vGrade, isDark);

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

  const handleConfirm = useCallback(
    async () => {
      if (!tickTarget || isSaving) return;

      const { climb, angle: targetAngle, boardDetails: targetBoard, hasPriorHistory } = tickTarget;

      // Status is history-aware: flash only if the user has no prior history
      // for this climb AND this is a one-try send; otherwise send. The user
      // can pick how many attempts this send took via the attempts picker.
      const status: TickStatus =
        hasPriorHistory || attemptCount > 1 ? 'send' : 'flash';

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

  const userAscentsCount =
    tickTarget?.climb.userAscents ?? currentClimb?.userAscents ?? 0;

  const attemptOptions = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const, []);
  const attemptDisplay = attemptCount >= 10 ? '9+' : String(attemptCount);

  return (
    <div
      {...rootHandlers}
      className={styles.tickBar}
      style={rootStyle}
      data-testid="quick-tick-bar"
    >
      <div className={styles.controls}>
        {/* Order: stars, comment, grade, # ascents, attempt, tick. The
            rating sits to the right of the bar, sized to match the adjacent
            icon buttons. */}
        <Rating
          value={quality}
          onChange={(_, val) => setQuality(val)}
          max={5}
          data-testid="quick-tick-rating"
          className={styles.rating}
        />

        <IconButton
          size="small"
          onClick={onCommentToggle}
          color={commentOpen ? 'primary' : 'default'}
          aria-label="Toggle comment"
        >
          <ChatBubbleOutlineOutlined fontSize="small" />
        </IconButton>

        {/* Colourised V-grade, matching the styling used by ClimbTitle's
            right-aligned large grade. Click opens the override menu. */}
        <Typography
          variant="body2"
          component="span"
          onClick={(e) => setGradeAnchorEl(e.currentTarget)}
          role="button"
          aria-label="Select logged grade"
          data-testid="quick-tick-grade"
          className={styles.gradeLabel}
          sx={{
            fontSize: themeTokens.typography.fontSize.sm,
            fontWeight: themeTokens.typography.fontWeight.bold,
            lineHeight: 1,
            color: gradeColor ?? 'text.secondary',
            cursor: 'pointer',
            flexShrink: 0,
            px: '4px',
          }}
        >
          {gradeLabel}
        </Typography>
        <Menu
          anchorEl={gradeAnchorEl}
          open={Boolean(gradeAnchorEl)}
          onClose={() => setGradeAnchorEl(null)}
          slotProps={{ paper: { sx: { maxHeight: 240 } } }}
        >
          <MenuItem
            onClick={() => {
              setDifficulty(undefined);
              setGradeAnchorEl(null);
            }}
          >
            —
          </MenuItem>
          {displayedGrades.map((grade) => {
            const isCurrent = grade.difficulty_id === currentGradeId;
            return (
              <MenuItem
                key={grade.difficulty_id}
                selected={isCurrent}
                autoFocus={isCurrent}
                onClick={() => {
                  setDifficulty(grade.difficulty_id);
                  setGradeAnchorEl(null);
                }}
              >
                {grade.v_grade}
              </MenuItem>
            );
          })}
        </Menu>

        {/* Prior ascent count for this climb — display only. Shown before
            the attempts picker so the user knows how many sends they
            already have before logging another. */}
        <Typography
          variant="body2"
          component="span"
          aria-label={`${userAscentsCount} prior ascent${userAscentsCount === 1 ? '' : 's'}`}
          data-testid="quick-tick-ascents"
          className={styles.ascents}
        >
          #{userAscentsCount}
        </Typography>

        {/* Attempts counter. Shows the selected attempt count aligned on the
            same baseline as the adjacent items; the "attempts" byline is
            absolutely positioned underneath so it does not push the number
            out of alignment. Opens a small menu upward with options 1–9+. */}
        <button
          type="button"
          onClick={(e) => setAttemptAnchorEl(e.currentTarget)}
          aria-label={`Attempts: ${attemptDisplay}`}
          aria-haspopup="menu"
          aria-expanded={Boolean(attemptAnchorEl)}
          data-testid="quick-tick-attempt"
          className={styles.attemptButton}
        >
          <span className={styles.attemptNumber}>{attemptDisplay}</span>
          <span className={styles.attemptLabel}>attempts</span>
        </button>
        <Menu
          anchorEl={attemptAnchorEl}
          open={Boolean(attemptAnchorEl)}
          onClose={() => setAttemptAnchorEl(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          slotProps={{ paper: { sx: { minWidth: 64 } } }}
        >
          {attemptOptions.map((n) => (
            <MenuItem
              key={n}
              selected={n === attemptCount}
              onClick={() => {
                setAttemptCount(n);
                setAttemptAnchorEl(null);
              }}
              data-testid={`quick-tick-attempt-option-${n === 10 ? '9plus' : n}`}
            >
              {n === 10 ? '9+' : n}
            </MenuItem>
          ))}
        </Menu>

        <IconButton
          size="small"
          onClick={handleConfirm}
          disabled={isSaving}
          className={styles.confirmButton}
          sx={{
            color: themeTokens.colors.success,
            opacity: themeTokens.opacity.subtle,
            '&:hover': {
              color: themeTokens.colors.successHover,
              opacity: 1,
            },
          }}
          aria-label="Confirm ascent"
          data-testid="quick-tick-confirm"
        >
          <CheckOutlined fontSize="small" />
        </IconButton>
      </div>
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

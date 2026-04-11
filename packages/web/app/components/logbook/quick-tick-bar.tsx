'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSwipeable } from 'react-swipeable';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
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
 * Each tap on the bar logs exactly one row with `attemptCount: 1`. The status
 * is history-aware: if the user has no prior logbook rows for this climb
 * the tick is recorded as a `flash`, otherwise it is recorded as a
 * `send`. Totals are derived server-side by aggregating rows.
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

  const handleSave = useCallback(
    async (isAscent: boolean) => {
      if (!tickTarget || isSaving) return;

      const { climb, angle: targetAngle, boardDetails: targetBoard, hasPriorHistory } = tickTarget;

      // One tap == one row. Status is history-aware: flash only if the user
      // has no prior history for this climb; otherwise send. attemptCount is
      // always 1 because each row represents a single climbing action.
      let status: TickStatus;
      if (isAscent) {
        status = hasPriorHistory ? 'send' : 'flash';
      } else {
        status = 'attempt';
      }
      const attemptCount = 1;

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
    [tickTarget, quality, difficulty, comment, isSaving, saveTick, onSave],
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
      <div className={styles.controls}>
        {/* Single horizontal row: rating, comment toggle, "swipe to dismiss"
            hint, spacer, colourised V-grade, attempt (X) and confirm (tick).
            The grade sits immediately to the left of the attempt button and
            opens a grade override menu on click. */}
        <Rating
          value={quality}
          onChange={(_, val) => setQuality(val)}
          size="small"
          max={5}
          sx={{ flexShrink: 0 }}
          data-testid="quick-tick-rating"
        />

        <IconButton
          size="small"
          onClick={onCommentToggle}
          color={commentOpen ? 'primary' : 'default'}
          aria-label="Toggle comment"
        >
          <ChatBubbleOutlineOutlined fontSize="small" />
        </IconButton>

        {!commentOpen && (
          <Typography
            variant="body2"
            component="span"
            color="text.secondary"
            className={styles.hint}
            data-testid="quick-tick-hint"
          >
            swipe left to dismiss
          </Typography>
        )}

        <span className={styles.spacer} />

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
          {grades.map((grade) => (
            <MenuItem
              key={grade.difficulty_id}
              selected={grade.difficulty_id === difficulty}
              onClick={() => {
                setDifficulty(grade.difficulty_id);
                setGradeAnchorEl(null);
              }}
            >
              {grade.v_grade}
            </MenuItem>
          ))}
        </Menu>

        <IconButton
          onClick={handleFail}
          disabled={isSaving}
          sx={{
            backgroundColor: themeTokens.colors.error,
            color: 'common.white',
            '&:hover': { backgroundColor: themeTokens.colors.error },
          }}
          aria-label="Log attempt"
          data-testid="quick-tick-attempt"
        >
          <CloseOutlined />
        </IconButton>

        <IconButton
          onClick={handleConfirm}
          disabled={isSaving}
          sx={{
            backgroundColor: themeTokens.colors.success,
            color: 'common.white',
            '&:hover': { backgroundColor: themeTokens.colors.successHover },
          }}
          aria-label="Confirm ascent"
          data-testid="quick-tick-confirm"
        >
          <CheckOutlined />
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

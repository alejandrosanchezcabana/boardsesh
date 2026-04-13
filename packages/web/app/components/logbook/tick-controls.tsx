'use client';

import React, { useRef, useState, useLayoutEffect, useEffect, useCallback, forwardRef } from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import StarIcon from '@mui/icons-material/Star';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { themeTokens } from '@/app/theme/theme-config';
import { useGradeFormat } from '@/app/hooks/use-grade-format';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import styles from './tick-controls.module.css';

export type ExpandedControl = 'grade' | 'stars' | 'tries' | null;

/**
 * Stops touch events from propagating to parent react-swipeable handlers.
 * Without this, the parent's `preventScrollOnSwipe: true` calls preventDefault()
 * on touchmove, blocking native horizontal scroll in the picker.
 */
function useStopTouchPropagation(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const stop = (e: TouchEvent) => e.stopPropagation();

    // Must use { passive: true } so the browser can still scroll natively.
    // stopPropagation prevents the parent swipeable from seeing the event,
    // but does NOT block the browser's default scroll behavior.
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    el.addEventListener('touchend', stop, { passive: true });

    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchmove', stop);
      el.removeEventListener('touchend', stop);
    };
  }, [ref]);
}

/**
 * Tracks whether a scrollable container can scroll left/right.
 * Updates on scroll, resize, and content changes.
 */
function useScrollIndicators(ref: React.RefObject<HTMLElement | null>) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();
    el.addEventListener('scroll', update, { passive: true });

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [ref, update]);

  return { canScrollLeft, canScrollRight };
}

/** Wraps a scrollable picker row with fade+arrow indicators on overflowing edges. */
const ScrollIndicatorWrapper: React.FC<{
  canScrollLeft: boolean;
  canScrollRight: boolean;
  children: React.ReactNode;
}> = ({ canScrollLeft, canScrollRight, children }) => (
  <div className={styles.scrollableWrapper}>
    <div className={`${styles.scrollIndicator} ${styles.scrollIndicatorLeft} ${canScrollLeft ? styles.scrollIndicatorVisible : ''}`}>
      <ChevronLeftIcon sx={{ fontSize: 16 }} />
    </div>
    {children}
    <div className={`${styles.scrollIndicator} ${styles.scrollIndicatorRight} ${canScrollRight ? styles.scrollIndicatorVisible : ''}`}>
      <ChevronRightIcon sx={{ fontSize: 16 }} />
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Grade button — rendered separately from stars/tries for alignment */
/* ------------------------------------------------------------------ */

export interface TickGradeButtonProps {
  /** Current difficulty override (difficulty_id or undefined). */
  difficulty: number | undefined;
  /** The climb's own difficulty string, used as fallback display. */
  climbDifficulty: string | undefined;
  /** Grade list for looking up the selected grade name. */
  displayedGrades: readonly { difficulty_id: number; difficulty_name: string; v_grade: string }[];
  /** Which control's picker is currently expanded. */
  expandedControl: ExpandedControl;
  /** Toggle a control's picker open/closed. */
  onExpandedControlChange: (control: ExpandedControl) => void;
}

/**
 * Standalone grade button — positioned independently from the
 * stars/tries controls so it can align with the consensus grade below.
 * Uses forwardRef so the parent can measure its position for picker scroll alignment.
 */
export const TickGradeButton = forwardRef<HTMLButtonElement, TickGradeButtonProps>(({
  difficulty,
  climbDifficulty,
  displayedGrades,
  expandedControl,
  onExpandedControlChange,
}, ref) => {
  const isDark = useIsDarkMode();
  const { formatGrade, getGradeColor, loaded: gradeFormatLoaded } = useGradeFormat();

  const selectedGrade = difficulty
    ? displayedGrades.find((g) => g.difficulty_id === difficulty)
    : undefined;

  const displayDifficulty = selectedGrade?.difficulty_name ?? climbDifficulty ?? '';
  const formattedGrade = formatGrade(displayDifficulty);
  const gradeLabel = formattedGrade ?? (displayDifficulty || '—');
  const gradeColor = getGradeColor(displayDifficulty, isDark);

  return (
    <ButtonBase
      ref={ref}
      onClick={() => onExpandedControlChange(expandedControl === 'grade' ? null : 'grade')}
      aria-label="Select logged grade"
      aria-haspopup="listbox"
      aria-expanded={expandedControl === 'grade'}
      data-testid="quick-tick-grade"
      className={`${styles.gradeButton} ${expandedControl === 'grade' ? styles.active : ''}`}
      disableRipple={false}
    >
      {!gradeFormatLoaded ? (
        <Skeleton variant="rounded" width={24} height={14} />
      ) : (
        <span className={styles.gradeNumber} style={{ color: gradeColor ?? undefined }}>
          {gradeLabel}
        </span>
      )}
      <span className={styles.gradeByline}>user</span>
    </ButtonBase>
  );
});

TickGradeButton.displayName = 'TickGradeButton';

/* ------------------------------------------------------------------ */
/*  Stars + Tries controls                                            */
/* ------------------------------------------------------------------ */

export interface TickControlsProps {
  /** Current quality rating (1–5 or null). */
  quality: number | null;
  /** Current attempt count. */
  attemptCount: number;
  /** Whether save is in progress. */
  isSaving: boolean;
  /** Which control's picker is currently expanded (null = none). */
  expandedControl: ExpandedControl;
  /** Toggle a control's picker open/closed. */
  onExpandedControlChange: (control: ExpandedControl) => void;
  /** Ref forwarded to the tries button for picker scroll alignment. */
  triesButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Stars + Tries buttons. Grade is rendered separately via TickGradeButton
 * for alignment with the consensus grade in the queue bar.
 */
export const TickControls: React.FC<TickControlsProps> = ({
  quality,
  attemptCount,
  isSaving,
  expandedControl,
  onExpandedControlChange,
  triesButtonRef,
}) => {
  const attemptDisplay = String(attemptCount);

  const toggle = (control: 'stars' | 'tries') => {
    onExpandedControlChange(expandedControl === control ? null : control);
  };

  return (
    <>
      {/* Star selector */}
      <ButtonBase
        onClick={() => toggle('stars')}
        aria-label={`Quality: ${quality ?? 'none'}`}
        aria-haspopup="listbox"
        aria-expanded={expandedControl === 'stars'}
        data-testid="quick-tick-rating"
        className={`${styles.starButton} ${expandedControl === 'stars' ? styles.active : ''}`}
        disableRipple={false}
      >
        <StarIcon sx={{ fontSize: 14, color: quality ? themeTokens.colors.amber : 'inherit' }} />
        <span className={styles.starNumber}>{quality ?? '—'}</span>
        <span className={styles.starLabel}>stars</span>
      </ButtonBase>

      {/* Tries counter */}
      <ButtonBase
        ref={triesButtonRef}
        onClick={() => toggle('tries')}
        aria-label={`Tries: ${attemptDisplay}`}
        aria-haspopup="listbox"
        aria-expanded={expandedControl === 'tries'}
        data-testid="quick-tick-attempt"
        className={`${styles.attemptButton} ${expandedControl === 'tries' ? styles.active : ''}`}
        disableRipple={false}
      >
        <span className={styles.attemptNumber}>{attemptDisplay}</span>
        <span className={styles.attemptLabel}>tries</span>
      </ButtonBase>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Inline picker sub-components — rendered by QuickTickBar above the */
/*  button row when a control is expanded.                            */
/* ------------------------------------------------------------------ */

export const InlineStarPicker: React.FC<{
  quality: number | null;
  onSelect: (value: number | null) => void;
}> = ({ quality, onSelect }) => (
  <div className={`${styles.pickerRow} ${styles.pickerRowEnd}`} role="listbox" aria-label="Star rating">
    <ButtonBase
      onClick={() => onSelect(null)}
      className={`${styles.pickerItem} ${quality === null ? styles.pickerItemSelected : ''}`}
      aria-label="No rating"
      aria-selected={quality === null}
      role="option"
    >
      <span className={styles.pickerClear}>—</span>
    </ButtonBase>
    {[1, 2, 3, 4, 5].map((n) => (
      <ButtonBase
        key={n}
        onClick={() => onSelect(n)}
        className={`${styles.pickerItem} ${n === quality ? styles.pickerItemSelected : ''}`}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        aria-selected={n === quality}
        role="option"
      >
        <StarIcon
          sx={{
            fontSize: 22,
            color: n <= (quality ?? 0) ? themeTokens.colors.amber : 'inherit',
            opacity: n <= (quality ?? 0) ? 1 : 0.3,
          }}
        />
      </ButtonBase>
    ))}
  </div>
);

export const InlineGradePicker: React.FC<{
  grades: readonly { difficulty_id: number; difficulty_name: string; v_grade: string }[];
  currentGradeId: number | undefined;
  onSelect: (value: number | undefined) => void;
  /** Ref to the grade button for scroll alignment positioning. */
  gradeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}> = ({ grades, currentGradeId, onSelect, gradeButtonRef }) => {
  const { formatGrade, getGradeColor } = useGradeFormat();
  const isDark = useIsDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);

  useStopTouchPropagation(containerRef);
  const { canScrollLeft, canScrollRight } = useScrollIndicators(containerRef);

  // On mount, scroll so the selected grade aligns above the grade button.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const gradeButton = gradeButtonRef?.current;
    if (!container || !gradeButton || currentGradeId === undefined) return;

    const selectedEl = container.querySelector(
      `[data-grade-id="${currentGradeId}"]`,
    ) as HTMLElement | null;
    if (!selectedEl) return;

    const containerRect = container.getBoundingClientRect();
    const gradeButtonRect = gradeButton.getBoundingClientRect();

    const gradeButtonCenterInContainer =
      gradeButtonRect.left + gradeButtonRect.width / 2 - containerRect.left;
    const selectedItemCenter =
      selectedEl.offsetLeft + selectedEl.offsetWidth / 2;

    const targetScrollLeft = selectedItemCenter - gradeButtonCenterInContainer;
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
  }, [currentGradeId, gradeButtonRef]);

  return (
    <ScrollIndicatorWrapper canScrollLeft={canScrollLeft} canScrollRight={canScrollRight}>
      <div ref={containerRef} className={styles.pickerRowScrollable} role="listbox" aria-label="Grade override" data-scrollable-picker>
        <ButtonBase
          onClick={() => onSelect(undefined)}
          className={`${styles.pickerItem} ${currentGradeId === undefined ? styles.pickerItemSelected : ''}`}
          aria-label="Clear grade override"
          aria-selected={currentGradeId === undefined}
          role="option"
        >
          <span className={styles.pickerClear}>—</span>
        </ButtonBase>
        {grades.map((grade) => {
          const formatted = formatGrade(grade.difficulty_name) ?? grade.v_grade;
          const color = getGradeColor(grade.difficulty_name, isDark);
          const isSelected = grade.difficulty_id === currentGradeId;
          return (
            <ButtonBase
              key={grade.difficulty_id}
              data-grade-id={grade.difficulty_id}
              onClick={() => onSelect(grade.difficulty_id)}
              className={`${styles.pickerItem} ${isSelected ? styles.pickerItemSelected : ''}`}
              aria-label={formatted}
              aria-selected={isSelected}
              role="option"
            >
              <span className={styles.pickerGrade} style={{ color: color ?? undefined }}>
                {formatted}
              </span>
            </ButtonBase>
          );
        })}
      </div>
    </ScrollIndicatorWrapper>
  );
};

/** Options: 1–99. */
const ATTEMPT_OPTIONS: readonly number[] = Array.from({ length: 99 }, (_, i) => i + 1);

export const InlineTriesPicker: React.FC<{
  attemptCount: number;
  onSelect: (value: number) => void;
  /** Ref to the tries button for scroll alignment when attemptCount > 10. */
  triesButtonRef?: React.RefObject<HTMLButtonElement | null>;
}> = ({ attemptCount, onSelect, triesButtonRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useStopTouchPropagation(containerRef);
  const { canScrollLeft, canScrollRight } = useScrollIndicators(containerRef);

  // When attemptCount > 10, scroll so the selected try aligns above the tries button.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const triesButton = triesButtonRef?.current;
    if (!container || !triesButton || attemptCount <= 10) return;

    const selectedEl = container.querySelector(
      `[data-tries="${attemptCount}"]`,
    ) as HTMLElement | null;
    if (!selectedEl) return;

    const containerRect = container.getBoundingClientRect();
    const triesButtonRect = triesButton.getBoundingClientRect();

    const triesButtonCenterInContainer =
      triesButtonRect.left + triesButtonRect.width / 2 - containerRect.left;
    const selectedItemCenter =
      selectedEl.offsetLeft + selectedEl.offsetWidth / 2;

    const targetScrollLeft = selectedItemCenter - triesButtonCenterInContainer;
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
  }, [attemptCount, triesButtonRef]);

  return (
    <ScrollIndicatorWrapper canScrollLeft={canScrollLeft} canScrollRight={canScrollRight}>
      <div ref={containerRef} className={styles.pickerRowScrollable} role="listbox" aria-label="Attempt count" data-scrollable-picker>
        {ATTEMPT_OPTIONS.map((n) => (
          <ButtonBase
            key={n}
            data-tries={n}
            onClick={() => onSelect(n)}
            className={`${styles.pickerItem} ${n === attemptCount ? styles.pickerItemSelected : ''}`}
            aria-label={`${n} ${n === 1 ? 'try' : 'tries'}`}
            aria-selected={n === attemptCount}
            role="option"
          >
            <span className={styles.pickerNumber}>{n}</span>
          </ButtonBase>
        ))}
      </div>
    </ScrollIndicatorWrapper>
  );
};

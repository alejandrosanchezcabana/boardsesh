'use client';

import React from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import StarIcon from '@mui/icons-material/Star';
import { themeTokens } from '@/app/theme/theme-config';
import { useGradeFormat } from '@/app/hooks/use-grade-format';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import styles from './tick-controls.module.css';

export type ExpandedControl = 'grade' | 'stars' | 'tries' | null;

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
 */
export const TickGradeButton: React.FC<TickGradeButtonProps> = ({
  difficulty,
  climbDifficulty,
  displayedGrades,
  expandedControl,
  onExpandedControlChange,
}) => {
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
};

/* ------------------------------------------------------------------ */
/*  Stars + Tries controls                                            */
/* ------------------------------------------------------------------ */

export interface TickControlsProps {
  /** Current quality rating (1–5 or null). */
  quality: number | null;
  /** Current attempt count (1–10). */
  attemptCount: number;
  /** Whether save is in progress. */
  isSaving: boolean;
  /** Which control's picker is currently expanded (null = none). */
  expandedControl: ExpandedControl;
  /** Toggle a control's picker open/closed. */
  onExpandedControlChange: (control: ExpandedControl) => void;
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
}) => {
  const attemptDisplay = attemptCount >= 10 ? '9+' : String(attemptCount);

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
  <div className={styles.pickerRow} role="listbox" aria-label="Star rating">
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
    <ButtonBase
      onClick={() => onSelect(null)}
      className={styles.pickerItem}
      aria-label="Clear rating"
      role="option"
    >
      <span className={styles.pickerClear}>—</span>
    </ButtonBase>
  </div>
);

export const InlineGradePicker: React.FC<{
  grades: readonly { difficulty_id: number; difficulty_name: string; v_grade: string }[];
  currentGradeId: number | undefined;
  onSelect: (value: number | undefined) => void;
}> = ({ grades, currentGradeId, onSelect }) => {
  const { formatGrade, getGradeColor } = useGradeFormat();
  const isDark = useIsDarkMode();

  return (
    <div className={styles.pickerRow} role="listbox" aria-label="Grade override">
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
  );
};

/** Options: 1–9, then 9+ (value = 10). */
const ATTEMPT_OPTIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const InlineTriesPicker: React.FC<{
  attemptCount: number;
  onSelect: (value: number) => void;
}> = ({ attemptCount, onSelect }) => (
  <div className={styles.pickerRow} role="listbox" aria-label="Attempt count">
    {ATTEMPT_OPTIONS.map((n) => (
      <ButtonBase
        key={n}
        onClick={() => onSelect(n)}
        className={`${styles.pickerItem} ${n === attemptCount ? styles.pickerItemSelected : ''}`}
        aria-label={n === 10 ? '9+ tries' : `${n} ${n === 1 ? 'try' : 'tries'}`}
        aria-selected={n === attemptCount}
        role="option"
      >
        <span className={styles.pickerNumber}>{n === 10 ? '9+' : n}</span>
      </ButtonBase>
    ))}
  </div>
);

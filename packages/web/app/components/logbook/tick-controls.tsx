'use client';

import React, { useState } from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import StarIcon from '@mui/icons-material/Star';
import { themeTokens } from '@/app/theme/theme-config';
import { useGradeFormat } from '@/app/hooks/use-grade-format';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import styles from './tick-controls.module.css';

/** Options shown in the attempts picker. 10 displays as "9+" in the UI. */
const REVERSED_ATTEMPT_OPTIONS: readonly number[] = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export interface TickControlsProps {
  /** Current quality rating (1–5 or null). */
  quality: number | null;
  onQualityChange: (value: number | null) => void;
  /** Current attempt count (1–10). */
  attemptCount: number;
  onAttemptCountChange: (value: number) => void;
  /** Current difficulty override (difficulty_id or undefined). */
  difficulty: number | undefined;
  onDifficultyChange: (value: number | undefined) => void;
  /** The climb's own difficulty string, used as fallback display. */
  climbDifficulty: string | undefined;
  /** Grade list to show in the override menu. */
  displayedGrades: readonly { difficulty_id: number; difficulty_name: string; v_grade: string }[];
  /** The currently active grade id (user override or climb's own). */
  currentGradeId: number | undefined;
  /** Whether save is in progress. */
  isSaving: boolean;
}

/**
 * Reusable tick control buttons: star selector, grade picker, and tries
 * counter. Designed to be embedded in any row layout (queue control bar,
 * climb list items, etc.).
 *
 * All state is owned by the parent — this component is a pure controlled UI.
 */
export const TickControls: React.FC<TickControlsProps> = ({
  quality,
  onQualityChange,
  attemptCount,
  onAttemptCountChange,
  difficulty,
  onDifficultyChange,
  climbDifficulty,
  displayedGrades,
  currentGradeId,
  isSaving,
}) => {
  const isDark = useIsDarkMode();
  const { formatGrade, getGradeColor, loaded: gradeFormatLoaded } = useGradeFormat();

  const [starAnchorEl, setStarAnchorEl] = useState<HTMLElement | null>(null);
  const [gradeAnchorEl, setGradeAnchorEl] = useState<HTMLElement | null>(null);
  const [attemptAnchorEl, setAttemptAnchorEl] = useState<HTMLElement | null>(null);

  const selectedGrade = difficulty
    ? displayedGrades.find((g) => g.difficulty_id === difficulty)
    : undefined;

  const displayDifficulty = selectedGrade?.difficulty_name ?? climbDifficulty ?? '';
  const formattedGrade = formatGrade(displayDifficulty);
  const gradeLabel = formattedGrade ?? (displayDifficulty || '—');
  const gradeColor = getGradeColor(displayDifficulty, isDark);

  const attemptDisplay = attemptCount >= 10 ? '9+' : String(attemptCount);

  return (
    <>
      {/* Compact star selector */}
      <ButtonBase
        onClick={(e) => setStarAnchorEl(e.currentTarget)}
        aria-label={`Quality: ${quality ?? 'none'}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(starAnchorEl)}
        data-testid="quick-tick-rating"
        className={styles.starButton}
        disableRipple={false}
      >
        <StarIcon sx={{ fontSize: 14, color: quality ? themeTokens.colors.amber : 'inherit' }} />
        <span className={styles.starNumber}>{quality ?? '—'}</span>
        <span className={styles.starLabel}>stars</span>
      </ButtonBase>
      <Menu
        anchorEl={starAnchorEl}
        open={Boolean(starAnchorEl)}
        onClose={() => setStarAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { minWidth: 64 } } }}
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <MenuItem
            key={n}
            selected={n === quality}
            onClick={() => {
              onQualityChange(n);
              setStarAnchorEl(null);
            }}
            data-testid={`quick-tick-star-option-${n}`}
          >
            {n}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            onQualityChange(null);
            setStarAnchorEl(null);
          }}
        >
          —
        </MenuItem>
      </Menu>

      {/* Grade selector with "user" byline */}
      <ButtonBase
        onClick={(e) => setGradeAnchorEl(e.currentTarget)}
        aria-label="Select logged grade"
        aria-haspopup="menu"
        aria-expanded={Boolean(gradeAnchorEl)}
        data-testid="quick-tick-grade"
        className={styles.gradeButton}
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
      <Menu
        anchorEl={gradeAnchorEl}
        open={Boolean(gradeAnchorEl)}
        onClose={() => setGradeAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { maxHeight: 240 } } }}
      >
        <MenuItem
          onClick={() => {
            onDifficultyChange(undefined);
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
              onClick={() => {
                onDifficultyChange(grade.difficulty_id);
                setGradeAnchorEl(null);
              }}
            >
              {formatGrade(grade.difficulty_name) ?? grade.v_grade}
            </MenuItem>
          );
        })}
      </Menu>

      {/* Tries counter */}
      <ButtonBase
        onClick={(e) => setAttemptAnchorEl(e.currentTarget)}
        aria-label={`Tries: ${attemptDisplay}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(attemptAnchorEl)}
        data-testid="quick-tick-attempt"
        className={styles.attemptButton}
        disableRipple={false}
      >
        <span className={styles.attemptNumber}>{attemptDisplay}</span>
        <span className={styles.attemptLabel}>tries</span>
      </ButtonBase>
      <Menu
        anchorEl={attemptAnchorEl}
        open={Boolean(attemptAnchorEl)}
        onClose={() => setAttemptAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { minWidth: 64 } } }}
      >
        {REVERSED_ATTEMPT_OPTIONS.map((n) => (
          <MenuItem
            key={n}
            selected={n === attemptCount}
            onClick={() => {
              onAttemptCountChange(n);
              setAttemptAnchorEl(null);
            }}
            data-testid={`quick-tick-attempt-option-${n === 10 ? '9plus' : n}`}
          >
            {n === 10 ? '9+' : n}
          </MenuItem>
        ))}
      </Menu>

    </>
  );
};

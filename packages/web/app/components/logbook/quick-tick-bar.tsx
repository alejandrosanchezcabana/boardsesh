'use client';

import React, { useState, useCallback, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import Stack from '@mui/material/Stack';
import { track } from '@vercel/analytics';
import { Angle, Climb, BoardDetails } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import type { LogbookEntry, TickStatus } from '@/app/hooks/use-logbook';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import {
  TickControls,
  TickGradeButton,
  InlineStarPicker,
  InlineGradePicker,
  InlineTriesPicker,
  type ExpandedControl,
} from './tick-controls';
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
  /** Comment input element rendered by the parent — placed in the row next to tick controls. */
  commentSlot: React.ReactNode;
}

export interface QuickTickBarHandle {
  /** Trigger a save (ascent). Called by the parent tick button. */
  save: () => void;
}

/**
 * Stateful tick entry wrapper. Manages the tick target snapshot, form state
 * (quality, difficulty, attempts), expansion state, and save logic.
 *
 * Layout mirrors the queue control bar below:
 *   [comment (flex:1) + grade] [stars + tries]
 * so the user grade aligns vertically with the consensus grade.
 */
export const QuickTickBar = forwardRef<QuickTickBarHandle, QuickTickBarProps>(({
  currentClimb,
  angle,
  boardDetails,
  onSave,
  onCancel,
  comment,
  commentSlot,
}, ref) => {
  const { saveTick, logbook } = useBoardProvider();

  // Snapshot the target climb the first time we get a non-null climb.
  const [tickTarget, setTickTarget] = useState<TickTarget | null>(() =>
    currentClimb ? buildTickTarget(currentClimb, angle, boardDetails, logbook) : null,
  );
  useEffect(() => {
    if (!tickTarget && currentClimb) {
      setTickTarget(buildTickTarget(currentClimb, angle, boardDetails, logbook));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClimb, tickTarget]);

  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [expandedControl, setExpandedControl] = useState<ExpandedControl>(null);

  const grades = TENSION_KILTER_GRADES;

  const climbGradeId = useMemo(() => {
    const source = tickTarget?.climb.difficulty ?? currentClimb?.difficulty;
    if (!source) return undefined;
    return grades.find((g) => g.difficulty_name === source)?.difficulty_id;
  }, [tickTarget, currentClimb, grades]);
  const currentGradeId = difficulty ?? climbGradeId;

  const displayedGrades = useMemo(() => {
    if (climbGradeId === undefined) return grades;
    const idx = grades.findIndex((g) => g.difficulty_id === climbGradeId);
    if (idx === -1) return grades;
    const start = Math.max(0, idx - 2);
    const end = Math.min(grades.length, idx + 3);
    return grades.slice(start, end);
  }, [grades, climbGradeId]);

  const climbDifficulty = tickTarget?.climb.difficulty ?? currentClimb?.difficulty ?? undefined;

  // Picker selection handlers — select the value and collapse the picker.
  const handleStarSelect = useCallback((value: number | null) => {
    setQuality(value);
    setExpandedControl(null);
  }, []);

  const handleGradeSelect = useCallback((value: number | undefined) => {
    setDifficulty(value);
    setExpandedControl(null);
  }, []);

  const handleTriesSelect = useCallback((value: number) => {
    setAttemptCount(value);
    setExpandedControl(null);
  }, []);

  const handleSave = useCallback(
    async (isAscent: boolean) => {
      if (!tickTarget || isSaving) return;

      const { climb, angle: targetAngle, boardDetails: targetBoard, hasPriorHistory } = tickTarget;

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

  useImperativeHandle(ref, () => ({
    save: handleConfirm,
  }), [handleConfirm]);

  return (
    <div data-testid="quick-tick-bar" className={styles.tickBar}>
      {/* Picker panel — expands above the controls row when a control is active */}
      <div className={`${styles.pickerPanel} ${expandedControl ? styles.pickerPanelExpanded : ''}`}>
        <div className={styles.pickerPanelContent}>
          {expandedControl === 'stars' && (
            <InlineStarPicker quality={quality} onSelect={handleStarSelect} />
          )}
          {expandedControl === 'grade' && (
            <InlineGradePicker
              grades={displayedGrades}
              currentGradeId={currentGradeId}
              onSelect={handleGradeSelect}
            />
          )}
          {expandedControl === 'tries' && (
            <InlineTriesPicker attemptCount={attemptCount} onSelect={handleTriesSelect} />
          )}
        </div>
      </div>

      {/* Controls row — mirrors the queue bar layout:
          [comment + grade (flex:1)] [stars + tries (flex:none)]
          so user grade aligns with the consensus grade below. */}
      <div className={styles.controlsRow}>
        {/* Left section: comment fills space, grade sits at right edge —
            mirrors the queue bar's [thumbnail + title + grade] column. */}
        <div className={styles.leftSection}>
          {commentSlot}
          <TickGradeButton
            difficulty={difficulty}
            climbDifficulty={climbDifficulty}
            displayedGrades={displayedGrades}
            expandedControl={expandedControl}
            onExpandedControlChange={setExpandedControl}
          />
        </div>

        {/* Right section: stars + tries — mirrors the queue bar's button
            cluster (Close + Tick) so widths match and grades align. */}
        <div className={styles.rightControls}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <TickControls
              quality={quality}
              attemptCount={attemptCount}
              isSaving={isSaving}
              expandedControl={expandedControl}
              onExpandedControlChange={setExpandedControl}
            />
          </Stack>
        </div>
      </div>
    </div>
  );
});

QuickTickBar.displayName = 'QuickTickBar';

/**
 * Decide whether the user has any prior history for a climb at open time.
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

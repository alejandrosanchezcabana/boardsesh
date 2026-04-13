'use client';

import React, { useState, useCallback, useEffect, useMemo, useImperativeHandle, useRef, forwardRef } from 'react';
import Stack from '@mui/material/Stack';
import { Angle, Climb, BoardDetails } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import { loadTickDraft } from '@/app/lib/tick-draft-db';
import { useTickSave, buildTickTarget, type TickTarget } from '@/app/hooks/use-tick-save';
import {
  TickControls,
  TickGradeButton,
  InlineStarPicker,
  InlineGradePicker,
  InlineTriesPicker,
  type ExpandedControl,
} from './tick-controls';
import styles from './quick-tick-bar.module.css';

export interface QuickTickBarProps {
  currentClimb: Climb | null;
  angle: Angle;
  boardDetails: BoardDetails;
  onSave: () => void;
  /** Called when a save fails so the parent can show feedback. */
  onError?: () => void;
  /** Called when a draft is restored from a previous failed save. */
  onDraftRestored?: (comment: string) => void;
  /** Current comment text. Owned by the parent so the comment field can live
   *  outside this bar (above the queue control bar) without causing reflow. */
  comment: string;
  /** Comment input element rendered by the parent — placed in the row next to tick controls. */
  commentSlot: React.ReactNode;
}

export interface QuickTickBarHandle {
  /** Trigger a save (ascent). Pass the origin element for confetti positioning. */
  save: (originElement?: HTMLElement | null) => void;
  /** Trigger a save (attempt). Pass the origin element for confetti positioning. */
  saveAttempt: (originElement?: HTMLElement | null) => void;
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
  onError,
  onDraftRestored,
  comment,
  commentSlot,
}, ref) => {
  const { logbook } = useBoardProvider();

  // Snapshot the target climb the first time we get a non-null climb.
  // Uses a ref flag so it only fires once, avoiding re-snapshot when
  // angle/boardDetails/logbook change after the initial capture.
  // NOTE: tickTargetTaken resets only on unmount — this works because
  // QuickTickBar is unmounted when tick mode closes (see queue-control-bar).
  const tickTargetTaken = useRef(false);
  const [tickTarget, setTickTarget] = useState<TickTarget | null>(() => {
    if (currentClimb) {
      tickTargetTaken.current = true;
      return buildTickTarget(currentClimb, angle, boardDetails, logbook);
    }
    return null;
  });
  useEffect(() => {
    if (!tickTargetTaken.current && currentClimb) {
      tickTargetTaken.current = true;
      setTickTarget(buildTickTarget(currentClimb, angle, boardDetails, logbook));
    }
  }, [currentClimb, angle, boardDetails, logbook]);

  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [expandedControl, setExpandedControl] = useState<ExpandedControl>(null);

  // Restore draft values from a previous failed save for this climb.
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (!tickTarget || draftLoaded.current) return;
    draftLoaded.current = true;
    loadTickDraft(tickTarget.climb.uuid, Number(tickTarget.angle)).then((draft) => {
      if (!draft) return;
      setQuality(draft.quality);
      setDifficulty(draft.difficulty);
      setAttemptCount(draft.attemptCount);
      if (draft.comment) {
        onDraftRestored?.(draft.comment);
      }
    });
  }, [tickTarget, onDraftRestored]);
  // Track which picker was last open so we can keep it mounted during collapse.
  const [lastExpandedControl, setLastExpandedControl] = useState<ExpandedControl>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (expandedControl) {
      setLastExpandedControl(expandedControl);
      setPickerVisible(true);
    } else {
      // Keep content mounted during the 200ms CSS grid collapse transition.
      const timer = setTimeout(() => setPickerVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [expandedControl]);

  // The control to actually render — either the currently expanded one, or
  // the last one that was open (kept alive during the collapse animation).
  const renderedControl = expandedControl ?? (pickerVisible ? lastExpandedControl : null);

  const gradeButtonRef = useRef<HTMLButtonElement>(null);
  const triesButtonRef = useRef<HTMLButtonElement>(null);

  const grades = TENSION_KILTER_GRADES;

  const currentGradeId = difficulty;

  const consensusGradeId = useMemo(() => {
    const source = tickTarget?.climb.difficulty;
    if (!source) return undefined;
    return grades.find((g) => g.difficulty_name === source)?.difficulty_id;
  }, [tickTarget, grades]);

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

  const { save, saveAttempt } = useTickSave({
    tickTarget,
    quality,
    difficulty,
    attemptCount,
    comment,
    onSave,
    onError,
  });

  useImperativeHandle(ref, () => ({
    save,
    saveAttempt,
  }), [save, saveAttempt]);

  return (
    <div data-testid="quick-tick-bar" className={styles.tickBar}>
      {/* Picker panel — expands above the controls row when a control is active */}
      <div className={`${styles.pickerPanel} ${expandedControl ? styles.pickerPanelExpanded : ''}`}>
        <div className={styles.pickerPanelContent}>
          {renderedControl === 'stars' && (
            <InlineStarPicker quality={quality} onSelect={handleStarSelect} />
          )}
          {renderedControl === 'grade' && (
            <InlineGradePicker
              grades={grades}
              currentGradeId={currentGradeId}
              focusGradeId={consensusGradeId}
              onSelect={handleGradeSelect}
              gradeButtonRef={gradeButtonRef}
            />
          )}
          {renderedControl === 'tries' && (
            <InlineTriesPicker attemptCount={attemptCount} onSelect={handleTriesSelect} triesButtonRef={triesButtonRef} />
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
          {/* Collapse any open picker when the comment field gains focus */}
          <div role="group" onFocus={() => setExpandedControl(null)} className={styles.commentWrapper}>
            {commentSlot}
          </div>
          <TickGradeButton
            ref={gradeButtonRef}
            difficulty={difficulty}
            displayedGrades={grades}
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
              expandedControl={expandedControl}
              onExpandedControlChange={setExpandedControl}
              triesButtonRef={triesButtonRef}
            />
          </Stack>
        </div>
      </div>
    </div>
  );
});

QuickTickBar.displayName = 'QuickTickBar';

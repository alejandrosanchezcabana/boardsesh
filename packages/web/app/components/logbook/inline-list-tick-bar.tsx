'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { Climb, BoardDetails, Angle } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import { loadTickDraft } from '@/app/lib/tick-draft-db';
import { useTickSave, buildTickTarget, type TickTarget } from '@/app/hooks/use-tick-save';
import { themeTokens } from '@/app/theme/theme-config';
import {
  TickControls,
  TickGradeButton,
  InlineStarPicker,
  InlineGradePicker,
  InlineTriesPicker,
  type ExpandedControl,
} from './tick-controls';
import styles from './inline-list-tick-bar.module.css';

export interface InlineListTickBarHandle {
  save: () => void;
  saveAttempt: (originElement?: HTMLElement | null) => void;
}

export interface InlineListTickBarProps {
  climb: Climb;
  angle: Angle;
  boardDetails: BoardDetails;
  open: boolean;
  onClose: () => void;
  /** Called when a save fails so the parent can show feedback. */
  onError?: () => void;
}

export const InlineListTickBar = forwardRef<InlineListTickBarHandle, InlineListTickBarProps>(({
  climb,
  angle,
  boardDetails,
  open,
  onClose,
  onError,
}, ref) => {
  const { logbook } = useBoardProvider();

  // Build tick target on mount / when climb changes
  const tickTarget = useMemo<TickTarget | null>(() => {
    if (!climb) return null;
    return buildTickTarget(climb, angle, boardDetails, logbook);
  }, [climb, angle, boardDetails, logbook]);

  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [expandedControl, setExpandedControl] = useState<ExpandedControl>(null);

  // Restore draft values from a previous failed save
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (!tickTarget || draftLoaded.current) return;
    draftLoaded.current = true;
    let cancelled = false;
    loadTickDraft(tickTarget.climb.uuid, Number(tickTarget.angle)).then((draft) => {
      if (cancelled || !draft) return;
      setQuality(draft.quality);
      setDifficulty(draft.difficulty);
      setAttemptCount(draft.attemptCount);
    });
    return () => { cancelled = true; };
  }, [tickTarget]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuality(null);
      setDifficulty(undefined);
      setAttemptCount(1);
      setExpandedControl(null);
      draftLoaded.current = false;
    }
  }, [open]);

  // Track picker visibility for collapse animation
  const [lastExpandedControl, setLastExpandedControl] = useState<ExpandedControl>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (expandedControl) {
      setLastExpandedControl(expandedControl);
      setPickerVisible(true);
    } else {
      const timer = setTimeout(() => setPickerVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [expandedControl]);

  const renderedControl = expandedControl ?? (pickerVisible ? lastExpandedControl : null);

  const gradeButtonRef = useRef<HTMLButtonElement>(null);
  const triesButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const grades = TENSION_KILTER_GRADES;

  const currentGradeId = difficulty;

  const consensusGradeId = useMemo(() => {
    const source = tickTarget?.climb.difficulty;
    if (!source) return undefined;
    return grades.find((g) => g.difficulty_name === source)?.difficulty_id;
  }, [tickTarget, grades]);

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
    comment: '',
    onSave: onClose,
    onError,
  });

  useImperativeHandle(ref, () => ({
    save,
    saveAttempt,
  }), [save, saveAttempt]);

  const handleSaveClick = useCallback(() => {
    save();
  }, [save]);

  const handleAttemptClick = useCallback(() => {
    saveAttempt(saveButtonRef.current);
  }, [saveAttempt]);

  return (
    <div className={`${styles.tickBarWrapper} ${open ? styles.tickBarWrapperOpen : ''}`}>
      <div className={styles.tickBarInner}>
        {/* Picker panel — expands above the controls row */}
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

        {/* Controls row */}
        <div className={styles.controlsRow}>
          <div className={styles.leftSection}>
            <TickGradeButton
              ref={gradeButtonRef}
              difficulty={difficulty}
              displayedGrades={grades}
              expandedControl={expandedControl}
              onExpandedControlChange={setExpandedControl}
            />
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
          <div className={styles.rightButtons}>
            <IconButton
              ref={saveButtonRef}
              size="small"
              onClick={handleSaveClick}
              aria-label="Log ascent"
              sx={{
                width: 36,
                height: 36,
                backgroundColor: themeTokens.colors.success,
                color: 'common.white',
                '&:hover': { backgroundColor: themeTokens.colors.success },
              }}
            >
              <CheckOutlined sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleAttemptClick}
              aria-label="Log attempt"
              sx={{
                width: 36,
                height: 36,
                backgroundColor: themeTokens.colors.error,
                color: 'common.white',
                '&:hover': { backgroundColor: themeTokens.colors.error },
              }}
            >
              <CloseOutlined sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Cancel"
              sx={{
                width: 28,
                height: 28,
                color: 'text.disabled',
              }}
            >
              <CloseOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
});

InlineListTickBar.displayName = 'InlineListTickBar';

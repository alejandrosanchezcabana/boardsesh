'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import { track } from '@vercel/analytics';
import { Angle, Climb, BoardDetails } from '@/app/lib/types';
import { useBoardProvider } from '../board-provider/board-provider-context';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import { themeTokens } from '@/app/theme/theme-config';
import styles from './quick-tick-bar.module.css';

interface QuickTickBarProps {
  currentClimb: Climb | null;
  angle: Angle;
  boardDetails: BoardDetails;
  onSave: () => void;
  onCancel: () => void;
}

export const QuickTickBar: React.FC<QuickTickBarProps> = ({
  currentClimb,
  angle,
  boardDetails,
  onSave,
  onCancel,
}) => {
  const { saveTick } = useBoardProvider();
  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gradeAnchorEl, setGradeAnchorEl] = useState<HTMLElement | null>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  const grades = TENSION_KILTER_GRADES;

  // Focus comment field when shown
  useEffect(() => {
    if (showComment && commentRef.current) {
      commentRef.current.focus();
    }
  }, [showComment]);

  const selectedGrade = difficulty
    ? grades.find((g) => g.difficulty_id === difficulty)
    : undefined;

  // Default grade from the climb's difficulty
  const defaultGradeLabel = currentClimb?.difficulty ?? '';

  const handleSave = useCallback(async (isAscent: boolean) => {
    if (!currentClimb?.uuid || isSaving) return;

    setIsSaving(true);
    try {
      await saveTick({
        climbUuid: currentClimb.uuid,
        angle: Number(angle),
        isMirror: !!currentClimb.mirrored,
        status: isAscent ? 'flash' : 'attempt',
        attemptCount: 1,
        quality: quality ?? undefined,
        difficulty,
        isBenchmark: false,
        comment: comment || '',
        climbedAt: new Date().toISOString(),
        layoutId: boardDetails.layout_id,
        sizeId: boardDetails.size_id,
        setIds: Array.isArray(boardDetails.set_ids)
          ? boardDetails.set_ids.join(',')
          : String(boardDetails.set_ids),
      });

      track('Quick Tick Saved', {
        boardLayout: boardDetails.layout_name || '',
        status: isAscent ? 'flash' : 'attempt',
        hasQuality: quality !== null,
        hasDifficulty: difficulty !== undefined,
        hasComment: comment.length > 0,
      });

      onSave();
    } catch (error) {
      // Error is already shown via snackbar in useSaveTick
      track('Quick Tick Failed', {
        boardLayout: boardDetails.layout_name || '',
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentClimb, angle, quality, difficulty, comment, boardDetails, isSaving, saveTick, onSave]);

  const handleConfirm = useCallback(() => handleSave(true), [handleSave]);
  const handleFail = useCallback(() => handleSave(false), [handleSave]);

  return (
    <div className={styles.tickBar}>
      <div className={styles.controls}>
        {/* Fail / log attempt */}
        <IconButton
          size="small"
          onClick={handleFail}
          disabled={isSaving}
          sx={{ color: themeTokens.colors.error }}
        >
          <CloseOutlined fontSize="small" />
        </IconButton>

        {/* Star rating */}
        <Rating
          value={quality}
          onChange={(_, val) => setQuality(val)}
          size="small"
          max={5}
          sx={{ flexShrink: 0 }}
        />

        {/* Grade chip */}
        <Chip
          label={selectedGrade?.v_grade ?? defaultGradeLabel ?? '—'}
          size="small"
          variant={difficulty ? 'filled' : 'outlined'}
          className={styles.gradeChip}
          onClick={(e) => setGradeAnchorEl(e.currentTarget)}
        />
        <Menu
          anchorEl={gradeAnchorEl}
          open={Boolean(gradeAnchorEl)}
          onClose={() => setGradeAnchorEl(null)}
          slotProps={{ paper: { sx: { maxHeight: 240 } } }}
        >
          <MenuItem
            onClick={() => { setDifficulty(undefined); setGradeAnchorEl(null); }}
          >
            —
          </MenuItem>
          {grades.map((grade) => (
            <MenuItem
              key={grade.difficulty_id}
              selected={grade.difficulty_id === difficulty}
              onClick={() => { setDifficulty(grade.difficulty_id); setGradeAnchorEl(null); }}
            >
              {grade.v_grade}
            </MenuItem>
          ))}
        </Menu>

        {/* Comment toggle */}
        <IconButton
          size="small"
          onClick={() => setShowComment((prev) => !prev)}
          color={showComment ? 'primary' : 'default'}
        >
          <ChatBubbleOutlineOutlined fontSize="small" />
        </IconButton>

        {/* Confirm / save ascent */}
        <IconButton
          size="small"
          onClick={handleConfirm}
          disabled={isSaving}
          sx={{ color: themeTokens.colors.success }}
        >
          <CheckOutlined fontSize="small" />
        </IconButton>
      </div>

      {/* Inline comment field */}
      {showComment && (
        <div className={styles.commentRow}>
          <TextField
            inputRef={commentRef}
            size="small"
            placeholder="Comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            variant="standard"
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            sx={{ flex: 1 }}
          />
        </div>
      )}
    </div>
  );
};

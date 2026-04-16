'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import SwipeableDrawer from '@/app/components/swipeable-drawer/swipeable-drawer';
import { themeTokens } from '@/app/theme/theme-config';
import { useUpdateTick } from '@/app/hooks/use-update-tick';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';
import {
  TickControls,
  TickGradeButton,
  InlineStarPicker,
  InlineGradePicker,
  InlineTriesPicker,
  type ExpandedControl,
} from '../logbook/tick-controls';
import styles from './logbook-edit-drawer.module.css';

interface LogbookEditDrawerProps {
  open: boolean;
  item: AscentFeedItem | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<AscentFeedItem['status'], string> = {
  flash: 'Flash',
  send: 'Send',
  attempt: 'Attempt',
};

function getEditedAscentStatus(item: AscentFeedItem, attemptCount: number): 'flash' | 'send' {
  if (attemptCount > 1) {
    return 'send';
  }
  if (item.status === 'send' && item.attemptCount === 1) {
    return 'send';
  }
  return 'flash';
}

export default function LogbookEditDrawer({ open, item, onClose }: LogbookEditDrawerProps) {
  const updateTick = useUpdateTick();
  const grades = TENSION_KILTER_GRADES;

  const [comment, setComment] = useState('');
  const [commentFocused, setCommentFocused] = useState(false);
  const [quality, setQuality] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [attemptCount, setAttemptCount] = useState(1);
  const [expandedControl, setExpandedControl] = useState<ExpandedControl>(null);
  const [lastExpandedControl, setLastExpandedControl] = useState<ExpandedControl>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const gradeButtonRef = useRef<HTMLButtonElement>(null);
  const triesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !item) return;
    setComment(item.comment);
    setCommentFocused(false);
    setQuality(item.quality ?? null);
    setDifficulty(item.difficulty ?? undefined);
    setAttemptCount(item.attemptCount);
    setExpandedControl(null);
    setLastExpandedControl(null);
    setPickerVisible(false);
  }, [open, item]);

  useEffect(() => {
    if (expandedControl) {
      setLastExpandedControl(expandedControl);
      setPickerVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setPickerVisible(false), 200);
    return () => window.clearTimeout(timer);
  }, [expandedControl]);

  const renderedControl = expandedControl ?? (pickerVisible ? lastExpandedControl : null);
  const currentGradeId = difficulty;
  const focusGradeId = difficulty ?? item?.consensusDifficulty ?? undefined;

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

  const handleCommentFocus = useCallback(() => {
    setExpandedControl(null);
    setCommentFocused(true);
  }, []);

  const handleCommentBlur = useCallback(() => {
    setCommentFocused(false);
  }, []);

  const handleSaveAttempt = useCallback(async () => {
    if (!item) return;

    try {
      await updateTick.mutateAsync({
        uuid: item.uuid,
        input: {
          status: 'attempt',
          attemptCount,
          quality: null,
          difficulty: difficulty ?? null,
          comment,
        },
      });

      onClose();
    } catch {
      // The mutation hook surfaces the error via snackbar; keep the drawer open.
    }
  }, [attemptCount, comment, difficulty, item, onClose, updateTick]);

  const handleSaveAscent = useCallback(async () => {
    if (!item) return;

    try {
      await updateTick.mutateAsync({
        uuid: item.uuid,
        input: {
          status: getEditedAscentStatus(item, attemptCount),
          attemptCount,
          quality: quality ?? null,
          difficulty: difficulty ?? null,
          comment,
        },
      });

      onClose();
    } catch {
      // The mutation hook surfaces the error via snackbar; keep the drawer open.
    }
  }, [attemptCount, comment, difficulty, item, onClose, quality, updateTick]);

  const statusLabel = useMemo(() => (item ? STATUS_LABELS[item.status] : ''), [item]);

  return (
    <SwipeableDrawer
      title="Edit Tick"
      open={open}
      onClose={onClose}
      placement="bottom"
      styles={{
        wrapper: { height: 'auto' },
        body: { paddingBottom: themeTokens.spacing[6] },
      }}
    >
      {item && (
        <Box className={styles.drawerBody} data-testid="logbook-edit-drawer">
          <Box className={styles.summary}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Editing
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {item.climbName}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Chip label={statusLabel} size="small" />
              <Chip label={`${item.angle}\u00B0`} size="small" variant="outlined" />
              {item.difficultyName && <Chip label={`Logged ${item.difficultyName}`} size="small" color="primary" />}
            </Stack>
          </Box>

          <Box className={styles.editorCard}>
            <div className={`${styles.pickerPanel} ${expandedControl ? styles.pickerPanelExpanded : ''}`}>
              <div className={styles.pickerPanelContent}>
                {renderedControl === 'stars' && (
                  <InlineStarPicker quality={quality} onSelect={handleStarSelect} />
                )}
                {renderedControl === 'grade' && (
                  <InlineGradePicker
                    grades={grades}
                    currentGradeId={currentGradeId}
                    focusGradeId={focusGradeId}
                    onSelect={handleGradeSelect}
                    gradeButtonRef={gradeButtonRef}
                  />
                )}
                {renderedControl === 'tries' && (
                  <InlineTriesPicker
                    attemptCount={attemptCount}
                    onSelect={handleTriesSelect}
                    triesButtonRef={triesButtonRef}
                  />
                )}
              </div>
            </div>

            <div className={styles.controlsRow}>
              <div className={styles.leftSection}>
                <div className={styles.commentWrapper}>
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    placeholder="Comment..."
                    multiline
                    minRows={1}
                    maxRows={commentFocused ? 4 : 1}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    onFocus={handleCommentFocus}
                    onBlur={handleCommentBlur}
                    slotProps={{
                      htmlInput: { maxLength: 2000, 'aria-label': 'Edit tick comment' },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <ChatBubbleOutlineOutlined sx={{ fontSize: 16, opacity: 0.5 }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        backgroundColor: 'var(--input-bg)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'var(--neutral-200)',
                        },
                      },
                    }}
                  />
                </div>
                <TickGradeButton
                  ref={gradeButtonRef}
                  difficulty={difficulty}
                  displayedGrades={grades}
                  expandedControl={expandedControl}
                  onExpandedControlChange={setExpandedControl}
                />
              </div>

              <div className={styles.rightControls}>
                <TickControls
                  quality={quality}
                  attemptCount={attemptCount}
                  expandedControl={expandedControl}
                  onExpandedControlChange={setExpandedControl}
                  triesButtonRef={triesButtonRef}
                />
              </div>
            </div>

            <div className={styles.actionsRow}>
              <IconButton
                onClick={handleSaveAttempt}
                disabled={updateTick.isPending}
                aria-label="Save as attempt"
                sx={{
                  color: themeTokens.colors.error,
                  opacity: themeTokens.opacity.subtle,
                  '&:hover': { color: themeTokens.colors.error, opacity: 1 },
                }}
              >
                <CloseOutlined />
              </IconButton>
              <IconButton
                onClick={handleSaveAscent}
                disabled={updateTick.isPending}
                aria-label="Save as ascent"
                sx={{
                  backgroundColor: themeTokens.colors.success,
                  color: 'common.white',
                  '&:hover': { backgroundColor: themeTokens.colors.success },
                }}
              >
                <CheckOutlined />
              </IconButton>
            </div>
          </Box>
        </Box>
      )}
    </SwipeableDrawer>
  );
}

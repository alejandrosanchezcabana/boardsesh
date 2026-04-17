'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ButtonBase from '@mui/material/ButtonBase';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';
import type { BoardDetails, BoardName } from '@/app/lib/types';
import { AscentStatusIcon } from '@/app/components/ascent-status/ascent-status-icon';
import { ClimbActions } from '@/app/components/climb-actions';
import DrawerClimbHeader from '@/app/components/climb-card/drawer-climb-header';
import { useSwipeActions } from '@/app/hooks/use-swipe-actions';
import { useDrawerDragResize } from '@/app/hooks/use-drawer-drag-resize';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import { useGradeFormat } from '@/app/hooks/use-grade-format';
import { useUpdateTick } from '@/app/hooks/use-update-tick';
import { themeTokens } from '@/app/theme/theme-config';
import { getDefaultBoardConfig } from '@/app/lib/default-board-configs';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getExcludedClimbActions } from '@/app/lib/climb-action-utils';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import AscentThumbnail from '@/app/components/activity-feed/ascent-thumbnail';
import {
  InlineStarPicker,
  InlineGradePicker,
  InlineTriesPicker,
  type ExpandedControl,
} from '../logbook/tick-controls';
import { ascentFeedItemToClimb } from './ascent-to-climb';
import ascentStyles from '@/app/components/climb-card/ascent-status.module.css';
import drawerCss from '@/app/components/swipeable-drawer/swipeable-drawer.module.css';
import styles from './logbook-feed-item.module.css';

const SwipeableDrawer = dynamic(() => import('../swipeable-drawer/swipeable-drawer'), { ssr: false });

dayjs.extend(relativeTime);

// Layout name mapping
const layoutNames: Record<string, string> = {
  'kilter-1': 'Kilter Original',
  'kilter-8': 'Kilter Homewall',
  'tension-9': 'Tension Classic',
  'tension-10': 'Tension 2 Mirror',
  'tension-11': 'Tension 2 Spray',
  'moonboard-1': 'MoonBoard 2010',
  'moonboard-2': 'MoonBoard 2016',
  'moonboard-3': 'MoonBoard 2024',
  'moonboard-4': 'MoonBoard Masters 2017',
  'moonboard-5': 'MoonBoard Masters 2019',
};

const getLayoutDisplayName = (boardType: string, layoutId: number | null): string => {
  if (layoutId === null) return boardType.charAt(0).toUpperCase() + boardType.slice(1);
  const key = `${boardType}-${layoutId}`;
  return layoutNames[key] || boardType.charAt(0).toUpperCase() + boardType.slice(1);
};

// Swipe thresholds
const SWIPE_THRESHOLD = 60;
const LONG_SWIPE_THRESHOLD = 150;
const MAX_SWIPE = 180;
const LEFT_ACTION_WIDTH = 120;
const RIGHT_ACTION_WIDTH = 120;

// Static styles
const iconStyle: React.CSSProperties = { color: 'white', fontSize: 20 };
// ~30% larger than the standard 64px thumbnail
// Thumbnail wrapper — size set via CSS class that also overrides the inner 64px container
const menuButtonStyle: React.CSSProperties = { flexShrink: 0, color: 'var(--neutral-400)' };

// Uniform stat cell — consistent height and alignment for all items
const statCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  minWidth: 28,
};

// Fixed-width grade cell so 2-char (V5) and 3-char (V10) grades take the same space
const gradeCellStyle: React.CSSProperties = {
  ...statCellStyle,
  minWidth: 32,
};

// Single row: c-stars, u-stars, c-grade, u-grade, tries
const gradeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  marginTop: 4,
  paddingBottom: 8,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 500,
  lineHeight: 1,
  letterSpacing: '0.02em',
  opacity: 0.55,
  whiteSpace: 'nowrap',
  textTransform: 'lowercase',
};

const commentBoxSx = {
  fontSize: themeTokens.typography.fontSize.xs,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  color: 'text.primary',
  backgroundColor: 'var(--neutral-100)',
  borderRadius: `${themeTokens.borderRadius.sm}px`,
  padding: `${themeTokens.spacing[1]}px ${themeTokens.spacing[2]}px`,
  marginTop: `${themeTokens.spacing[1]}px`,
} as const;

const nameSx = {
  fontSize: themeTokens.typography.fontSize.xl,
  fontWeight: themeTokens.typography.fontWeight.bold,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const subtitleSx = {
  fontSize: themeTokens.typography.fontSize.xs,
  fontWeight: themeTokens.typography.fontWeight.normal,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const actionsDrawerStyles = {
  wrapper: {
    width: '100%',
    touchAction: 'pan-y' as const,
    transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  body: { padding: `${themeTokens.spacing[2]}px 0` },
  header: { paddingLeft: `${themeTokens.spacing[3]}px`, paddingRight: `${themeTokens.spacing[3]}px` },
} as const;

const dimmedStyle: React.CSSProperties = { opacity: 0.4 };

function getEditedAscentStatus(item: AscentFeedItem, attemptCount: number): 'flash' | 'send' {
  if (attemptCount > 1) {
    return 'send';
  }
  // Preserve one-try sends (don't auto-promote to flash)
  if (item.status === 'send' && item.attemptCount === 1) {
    return 'send';
  }
  return 'flash';
}

// --- Sub-components ---

function LogbookGradeRow({
  consensusDifficultyName,
  qualityAverage,
  difficultyName,
  quality,
  attemptCount,
  isEditing,
  editQuality,
  editDifficulty,
  editAttemptCount,
  expandedControl,
  onExpandControl,
  gradeButtonRef,
  triesButtonRef,
}: {
  consensusDifficultyName: string | null;
  qualityAverage: number | null;
  difficultyName: string | null;
  quality: number | null;
  attemptCount: number;
  isEditing?: boolean;
  editQuality?: number | null;
  editDifficulty?: number | undefined;
  editAttemptCount?: number;
  expandedControl?: ExpandedControl;
  onExpandControl?: (control: ExpandedControl) => void;
  gradeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  triesButtonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const isDark = useIsDarkMode();
  const { formatGrade, getGradeColor } = useGradeFormat();

  const consensusFormatted = consensusDifficultyName ? formatGrade(consensusDifficultyName) : null;
  const consensusColor = consensusDifficultyName ? getGradeColor(consensusDifficultyName, isDark) : undefined;
  const consensusLabel = consensusFormatted ?? consensusDifficultyName ?? '\u2014';
  const consensusStarsLabel = qualityAverage != null ? Math.round(qualityAverage).toString() : '\u2014';

  // For non-editing mode, use item values directly
  const userFormatted = difficultyName ? formatGrade(difficultyName) : null;
  const userColor = difficultyName ? getGradeColor(difficultyName, isDark) : undefined;
  const userLabel = userFormatted ?? (difficultyName || '\u2014');

  // For editing mode, look up the editDifficulty in TENSION_KILTER_GRADES
  const editGradeName = useMemo(() => {
    if (!isEditing || editDifficulty === undefined) return undefined;
    const grade = TENSION_KILTER_GRADES.find((g) => g.difficulty_id === editDifficulty);
    return grade?.difficulty_name;
  }, [isEditing, editDifficulty]);

  const editGradeFormatted = editGradeName ? formatGrade(editGradeName) : null;
  const editGradeColor = editGradeName ? getGradeColor(editGradeName, isDark) : undefined;
  const editGradeLabel = editGradeFormatted ?? (editGradeName || '\u2014');

  const handleToggle = useCallback((control: ExpandedControl) => {
    if (!onExpandControl) return;
    onExpandControl(expandedControl === control ? null : control);
  }, [onExpandControl, expandedControl]);

  return (
    <div style={gradeRowStyle}>
      {/* Consensus stars */}
      <div style={{ ...statCellStyle, ...(isEditing ? dimmedStyle : undefined) }}>
        <span style={{ ...statValueStyle, color: themeTokens.colors.amber }}>{`\u2605${consensusStarsLabel}`}</span>
        <span style={statLabelStyle}>stars</span>
      </div>
      {/* User stars */}
      {isEditing ? (
        <ButtonBase
          onClick={() => handleToggle('stars')}
          aria-label={`Quality: ${editQuality ?? 'none'}`}
          style={{ ...statCellStyle, padding: 0 }}
          disableRipple={false}
        >
          <span style={{ ...statValueStyle, color: themeTokens.colors.amber }}>{`\u2605${editQuality ?? '\u2014'}`}</span>
          <span style={statLabelStyle}>user</span>
        </ButtonBase>
      ) : (
        <div style={statCellStyle}>
          <span style={{ ...statValueStyle, color: themeTokens.colors.amber }}>{`\u2605${quality ?? '\u2014'}`}</span>
          <span style={statLabelStyle}>user</span>
        </div>
      )}
      {/* Consensus grade */}
      <div style={{ ...gradeCellStyle, ...(isEditing ? dimmedStyle : undefined) }}>
        <span style={{ ...statValueStyle, color: consensusColor }}>{consensusLabel}</span>
        <span style={statLabelStyle}>grade</span>
      </div>
      {/* User grade */}
      {isEditing ? (
        <ButtonBase
          ref={gradeButtonRef}
          onClick={() => handleToggle('grade')}
          aria-label="Select logged grade"
          style={{ ...gradeCellStyle, padding: 0 }}
          disableRipple={false}
        >
          <span style={{ ...statValueStyle, color: editGradeColor }}>{editGradeLabel}</span>
          <span style={statLabelStyle}>user</span>
        </ButtonBase>
      ) : (
        <div style={gradeCellStyle}>
          <span style={{ ...statValueStyle, color: userColor }}>{userLabel}</span>
          <span style={statLabelStyle}>user</span>
        </div>
      )}
      {/* Tries */}
      {isEditing ? (
        <ButtonBase
          ref={triesButtonRef}
          onClick={() => handleToggle('tries')}
          aria-label={`Tries: ${editAttemptCount}`}
          style={{ ...statCellStyle, padding: 0 }}
          disableRipple={false}
        >
          <span style={statValueStyle}>{editAttemptCount}</span>
          <span style={statLabelStyle}>tries</span>
        </ButtonBase>
      ) : (
        <div style={statCellStyle}>
          <span style={statValueStyle}>{attemptCount}</span>
          <span style={statLabelStyle}>tries</span>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

interface LogbookFeedItemProps {
  item: AscentFeedItem;
  showBoardType?: boolean;
  isEditing?: boolean;
  onEdit?: (item: AscentFeedItem) => void;
  onDelete?: (uuid: string) => void;
  onCancelEdit?: () => void;
  /** When true, show "Post to Instagram" option in the actions menu. */
  allowInstagramPosting?: boolean;
  /** When true, show "Link Instagram post" option in the actions menu. */
  allowInstagramLinking?: boolean;
}

const LogbookFeedItem: React.FC<LogbookFeedItemProps> = React.memo(({
  item,
  showBoardType,
  isEditing,
  onEdit,
  onDelete,
  onCancelEdit,
  // Instagram props accepted but not yet integrated into the new standalone layout
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allowInstagramPosting: _allowInstagramPosting,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allowInstagramLinking: _allowInstagramLinking,
}) => {
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // --- Edit state ---
  const updateTick = useUpdateTick();
  const grades = TENSION_KILTER_GRADES;

  const [editComment, setEditComment] = useState('');
  const [commentFocused, setCommentFocused] = useState(false);
  const [editQuality, setEditQuality] = useState<number | null>(null);
  const [editDifficulty, setEditDifficulty] = useState<number | undefined>(undefined);
  const [editAttemptCount, setEditAttemptCount] = useState(1);
  const [expandedControl, setExpandedControl] = useState<ExpandedControl>(null);
  const [lastExpandedControl, setLastExpandedControl] = useState<ExpandedControl>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const gradeButtonRef = useRef<HTMLButtonElement>(null);
  const triesButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize edit state from item when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditComment(item.comment);
      setCommentFocused(false);
      setEditQuality(item.quality ?? null);
      setEditDifficulty(item.difficulty ?? undefined);
      setEditAttemptCount(item.attemptCount);
      setExpandedControl(null);
      setLastExpandedControl(null);
      setPickerVisible(false);
    }
  }, [isEditing, item]);

  // Track picker visibility for collapse animation
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
  const focusGradeId = editDifficulty ?? item.consensusDifficulty ?? undefined;

  // Edit handlers
  const handleStarSelect = useCallback((value: number | null) => {
    setEditQuality(value);
    setExpandedControl(null);
  }, []);

  const handleGradeSelect = useCallback((value: number | undefined) => {
    setEditDifficulty(value);
    setExpandedControl(null);
  }, []);

  const handleTriesSelect = useCallback((value: number) => {
    setEditAttemptCount(value);
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
    try {
      await updateTick.mutateAsync({
        uuid: item.uuid,
        input: {
          status: 'attempt',
          attemptCount: editAttemptCount,
          quality: null,
          difficulty: editDifficulty ?? null,
          comment: editComment,
        },
      });
      onCancelEdit?.();
    } catch {
      // The mutation hook surfaces the error via snackbar; keep edit open.
    }
  }, [editAttemptCount, editComment, editDifficulty, item.uuid, onCancelEdit, updateTick]);

  const handleSaveAscent = useCallback(async () => {
    try {
      await updateTick.mutateAsync({
        uuid: item.uuid,
        input: {
          status: getEditedAscentStatus(item, editAttemptCount),
          attemptCount: editAttemptCount,
          quality: editQuality ?? null,
          difficulty: editDifficulty ?? null,
          comment: editComment,
        },
      });
      onCancelEdit?.();
    } catch {
      // The mutation hook surfaces the error via snackbar; keep edit open.
    }
  }, [editAttemptCount, editComment, editDifficulty, editQuality, item, onCancelEdit, updateTick]);

  // Map ascent to Climb for ClimbActions
  const climb = useMemo(() => ascentFeedItemToClimb(item), [item]);

  // Build BoardDetails for ClimbActions (same pattern as AscentThumbnail)
  const boardDetails = useMemo<BoardDetails | null>(() => {
    if (!item.layoutId) return null;
    const boardName = item.boardType as BoardName;
    const config = getDefaultBoardConfig(boardName, item.layoutId);
    if (!config) return null;
    try {
      return getBoardDetailsForBoard({
        board_name: boardName,
        layout_id: item.layoutId,
        size_id: config.sizeId,
        set_ids: config.setIds,
      });
    } catch {
      return null;
    }
  }, [item.boardType, item.layoutId]);

  const excludeActions = useMemo(
    () => boardDetails ? getExcludedClimbActions(boardDetails.board_name, 'list') : [],
    [boardDetails],
  );

  // Subtitle: "2h ago . 40deg . Kilter Original"
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    parts.push(dayjs(item.climbedAt).fromNow());
    parts.push(`${item.angle}\u00B0`);
    if (showBoardType) {
      parts.push(getLayoutDisplayName(item.boardType, item.layoutId));
    }
    return parts.join(' \u00b7 ');
  }, [item.climbedAt, item.angle, showBoardType, item.boardType, item.layoutId]);

  // --- Swipe actions ---
  const leftSwipeLayerRef = useRef<HTMLDivElement>(null);
  const rightSwipeLayerRef = useRef<HTMLDivElement>(null);

  const handleSwipeLeft = useCallback(() => {
    onEdit?.(item);
  }, [onEdit, item]);

  const handleSwipeRightLong = useCallback(() => {
    onDelete?.(item.uuid);
  }, [onDelete, item.uuid]);

  const handleSwipeOffset = useCallback((offset: number) => {
    if (leftSwipeLayerRef.current) {
      leftSwipeLayerRef.current.style.opacity = String(Math.min(1, Math.max(0, offset) / SWIPE_THRESHOLD));
    }
    if (rightSwipeLayerRef.current) {
      rightSwipeLayerRef.current.style.opacity = String(Math.min(1, Math.max(0, -offset) / SWIPE_THRESHOLD));
    }
  }, []);

  const { swipeHandlers, contentRef, leftActionRef, rightActionRef } = useSwipeActions({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRightLong,
    onSwipeRightLong: handleSwipeRightLong,
    onSwipeOffsetChange: handleSwipeOffset,
    swipeThreshold: SWIPE_THRESHOLD,
    longSwipeRightThreshold: LONG_SWIPE_THRESHOLD,
    maxSwipe: MAX_SWIPE,
    maxSwipeLeft: RIGHT_ACTION_WIDTH,
    maxSwipeRight: LEFT_ACTION_WIDTH,
    disabled: isEditing,
  });

  const leftActionCombinedRef = useCallback((node: HTMLDivElement | null) => {
    leftActionRef(node);
    leftSwipeLayerRef.current = node;
  }, [leftActionRef]);

  const contentCombinedRef = useCallback((node: HTMLDivElement | null) => {
    swipeHandlers.ref(node);
    contentRef(node);
  }, [swipeHandlers, contentRef]);

  // --- Actions drawer ---
  const handleOpenActions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActionsOpen(true);
  }, []);

  const handleCloseActions = useCallback(() => {
    setIsActionsOpen(false);
  }, []);

  const { paperRef: actionsPaperRef, dragHandlers: actionsDragHandlers } = useDrawerDragResize({
    open: isActionsOpen,
    onClose: handleCloseActions,
  });

  const handleDrawerEdit = useCallback(() => {
    handleCloseActions();
    onEdit?.(item);
  }, [handleCloseActions, onEdit, item]);

  const handleDrawerDelete = useCallback(() => {
    handleCloseActions();
    onDelete?.(item.uuid);
  }, [handleCloseActions, onDelete, item.uuid]);

  return (
    <>
      <div className={styles.container}>
        {/* Left action layer — Delete (revealed on long swipe right) */}
        <div ref={leftActionCombinedRef} className={styles.leftActionLayer}>
          <DeleteOutlined style={iconStyle} />
        </div>

        {/* Right action layer — Edit (revealed on swipe left) */}
        <div ref={rightActionRef} className={styles.rightActionLayer}>
          <EditOutlined style={iconStyle} />
        </div>

        {/* Swipeable content */}
        <div
          {...swipeHandlers}
          ref={contentCombinedRef}
          className={styles.content}
          data-swipe-content=""
        >
          {/* Thumbnail with ascent status badge */}
          <div className={styles.thumbnail}>
            {item.frames && item.layoutId && (
              <AscentThumbnail
                boardType={item.boardType}
                layoutId={item.layoutId}
                angle={item.angle}
                climbUuid={item.climbUuid}
                climbName={item.climbName}
                frames={item.frames}
                isMirror={item.isMirror}
              />
            )}
            <AscentStatusIcon
              status={item.status}
              variant="badge"
              fontSize={12}
              className={ascentStyles.badge}
            />
          </div>

          {/* Center section */}
          <div className={styles.center}>
            <Typography variant="body2" component="div" sx={nameSx}>
              {item.climbName}
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary" sx={subtitleSx}>
              {subtitle}
            </Typography>

            {/* Picker panel (edit mode only) */}
            {isEditing && (
              <div className={styles.pickerPanel + (expandedControl ? ' ' + styles.pickerPanelExpanded : '')}>
                <div className={styles.pickerPanelContent}>
                  {renderedControl === 'stars' && (
                    <InlineStarPicker quality={editQuality} onSelect={handleStarSelect} />
                  )}
                  {renderedControl === 'grade' && (
                    <InlineGradePicker
                      grades={grades}
                      currentGradeId={editDifficulty}
                      focusGradeId={focusGradeId}
                      onSelect={handleGradeSelect}
                      gradeButtonRef={gradeButtonRef}
                    />
                  )}
                  {renderedControl === 'tries' && (
                    <InlineTriesPicker
                      attemptCount={editAttemptCount}
                      onSelect={handleTriesSelect}
                      triesButtonRef={triesButtonRef}
                    />
                  )}
                </div>
              </div>
            )}

            <LogbookGradeRow
              consensusDifficultyName={item.consensusDifficultyName}
              qualityAverage={item.qualityAverage}
              difficultyName={item.difficultyName}
              quality={item.quality}
              attemptCount={item.attemptCount}
              isEditing={isEditing}
              editQuality={editQuality}
              editDifficulty={editDifficulty}
              editAttemptCount={editAttemptCount}
              expandedControl={expandedControl}
              onExpandControl={setExpandedControl}
              gradeButtonRef={gradeButtonRef}
              triesButtonRef={triesButtonRef}
            />

          </div>

          {/* Menu / save-cancel buttons */}
          {isEditing ? (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <IconButton
                size="small"
                onClick={handleSaveAscent}
                disabled={updateTick.isPending}
                aria-label="Save as ascent"
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
                onClick={handleSaveAttempt}
                disabled={updateTick.isPending}
                aria-label="Save as attempt"
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
                onClick={onCancelEdit}
                aria-label="Cancel editing"
                sx={{
                  width: 28,
                  height: 28,
                  color: 'text.disabled',
                }}
              >
                <CloseOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </div>
          ) : (
            <IconButton
              size="small"
              aria-label="More actions"
              onClick={handleOpenActions}
              style={menuButtonStyle}
              disableRipple
            >
              <MoreHorizOutlined />
            </IconButton>
          )}
        </div>

        {/* Comment area — full width below the content row */}
        {isEditing ? (
          <div className={styles.commentRow}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Comment..."
              multiline
              minRows={1}
              maxRows={commentFocused ? 4 : 1}
              value={editComment}
              onChange={(event) => setEditComment(event.target.value)}
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
        ) : (
          item.comment && (
            <div className={styles.commentRow}>
              <Typography sx={commentBoxSx}>
                {item.comment}
              </Typography>
            </div>
          )
        )}
      </div>

      {/* Actions drawer */}
      {boardDetails && (
        <SwipeableDrawer
          title={
            <div data-swipe-blocked="" {...actionsDragHandlers} className={drawerCss.dragHeaderWrapper}>
              <DrawerClimbHeader climb={climb} boardDetails={boardDetails} />
            </div>
          }
          placement="bottom"
          height="60%"
          paperRef={actionsPaperRef}
          open={isActionsOpen}
          onClose={handleCloseActions}
          swipeEnabled={false}
          styles={actionsDrawerStyles}
        >
          {/* Edit + Delete at top */}
          {onEdit && (
            <MenuItem onClick={handleDrawerEdit}>
              <ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          {onDelete && (
            <MenuItem onClick={handleDrawerDelete} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteOutlined sx={{ color: 'error.main' }} fontSize="small" /></ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          )}
          {(onEdit || onDelete) && <Divider />}
          {/* Standard climb actions */}
          <ClimbActions
            climb={climb}
            boardDetails={boardDetails}
            angle={item.angle}
            viewMode="list"
            exclude={excludeActions}
            onActionComplete={handleCloseActions}
          />
        </SwipeableDrawer>
      )}
    </>
  );
});

LogbookFeedItem.displayName = 'LogbookFeedItem';

export default LogbookFeedItem;

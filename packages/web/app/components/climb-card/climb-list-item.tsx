'use client';

import React, { useRef, useState, useCallback, useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import dynamic from 'next/dynamic';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import { Climb, BoardDetails } from '@/app/lib/types';
import ClimbThumbnail from './climb-thumbnail';
import ClimbTitle, { type ClimbTitleProps } from './climb-title';
import { ClimbActions } from '../climb-actions';
import { useDoubleTapFavorite } from '../climb-actions/use-double-tap-favorite';
import HeartAnimationOverlay from './heart-animation-overlay';
import { useSwipeActions } from '@/app/hooks/use-swipe-actions';
import { useDoubleTap } from '@/app/lib/hooks/use-double-tap';
import { themeTokens } from '@/app/theme/theme-config';
import { getGradeTintColor } from '@/app/lib/grade-colors';
import { getExcludedClimbActions } from '@/app/lib/climb-action-utils';
import type { ClimbActionType } from '../climb-actions/types';
import { useIsClimbSelected } from '../board-page/selected-climb-store';
import { AscentStatus } from './ascent-status';
import { InlineListTickBar } from '../logbook/inline-list-tick-bar';
import { useSnackbar } from '../providers/snackbar-provider';
import styles from './climb-list-item.module.css';

const SwipeableDrawer = dynamic(() => import('../swipeable-drawer/swipeable-drawer'), { ssr: false });
const PlaylistSelectionContent = dynamic(() => import('../climb-actions/playlist-selection-content'), { ssr: false });
const DrawerClimbHeader = dynamic(() => import('./drawer-climb-header'), { ssr: false });

// Swipe gesture constants
const MAX_GESTURE_SWIPE = 180;
const RIGHT_ACTION_WIDTH = 100;
const RIGHT_OVERRIDE_ACTION_WIDTH = 120;
const SHORT_SWIPE_THRESHOLD = 60;

// Static style objects (hoisted out of component)
const rightSwipeActionLayerBaseStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: themeTokens.spacing[4],
  willChange: 'opacity',
};

const rightActionLayerDefaultStyle: React.CSSProperties = {
  ...rightSwipeActionLayerBaseStyle,
  backgroundColor: themeTokens.colors.primary,
  opacity: 0,
  transition: 'opacity 120ms ease-out',
};

const rightActionLayerConfirmedStyle: React.CSSProperties = {
  ...rightSwipeActionLayerBaseStyle,
  backgroundColor: themeTokens.colors.success,
  opacity: 0,
  transition: 'opacity 120ms ease-out',
};

const defaultRightActionStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: RIGHT_ACTION_WIDTH,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: themeTokens.spacing[3],
  opacity: 0,
  visibility: 'hidden',
  overflow: 'hidden',
};

const iconStyle: React.CSSProperties = { color: 'white', fontSize: 20 };

const thumbnailStyle: React.CSSProperties = { width: themeTokens.spacing[16], flexShrink: 0, position: 'relative' };

const centerStyle: React.CSSProperties = { flex: 1, minWidth: 0 };

const iconButtonStyle: React.CSSProperties = { flexShrink: 0, color: 'var(--neutral-400)' };

const playlistDrawerStyles = {
  wrapper: { height: 'auto', maxHeight: '70vh', width: '100%' },
  body: { padding: 0 },
  header: { paddingLeft: `${themeTokens.spacing[3]}px`, paddingRight: `${themeTokens.spacing[3]}px` },
} as const;

export type SwipeActionOverride = {
  icon: React.ReactNode;
  color: string;
  onAction: () => void;
};

type ClimbListItemProps = {
  climb: Climb;
  boardDetails: BoardDetails;
  pathname: string;
  isDark: boolean;
  selected?: boolean;
  unsupported?: boolean;
  needsBiggerBoard?: boolean;
  onNeedsBiggerBoard?: () => void;
  disableSwipe?: boolean;
  onSelect?: () => void;
  swipeRightAction?: SwipeActionOverride;
  afterTitleSlot?: React.ReactNode;
  titleProps?: Partial<ClimbTitleProps>;
  backgroundColor?: string;
  contentOpacity?: number;
  preferImageLayers?: boolean;
  onThumbnailClick?: () => void;
  onOpenActions?: (climb: Climb) => void;
  onOpenPlaylistSelector?: (climb: Climb) => void;
  addToQueue?: (climb: Climb) => void;
};

const ClimbListItem: React.FC<ClimbListItemProps> = React.memo(
  ({
    climb,
    boardDetails,
    pathname,
    isDark,
    selected: selectedOverride,
    unsupported,
    needsBiggerBoard,
    onNeedsBiggerBoard,
    disableSwipe,
    onSelect,
    swipeRightAction,
    afterTitleSlot,
    titleProps,
    backgroundColor,
    contentOpacity,
    preferImageLayers,
    onThumbnailClick,
    onOpenActions,
    onOpenPlaylistSelector,
    addToQueue,
  }) => {
    const storeSelected = useIsClimbSelected(climb.uuid);
    const selected = selectedOverride ?? storeSelected;
    // When parent provides both drawer callbacks, skip local drawers entirely.
    const hasParentDrawers = Boolean(onOpenActions && onOpenPlaylistSelector);
    const [isPlaylistSelectorOpen, setIsPlaylistSelectorOpen] = useState(false);
    const [isInlineTickOpen, setIsInlineTickOpen] = useState(false);
    const rightActionLayerRef = useRef<HTMLDivElement>(null);
    const addToQueueRef = useRef(addToQueue);
    addToQueueRef.current = addToQueue;
    const { showMessage } = useSnackbar();
    const {
      handleDoubleTap,
      showHeart,
      dismissHeart,
      isFavorited,
    } = useDoubleTapFavorite({ climbUuid: climb.uuid });
    const { ref: doubleTapRef, onDoubleClick: handleDoubleTapClick } = useDoubleTap(handleDoubleTap);
    const onThumbnailClickRef = useRef(onThumbnailClick);
    onThumbnailClickRef.current = onThumbnailClick;

    // Per-direction override flag
    const hasRightOverride = Boolean(swipeRightAction);

    // Default swipe handlers
    // Swipe left (right action): add to queue
    const handleDefaultSwipeLeft = useCallback(() => {
      addToQueueRef.current?.(climb);
    }, [climb]);

    // Swipe right: reveal action overlay (in reveal-toggle mode, this is just a notification)
    const handleSwipeRightReveal = useCallback(() => {
      // In reveal-toggle mode, this fires when the overlay is revealed.
      // No action needed — the overlay is now visible.
    }, []);

    // Override handler for right swipe action (e.g., tick in queue)
    const handleOverrideSwipeLeft = useCallback(() => {
      swipeRightAction?.onAction();
    }, [swipeRightAction]);

    const resolvedSwipeLeft = hasRightOverride ? handleOverrideSwipeLeft : handleDefaultSwipeLeft;
    const rightActionRevealWidth = hasRightOverride ? RIGHT_OVERRIDE_ACTION_WIDTH : RIGHT_ACTION_WIDTH;

    // Direct DOM manipulation for swipe layer opacities — zero React re-renders during gesture
    const handleSwipeOffset = useCallback((offset: number) => {
      const leftOffset = offset < 0 ? -offset : 0;

      // Left swipe: queue/tick action opacity
      if (rightActionLayerRef.current) {
        rightActionLayerRef.current.style.opacity = String(Math.min(1, leftOffset / SHORT_SWIPE_THRESHOLD));
      }
    }, []);

    const { swipeHandlers, swipeLeftConfirmed, revealed, closeReveal, contentRef, leftActionRef, rightActionRef } = useSwipeActions({
      onSwipeLeft: resolvedSwipeLeft,
      onSwipeRight: handleSwipeRightReveal,
      onSwipeOffsetChange: handleSwipeOffset,
      swipeThreshold: SHORT_SWIPE_THRESHOLD,
      maxSwipe: MAX_GESTURE_SWIPE,
      maxSwipeLeft: rightActionRevealWidth,
      disabled: disableSwipe || isInlineTickOpen,
      confirmationPeekOffset: rightActionRevealWidth,
      revealMode: 'reveal-toggle',
      revealOffset: MAX_GESTURE_SWIPE,
    });

    const contentCombinedRef = useCallback((node: HTMLDivElement | null) => {
      if (!disableSwipe) {
        swipeHandlers.ref(node);
        contentRef(node);
      }
    }, [disableSwipe, swipeHandlers, contentRef]);

    // Stable refs
    const onNeedsBiggerBoardRef = useRef(onNeedsBiggerBoard);
    onNeedsBiggerBoardRef.current = onNeedsBiggerBoard;
    const needsBiggerBoardRef = useRef(needsBiggerBoard);
    needsBiggerBoardRef.current = needsBiggerBoard;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const handleThumbnailClick = useCallback((e: React.MouseEvent) => {
      if (needsBiggerBoardRef.current) {
        e.stopPropagation();
        onNeedsBiggerBoardRef.current?.();
        return;
      }
      if (!onThumbnailClickRef.current) return;
      e.stopPropagation();
      onThumbnailClickRef.current();
    }, []);

    const handleRowClick = useCallback(() => {
      if (revealed) {
        closeReveal();
        return;
      }
      if (needsBiggerBoardRef.current) {
        onNeedsBiggerBoardRef.current?.();
        return;
      }
      onSelectRef.current?.();
    }, [revealed, closeReveal]);

    const handleClosePlaylist = useCallback(() => setIsPlaylistSelectorOpen(false), []);

    // Menu button click handler (desktop)
    const handleMenuClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      if (onOpenActions) {
        onOpenActions(climb);
      }
    }, [onOpenActions, climb]);

    const excludeActions = useMemo(
      () => getExcludedClimbActions(boardDetails.board_name, 'list'),
      [boardDetails.board_name],
    );

    // Overlay has additional exclusions: queue (accessible via swipe-left) and setActive (contextual)
    const overlayExcludeActions = useMemo<ClimbActionType[]>(
      () => [...excludeActions, 'queue', 'setActive'],
      [excludeActions],
    );

    // Handle tick action from the overlay
    const handleTickFromOverlay = useCallback(() => {
      closeReveal();
      setIsInlineTickOpen(true);
    }, [closeReveal]);

    // Handle playlist action from the overlay
    const handlePlaylistFromOverlay = useCallback(() => {
      closeReveal();
      if (onOpenPlaylistSelector) {
        onOpenPlaylistSelector(climb);
      } else {
        setIsPlaylistSelectorOpen(true);
      }
    }, [closeReveal, onOpenPlaylistSelector, climb]);

    // Handle action complete in overlay (close overlay after most actions)
    const handleOverlayActionComplete = useCallback(() => {
      closeReveal();
    }, [closeReveal]);

    // Close tick bar
    const handleCloseTickBar = useCallback(() => {
      setIsInlineTickOpen(false);
    }, []);

    const handleTickError = useCallback(() => {
      showMessage("Couldn't save your tick — it's saved as a draft", 'error');
    }, [showMessage]);

    // Memoize style objects
    const containerStyle = useMemo(
      () => ({
        position: 'relative' as const,
        overflow: 'hidden' as const,
        // When overlay is revealed, set min-height so the absolutely-positioned
        // right action layer doesn't collapse, but let the content area be replaced.
        ...(unsupported || needsBiggerBoard ? { opacity: 0.5, filter: 'grayscale(80%)' } : {}),
      }),
      [unsupported, needsBiggerBoard],
    );

    const rightOverrideActionStyle = useMemo(
      () => ({
        position: 'absolute' as const,
        right: 0,
        top: 0,
        bottom: 0,
        width: rightActionRevealWidth,
        backgroundColor: swipeRightAction?.color ?? themeTokens.colors.error,
        display: 'flex' as const,
        alignItems: 'center' as const,
        justifyContent: 'flex-end' as const,
        paddingRight: themeTokens.spacing[4],
        opacity: 0,
        visibility: 'hidden' as const,
      }),
      [rightActionRevealWidth, swipeRightAction?.color],
    );

    const resolvedBg =
      backgroundColor ??
      (selected
        ? (getGradeTintColor(climb.difficulty, 'light', isDark) ?? 'var(--semantic-selected)')
        : 'var(--semantic-surface)');

    const swipeableContentStyle = useMemo(
      () => ({
        display: 'flex' as const,
        alignItems: 'center' as const,
        padding: `${themeTokens.spacing[2]}px ${themeTokens.spacing[2]}px`,
        gap: themeTokens.spacing[3],
        backgroundColor: resolvedBg,
        borderBottom: `1px solid var(--neutral-200)`,
        cursor: 'pointer' as const,
        userSelect: 'none' as const,
        opacity: contentOpacity ?? 1,
      }),
      [resolvedBg, contentOpacity],
    );

    const resolvedTitleProps = useMemo<Partial<ClimbTitleProps>>(
      () =>
        titleProps ?? {
          gradePosition: 'right',
          showSetterInfo: true,
          titleFontSize: themeTokens.typography.fontSize.xl,
          rightAddon: <AscentStatus climbUuid={climb.uuid} fontSize={20} />,
          favorited: isFavorited,
          isNoMatch: !!climb.is_no_match,
        },
      [titleProps, climb.uuid, isFavorited, climb.is_no_match],
    );

    // Memoize right action layer styles
    const rightActionDefaultLayerStyle = useMemo(
      () => swipeLeftConfirmed
        ? { ...rightActionLayerDefaultStyle, opacity: 0 }
        : rightActionLayerDefaultStyle,
      [swipeLeftConfirmed],
    );

    const rightActionConfirmedLayerStyle = useMemo(
      () => ({ ...rightActionLayerConfirmedStyle, opacity: swipeLeftConfirmed ? 1 : 0 }),
      [swipeLeftConfirmed],
    );

    return (
      <>
        <div style={containerStyle}>
          {!disableSwipe && (
            <>
              {/* Left action layer — bg for swipe gesture DOM manipulation */}
              <div ref={leftActionRef} className={styles.actionsOverlayBg} />

              {/* Right action (revealed on swipe left) */}
              {hasRightOverride ? (
                <div ref={rightActionRef} style={rightOverrideActionStyle}>
                  {swipeRightAction?.icon ?? null}
                </div>
              ) : (
                <div ref={rightActionRef} style={defaultRightActionStyle}>
                  <div ref={rightActionLayerRef} style={rightActionDefaultLayerStyle}>
                    <AddOutlined style={iconStyle} />
                  </div>
                  <div style={rightActionConfirmedLayerStyle}>
                    <CheckOutlined style={iconStyle} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Content (swipeable when swipe is enabled) */}
          <div
            {...(disableSwipe ? {} : swipeHandlers)}
            ref={contentCombinedRef}
            onClick={handleRowClick}
            style={swipeableContentStyle}
          >
            {/* Thumbnail */}
            <div
              ref={doubleTapRef}
              style={thumbnailStyle}
              data-testid="climb-thumbnail"
              onClick={handleThumbnailClick}
              onDoubleClick={handleDoubleTapClick}
            >
              <ClimbThumbnail
                boardDetails={boardDetails}
                currentClimb={climb}
                pathname={pathname}
                preferImageLayers={preferImageLayers}
              />
              <HeartAnimationOverlay visible={showHeart} onAnimationEnd={dismissHeart} size={32} />
            </div>

            {/* Center + Right: Name, stars, setter, colorized grade */}
            <div style={centerStyle}>
              <ClimbTitle climb={climb} {...resolvedTitleProps} />
            </div>

            {/* After-title slot (e.g., avatar) */}
            {afterTitleSlot}

            {/* Menu: ellipsis button (hidden on mobile — replaced by swipe overlay) */}
            <IconButton
              className={styles.menuButton}
              size="small"
              aria-label="More actions"
              onClick={handleMenuClick}
              style={iconButtonStyle}
              disableRipple
            >
              <MoreHorizOutlined />
            </IconButton>
          </div>
        </div>

        {/* Actions overlay — rendered outside the overflow:hidden container so it can be 2 rows */}
        {revealed && (
          <div className={styles.actionsOverlay} onClick={handleRowClick}>
            <ClimbActions
              climb={climb}
              boardDetails={boardDetails}
              angle={climb.angle}
              currentPathname={pathname}
              viewMode="overlay"
              exclude={overlayExcludeActions}
              onOpenPlaylistSelector={handlePlaylistFromOverlay}
              onActionComplete={handleOverlayActionComplete}
              onTickAction={handleTickFromOverlay}
            />
          </div>
        )}

        {/* Inline tick bar — only mounted when open to avoid unnecessary hook invocations */}
        {isInlineTickOpen && (
          <InlineListTickBar
            climb={climb}
            angle={climb.angle}
            boardDetails={boardDetails}
            open={isInlineTickOpen}
            onClose={handleCloseTickBar}
            onError={handleTickError}
          />
        )}

        {/* Playlist selector drawer — only when not delegated to parent */}
        {!hasParentDrawers && (
          <SwipeableDrawer
            title={<DrawerClimbHeader climb={climb} boardDetails={boardDetails} />}
            placement="bottom"
            open={isPlaylistSelectorOpen}
            onClose={handleClosePlaylist}
            styles={playlistDrawerStyles}
          >
            <PlaylistSelectionContent
              climbUuid={climb.uuid}
              boardDetails={boardDetails}
              angle={climb.angle}
              onDone={handleClosePlaylist}
            />
          </SwipeableDrawer>
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      prev.climb.uuid === next.climb.uuid &&
      prev.climb.frames === next.climb.frames &&
      prev.climb.name === next.climb.name &&
      prev.climb.mirrored === next.climb.mirrored &&
      prev.pathname === next.pathname &&
      prev.isDark === next.isDark &&
      prev.selected === next.selected &&
      prev.unsupported === next.unsupported &&
      prev.needsBiggerBoard === next.needsBiggerBoard &&
      prev.disableSwipe === next.disableSwipe &&
      prev.boardDetails === next.boardDetails &&
      prev.swipeRightAction === next.swipeRightAction &&
      prev.afterTitleSlot === next.afterTitleSlot &&
      prev.titleProps === next.titleProps &&
      prev.backgroundColor === next.backgroundColor &&
      prev.contentOpacity === next.contentOpacity &&
      prev.preferImageLayers === next.preferImageLayers &&
      prev.onOpenActions === next.onOpenActions &&
      prev.onOpenPlaylistSelector === next.onOpenPlaylistSelector
    );
  },
);

ClimbListItem.displayName = 'ClimbListItem';

export default ClimbListItem;

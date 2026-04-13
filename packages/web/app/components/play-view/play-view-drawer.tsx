'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo, useDeferredValue } from 'react';
import MuiBadge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined';
import Favorite from '@mui/icons-material/Favorite';
import SkipPreviousOutlined from '@mui/icons-material/SkipPreviousOutlined';
import SkipNextOutlined from '@mui/icons-material/SkipNextOutlined';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ThumbDownAltOutlined from '@mui/icons-material/ThumbDownAltOutlined';
import FormatListBulletedOutlined from '@mui/icons-material/FormatListBulletedOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import { usePathname } from 'next/navigation';
import { useQueueActions, useCurrentClimb, useQueueList, useSessionData } from '../graphql-queue';
import { ClimbActions } from '../climb-actions';
import { useDoubleTapFavorite } from '../climb-actions/use-double-tap-favorite';
import HeartAnimationOverlay from '../climb-card/heart-animation-overlay';
import PlaylistSelectionContent from '../climb-actions/playlist-selection-content';
import DrawerClimbHeader from '../climb-card/drawer-climb-header';
import { ShareBoardButton } from '../board-page/share-button';
import { useBoardProvider } from '../board-provider/board-provider-context';
import SwipeBoardCarousel from '../board-renderer/swipe-board-carousel';
import { useWakeLock } from '../board-bluetooth-control/use-wake-lock';
import { themeTokens } from '@/app/theme/theme-config';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import AngleSelector from '../board-page/angle-selector';
import ClimbDetailHeader from '@/app/components/climb-detail/climb-detail-header';
import { QuickTickBar, type QuickTickBarHandle } from '../logbook/quick-tick-bar';
import type { ActiveDrawer } from '../queue-control/queue-control-bar';
import { PLAY_DRAWER_EVENT } from '../queue-control/play-drawer-event';
import type { BoardDetails, Angle, Climb } from '@/app/lib/types';
import styles from './play-view-drawer.module.css';
import ClimbDetailShellClient from '@/app/components/climb-detail/climb-detail-shell.client';
import { useBuildClimbDetailSections } from '@/app/components/climb-detail/build-climb-detail-sections';
import { renderBoard } from '@/app/lib/board-render-worker/worker-manager';
import { useNestedDrawerSwipe } from '@/app/lib/hooks/use-nested-drawer-swipe';
import { usePullToClose, findScrollContainer } from '@/app/lib/hooks/pull-to-close';
import { useSnackbar } from '../providers/snackbar-provider';
import { getGradeTintColor } from '@/app/lib/grade-colors';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import QueueDrawer from './queue-drawer';



/** Window with optional requestIdleCallback (not available in all browsers). */
type WindowWithIdleCallback = Window & {
  requestIdleCallback?: ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
};

interface PlayDrawerContentProps {
  climb: Climb;
  boardType: string;
  angle: number;
  aboveFold: React.ReactNode;
  sectionsEnabled: boolean;
}

const PlayDrawerContent = React.memo<PlayDrawerContentProps>(({ climb, boardType, angle, aboveFold, sectionsEnabled }) => {
  const sections = useBuildClimbDetailSections({
    climb,
    climbUuid: climb.uuid,
    boardType,
    angle,
    currentClimbDifficulty: climb.difficulty ?? undefined,
    boardName: boardType,
    enabled: sectionsEnabled,
  });

  return <ClimbDetailShellClient mode="play" sections={sections} aboveFold={aboveFold} />;
});
PlayDrawerContent.displayName = 'PlayDrawerContent';

interface PlayViewActionBarProps {
  canSwipePrevious: boolean;
  canSwipeNext: boolean;
  isMirrored: boolean;
  supportsMirroring: boolean;
  isFavorited: boolean;
  remainingQueueCount: number;
  actionsExpanded: boolean;
  onPrevClick: () => void;
  onNextClick: () => void;
  onMirror: () => void;
  onToggleFavorite: () => void;
  onToggleActions: () => void;
  onOpenQueue: () => void;
  angleSelector?: React.ReactNode;
  expandedActionsContent?: React.ReactNode;
}

export const PlayViewActionBar = React.memo(function PlayViewActionBar({
  canSwipePrevious,
  canSwipeNext,
  isMirrored,
  supportsMirroring,
  isFavorited,
  remainingQueueCount,
  actionsExpanded,
  onPrevClick,
  onNextClick,
  onMirror,
  onToggleFavorite,
  onToggleActions,
  onOpenQueue,
  angleSelector,
  expandedActionsContent,
}: PlayViewActionBarProps) {
  return (
    <div className={styles.actionBarWrapper}>
      <div className={`${styles.actionBar} ${actionsExpanded ? styles.actionBarExpanded : ''}`}>
        <div className={styles.actionBarItem}>
          <IconButton disabled={!canSwipePrevious} onClick={onPrevClick}>
            <SkipPreviousOutlined />
          </IconButton>
          <span className={styles.actionBarLabel}>Prev</span>
        </div>
        {supportsMirroring && (
          <div className={styles.actionBarItem}>
            <IconButton
              color={isMirrored ? 'primary' : 'default'}
              onClick={onMirror}
              sx={
                isMirrored
                  ? { backgroundColor: themeTokens.colors.purple, borderColor: themeTokens.colors.purple, color: 'common.white', '&:hover': { backgroundColor: themeTokens.colors.purple } }
                  : undefined
              }
            >
              <SyncOutlined />
            </IconButton>
            <span className={styles.actionBarLabel}>Mirror</span>
          </div>
        )}
        <div className={styles.actionBarItem}>
          <IconButton onClick={onToggleFavorite}>
            {isFavorited ? <Favorite sx={{ color: themeTokens.colors.error }} /> : <FavoriteBorderOutlined />}
          </IconButton>
          <span className={styles.actionBarLabel}>{isFavorited ? 'Liked' : 'Like'}</span>
        </div>
        <div className={styles.actionBarItem}>
          <ShareBoardButton />
          <span className={styles.actionBarLabel}>LEDs</span>
        </div>
        {angleSelector}
        <div className={styles.actionBarItem}>
          <IconButton onClick={onToggleActions} aria-label={actionsExpanded ? 'Close actions' : 'Climb actions'}>
            {actionsExpanded ? <CloseOutlined /> : <MoreHorizOutlined />}
          </IconButton>
          <span className={styles.actionBarLabel}>{actionsExpanded ? 'Close' : 'More'}</span>
        </div>
        <div className={styles.actionBarItem}>
          <MuiBadge badgeContent={remainingQueueCount} max={99} sx={{ '& .MuiBadge-badge': { backgroundColor: themeTokens.colors.primary, color: 'common.white' } }}>
            <IconButton onClick={onOpenQueue} aria-label="Open queue">
              <FormatListBulletedOutlined />
            </IconButton>
          </MuiBadge>
          <span className={styles.actionBarLabel}>Queue</span>
        </div>
        <div className={styles.actionBarItem}>
          <IconButton disabled={!canSwipeNext} onClick={onNextClick}>
            <SkipNextOutlined />
          </IconButton>
          <span className={styles.actionBarLabel}>Next</span>
        </div>
      </div>

      {/* Expanded actions row — animates open/closed below the main bar */}
      <div className={`${styles.expandedActionsRow} ${actionsExpanded ? styles.expandedActionsRowOpen : ''}`}>
        <div className={styles.expandedActionsContent}>
          {expandedActionsContent}
        </div>
      </div>
    </div>
  );
});
PlayViewActionBar.displayName = 'PlayViewActionBar';

/** Actions already in the action bar — excluded from the expanded actions row. */
const PLAY_VIEW_EXPANDED_EXCLUDE: Array<import('../climb-actions/types').ClimbActionType> = [
  'tick', 'queue', 'favorite', 'mirror', 'share',
];

/**
 * Extracted tick bar component that owns its own `tickComment` state.
 * This prevents comment keystrokes from invalidating the parent `aboveFold` useMemo,
 * which would otherwise re-render the entire board carousel on every keystroke.
 */
interface PlayViewTickBarProps {
  isTickBarActive: boolean;
  currentClimb: Climb;
  angle: Angle;
  boardDetails: BoardDetails;
  onClose: () => void;
  onError: () => void;
}

const PlayViewTickBar = React.memo<PlayViewTickBarProps>(function PlayViewTickBar({
  isTickBarActive,
  currentClimb,
  angle,
  boardDetails,
  onClose,
  onError,
}) {
  const [tickComment, setTickComment] = useState('');
  const [commentFocused, setCommentFocused] = useState(false);
  const quickTickBarRef = useRef<QuickTickBarHandle>(null);
  const isDark = useIsDarkMode();
  const gradeTintColor = useMemo(
    () => getGradeTintColor(currentClimb.difficulty, 'default', isDark),
    [currentClimb.difficulty, isDark],
  );

  const handleCommentFocus = useCallback(() => setCommentFocused(true), []);
  const handleCommentBlur = useCallback(() => setCommentFocused(false), []);

  // Reset comment when the tick bar closes
  const handleClose = useCallback(() => {
    setTickComment('');
    setCommentFocused(false);
    onClose();
  }, [onClose]);

  // Reset comment when the climb changes
  useEffect(() => {
    setTickComment('');
    setCommentFocused(false);
  }, [currentClimb.uuid]);

  return (
    <div className={`${styles.tickBarContainer} ${isTickBarActive ? styles.tickBarContainerActive : ''}`}>
      <div
        className={styles.tickBarInner}
        style={{ backgroundColor: gradeTintColor ?? (isDark ? 'var(--semantic-surfaceElevated)' : 'var(--semantic-surface)') }}
      >
        <QuickTickBar
          ref={quickTickBarRef}
          currentClimb={currentClimb}
          angle={angle}
          boardDetails={boardDetails}
          onSave={handleClose}
          onError={onError}
          onDraftRestored={(draftComment) => setTickComment(draftComment)}
          comment={tickComment}
          commentSlot={
            <TextField
              size="small"
              placeholder="Comment..."
              value={tickComment}
              onChange={(e) => setTickComment(e.target.value)}
              onFocus={handleCommentFocus}
              onBlur={handleCommentBlur}
              variant="outlined"
              fullWidth
              multiline
              minRows={1}
              maxRows={commentFocused ? 4 : 1}
              slotProps={{
                htmlInput: { maxLength: 2000, 'aria-label': 'Tick comment' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: '8px' }}>
                      <ChatBubbleOutlineOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  sx: { fontSize: 14 },
                },
              }}
            />
          }
        />
        {/* Tick bar action buttons */}
        {isTickBarActive && (
          <div className={styles.tickBarButtons}>
            <IconButton
              size="small"
              onClick={() => quickTickBarRef.current?.saveAttempt()}
              aria-label="Log attempt"
              sx={{
                width: 36,
                height: 36,
                backgroundColor: themeTokens.colors.error,
                color: 'common.white',
                '&:hover': { backgroundColor: themeTokens.colors.error },
              }}
            >
              <ThumbDownAltOutlined sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => quickTickBarRef.current?.save()}
              aria-label="Log ascent"
              sx={{
                width: 40,
                height: 40,
                backgroundColor: themeTokens.colors.success,
                color: 'common.white',
                '&:hover': { backgroundColor: themeTokens.colors.success },
              }}
            >
              <CheckOutlined sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleClose}
              aria-label="Cancel"
              sx={{ width: 36, height: 36, color: 'text.secondary' }}
            >
              <CloseOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
});
PlayViewTickBar.displayName = 'PlayViewTickBar';

interface PlayViewDrawerProps {
  activeDrawer: ActiveDrawer;
  setActiveDrawer: (drawer: ActiveDrawer) => void;
  boardDetails: BoardDetails;
  angle: Angle;
}


const PlayViewDrawer: React.FC<PlayViewDrawerProps> = ({
  activeDrawer,
  setActiveDrawer,
  boardDetails,
  angle,
}) => {
  const isOpen = activeDrawer === 'play';
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queueMounted, setQueueMounted] = useState(false);
  const [isPlaylistSelectorOpen, setIsPlaylistSelectorOpen] = useState(false);
  const [isTickBarActive, setIsTickBarActive] = useState(false);
  const [isBoardZoomed, setIsBoardZoomed] = useState(false);

  useEffect(() => {
    const scrollContainer = playPaperRef.current?.querySelector('[data-scroll-container]') as HTMLElement | null;
    if (!scrollContainer) return;
    scrollContainer.style.overflowY = isBoardZoomed ? 'hidden' : '';
  }, [isBoardZoomed, isOpen]);

  const playPaperRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const { showMessage } = useSnackbar();

  const { logbook } = useBoardProvider();

  const currentClimbData = useCurrentClimb();
  const queueListData = useQueueList();
  const sessionData = useSessionData();

  const deferredCurrentClimb = useDeferredValue(currentClimbData);
  const deferredQueue = useDeferredValue(queueListData);
  const deferredSession = useDeferredValue(sessionData);

  const { currentClimb, currentClimbQueueItem } = isOpen ? currentClimbData : deferredCurrentClimb;
  const { queue } = isOpen ? queueListData : deferredQueue;
  const { viewOnlyMode } = isOpen ? sessionData : deferredSession;
  const {
    mirrorClimb,
    getNextClimbQueueItem,
    getPreviousClimbQueueItem,
    setCurrentClimbQueueItem,
  } = useQueueActions();

  const {
    handleDoubleTap,
    showHeart,
    dismissHeart,
    isFavorited,
    toggleFavorite,
  } = useDoubleTapFavorite({
    climbUuid: currentClimb?.uuid ?? '',
  });

  const currentQueueIndex = currentClimbQueueItem
    ? queue.findIndex(item => item.uuid === currentClimbQueueItem.uuid)
    : -1;
  const remainingQueueCount = currentQueueIndex >= 0 ? queue.length - currentQueueIndex : queue.length;

  useWakeLock(isOpen);

  // Hash-based back button support
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState(null, '', '#playing');

    const handlePopState = () => {
      setActiveDrawer('none');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.location.hash === '#playing') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
  }, [isOpen, setActiveDrawer]);

  const handleClose = useCallback(() => {
    if (isQueueOpen || isPlaylistSelectorOpen) return;
    setDrawerOpen(false);
    setActiveDrawer('none');
    if (window.location.hash === '#playing') {
      window.history.back();
    }
  }, [setActiveDrawer, isQueueOpen, isPlaylistSelectorOpen]);

  // Compute ascent info for tick FAB badge
  const currentAngle = typeof angle === 'string' ? parseInt(angle, 10) : angle;
  const filteredLogbook = useMemo(() => {
    if (!logbook || !currentClimb) return [];
    return logbook.filter(
      (asc) => asc.climb_uuid === currentClimb.uuid && Number(asc.angle) === currentAngle
    );
  }, [logbook, currentClimb, currentAngle]);

  const hasSuccessfulAscent = filteredLogbook.some((asc) => asc.is_ascent);
  const ascentCount = filteredLogbook.length;

  // Card-swipe navigation
  const nextItem = getNextClimbQueueItem();
  const prevItem = getPreviousClimbQueueItem();

  const handleSwipeNext = useCallback(() => {
    const next = getNextClimbQueueItem();
    if (!next || viewOnlyMode) return;
    setCurrentClimbQueueItem(next);
  }, [getNextClimbQueueItem, setCurrentClimbQueueItem, viewOnlyMode]);

  const handleSwipePrevious = useCallback(() => {
    const prev = getPreviousClimbQueueItem();
    if (!prev || viewOnlyMode) return;
    setCurrentClimbQueueItem(prev);
  }, [getPreviousClimbQueueItem, setCurrentClimbQueueItem, viewOnlyMode]);

  const canSwipeNext = !viewOnlyMode && !!nextItem;
  const canSwipePrevious = !viewOnlyMode && !!prevItem;

  // Tick FAB → inline tick bar
  const handleTickFabClick = useCallback(() => {
    setActionsExpanded(false);
    setIsTickBarActive(true);
  }, []);

  const handleTickBarClose = useCallback(() => {
    setIsTickBarActive(false);
  }, []);

  // Reset tick bar when the climb changes so it doesn't stay open for the wrong climb
  useEffect(() => {
    setIsTickBarActive(false);
  }, [currentClimb?.uuid]);

  const handleTickBarError = useCallback(() => {
    showMessage("Couldn't save your tick — it's saved as a draft", 'error');
  }, [showMessage]);

  const handlePrevNavClick = useCallback(() => {
    const prev = getPreviousClimbQueueItem();
    if (prev) setCurrentClimbQueueItem(prev);
  }, [getPreviousClimbQueueItem, setCurrentClimbQueueItem]);
  const handleNextNavClick = useCallback(() => {
    const next = getNextClimbQueueItem();
    if (next) setCurrentClimbQueueItem(next);
  }, [getNextClimbQueueItem, setCurrentClimbQueueItem]);
  const handleToggleActions = useCallback(() => {
    setActionsExpanded(prev => !prev);
  }, []);
  const handleOpenQueueDrawer = useCallback(() => {
    setActionsExpanded(false);
    setIsPlaylistSelectorOpen(false);
    setQueueMounted(true);
    setIsQueueOpen(true);
  }, []);

  const isMirrored = !!currentClimb?.mirrored;

  // Playlist drawer
  const handleClosePlaylist = useCallback(() => setIsPlaylistSelectorOpen(false), []);
  const playlistSwipe = useNestedDrawerSwipe(handleClosePlaylist);

  // Queue drawer callbacks
  const handleCloseQueueDrawer = useCallback(() => {
    setIsQueueOpen(false);
  }, []);
  const handleQueueTransitionEnd = useCallback((open: boolean) => {
    if (!open && !isQueueOpen) {
      setQueueMounted(false);
    }
  }, [isQueueOpen]);

  useEffect(() => {
    const handler = () => setIsQueueOpen(false);
    window.addEventListener(PLAY_DRAWER_EVENT, handler);
    return () => window.removeEventListener(PLAY_DRAWER_EVENT, handler);
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openRafRef = useRef<number>(0);
  const hasBeenMountedRef = useRef(false);

  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    const setReady = () => {
      setContentReady(true);
      hasBeenMountedRef.current = true;
    };
    const w = window as WindowWithIdleCallback;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(setReady, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = requestAnimationFrame(setReady);
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      cancelAnimationFrame(openRafRef.current);
      setDrawerOpen(false);
      setQueueMounted(false);
      setIsQueueOpen(false);
      setActionsExpanded(false);
      setIsTickBarActive(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (playPaperRef.current) {
        playPaperRef.current.style.transform = '';
        playPaperRef.current.style.transition = '';
      }
      setContentReady(true);
      if (hasBeenMountedRef.current) {
        setDrawerOpen(true);
      } else {
        hasBeenMountedRef.current = true;
        openRafRef.current = requestAnimationFrame(() => {
          setDrawerOpen(true);
        });
      }
    }
    return () => cancelAnimationFrame(openRafRef.current);
  }, [isOpen]);

  const [sectionsEverEnabled, setSectionsEverEnabled] = useState(false);
  const handleTransitionEnd = useCallback((open: boolean) => {
    if (open) setSectionsEverEnabled(true);
  }, []);

  const currentFrames = currentClimb?.frames;
  const currentMirrored = currentClimb?.mirrored;
  useEffect(() => {
    if (currentClimb) {
      renderBoard({ boardDetails, frames: currentClimb.frames, mirrored: !!currentClimb.mirrored }).catch((e: unknown) => {
        if (process.env.NODE_ENV === 'development') console.debug('Pre-warm render failed:', e);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [currentFrames, currentMirrored, boardDetails]);

  const handleBoardPullClose = useCallback(() => {
    setDrawerOpen(false);
    setActiveDrawer('none');
    if (window.location.hash === '#playing') {
      window.history.back();
    }
  }, [setActiveDrawer]);

  const boardPull = usePullToClose({
    paperEl: playPaperRef.current,
    onClose: handleBoardPullClose,
    deadZone: 60,
    closeThreshold: 70,
    trackPullOrigin: true,
    offsetByDeadZone: true,
  });

  const handleBoardTouchStart = useCallback((e: React.TouchEvent) => {
    (e.nativeEvent as unknown as Record<string, unknown>).defaultMuiPrevented = true;

    const scrollContainer = findScrollContainer(e.target as HTMLElement);
    const y = e.touches[0].clientY;
    boardPull.onTouchStart(y, scrollContainer);

    if (scrollContainer && scrollContainer.scrollTop <= 0) {
      boardPull.stateRef.current.pullOriginY = y;
    }
  }, [boardPull]);

  const handleBoardTouchMove = useCallback((e: React.TouchEvent) => {
    boardPull.onTouchMove(e.touches[0].clientY, e.touches.length, isBoardZoomed);
  }, [boardPull, isBoardZoomed]);

  const handleBoardTouchEnd = useCallback(() => {
    boardPull.onTouchEnd();
  }, [boardPull]);

  // Expanded actions content for the action bar
  const expandedActionsContent = useMemo(() => {
    if (!currentClimb) return null;
    return (
      <ClimbActions
        climb={currentClimb}
        boardDetails={boardDetails}
        angle={currentAngle}
        currentPathname={pathname}
        viewMode="overlay"
        exclude={PLAY_VIEW_EXPANDED_EXCLUDE}
        onOpenPlaylistSelector={() => {
          setActionsExpanded(false);
          setIsPlaylistSelectorOpen(true);
        }}
        onActionComplete={() => setActionsExpanded(false)}
      />
    );
  }, [currentClimb, boardDetails, currentAngle, pathname]);

  const aboveFold = useMemo(() => {
    if (!currentClimb) return null;
    return (
    <>
      {/* Header: Grade | Name */}
      <div className={styles.headerSection}>
        <ClimbDetailHeader climb={currentClimb} />
      </div>

      {/* Board renderer with card-swipe and floating Tick FAB */}
      <div className={styles.boardSectionWrapper}>
        {currentClimb && (
          <SwipeBoardCarousel
            boardDetails={boardDetails}
            currentClimb={currentClimb}
            nextClimb={nextItem?.climb}
            previousClimb={prevItem?.climb}
            onSwipeNext={handleSwipeNext}
            onSwipePrevious={handleSwipePrevious}
            canSwipeNext={canSwipeNext}
            canSwipePrevious={canSwipePrevious}
            className={styles.boardSection}
            boardContainerClassName={styles.swipeCardContainer}
            fillContainer
            onDoubleTap={handleDoubleTap}
            showZoomHint
            isDrawerOpen={isOpen}
            onZoomChange={setIsBoardZoomed}
            overlay={<HeartAnimationOverlay visible={showHeart} onAnimationEnd={dismissHeart} />}
          />
        )}

        {/* Floating Tick FAB - hides when tick bar is active */}
        {isOpen && (
          <div className={styles.tickFabContainer}>
            <button
              className={`${styles.tickFab} ${hasSuccessfulAscent ? styles.tickFabSuccess : ''} ${isTickBarActive ? styles.tickFabHiding : ''}`}
              onClick={handleTickFabClick}
              aria-label="Log ascent"
              disabled={isTickBarActive}
            >
              <CheckOutlined className={styles.tickFabIcon} />
              {ascentCount > 0 && (
                <span className={styles.tickFabBadge}>{ascentCount}</span>
              )}
            </button>
          </div>
        )}

        {/* Floating tick bar — overlays bottom of board section, no reflow */}
        {isOpen && currentClimb && (
          <PlayViewTickBar
            isTickBarActive={isTickBarActive}
            currentClimb={currentClimb}
            angle={angle}
            boardDetails={boardDetails}
            onClose={handleTickBarClose}
            onError={handleTickBarError}
          />
        )}
      </div>

      {/* Action bar */}
      {isOpen && (
        <PlayViewActionBar
          canSwipePrevious={canSwipePrevious}
          canSwipeNext={canSwipeNext}
          isMirrored={isMirrored}
          supportsMirroring={!!boardDetails.supportsMirroring}
          isFavorited={isFavorited}
          remainingQueueCount={remainingQueueCount}
          actionsExpanded={actionsExpanded}
          onPrevClick={handlePrevNavClick}
          onNextClick={handleNextNavClick}
          onMirror={mirrorClimb}
          onToggleFavorite={toggleFavorite}
          onToggleActions={handleToggleActions}
          onOpenQueue={handleOpenQueueDrawer}
          angleSelector={
            <AngleSelector
              boardName={boardDetails.board_name}
              boardDetails={boardDetails}
              currentAngle={currentAngle}
              currentClimb={currentClimb}
              isAngleAdjustable
            />
          }
          expandedActionsContent={expandedActionsContent}
        />
      )}
    </>
    );
  }, [
    currentClimb,
    boardDetails,
    currentAngle,
    nextItem,
    prevItem,
    handleSwipeNext,
    handleSwipePrevious,
    canSwipeNext,
    canSwipePrevious,
    handleDoubleTap,
    showHeart,
    dismissHeart,
    isOpen,
    hasSuccessfulAscent,
    ascentCount,
    handleTickFabClick,
    isTickBarActive,
    isMirrored,
    isFavorited,
    remainingQueueCount,
    actionsExpanded,
    handlePrevNavClick,
    handleNextNavClick,
    mirrorClimb,
    toggleFavorite,
    handleToggleActions,
    handleOpenQueueDrawer,
    expandedActionsContent,
    angle,
    handleTickBarClose,
    handleTickBarError,
  ]);

  return (
    <>
    <SwipeableDrawer
      placement="bottom"
      height="100%"
      fullHeight
      open={drawerOpen}
      onClose={handleClose}
      onTransitionEnd={handleTransitionEnd}
      keepMounted
      paperRef={playPaperRef}
      swipeEnabled={!isQueueOpen && !isPlaylistSelectorOpen}
      showDragHandle={true}
      styles={{
        body: { padding: 0 },
        wrapper: { height: '100%', backgroundColor: 'var(--semantic-background)' },
      }}
    >
      {(contentReady || isOpen) ? (<>
      <IconButton
        size="small"
        onClick={handleClose}
        aria-label="Close"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          color: 'text.primary',
          backgroundColor: 'action.selected',
          '&:hover': { backgroundColor: 'action.focus' },
        }}
      >
        <CloseOutlined />
      </IconButton>
      <div className={styles.drawerContent} onTouchStart={handleBoardTouchStart} onTouchMove={handleBoardTouchMove} onTouchEnd={handleBoardTouchEnd}>
        {currentClimb ? (
          <PlayDrawerContent
            climb={currentClimb}
            boardType={boardDetails.board_name}
            angle={currentAngle}
            sectionsEnabled={sectionsEverEnabled && isOpen}
            aboveFold={aboveFold}
          />
        ) : (
          <ClimbDetailShellClient mode="play" sections={[]} aboveFold={null} />
        )}
      </div>

        {/* Playlist selector drawer */}
        {isOpen && currentClimb && isPlaylistSelectorOpen && (
          <SwipeableDrawer
            title={<DrawerClimbHeader climb={currentClimb} boardDetails={boardDetails} />}
            placement="bottom"
            open={isPlaylistSelectorOpen}
            onClose={handleClosePlaylist}
            paperRef={playlistSwipe.paperRef}
            swipeEnabled={false}
            disablePortal
            styles={{
              wrapper: { height: 'auto', maxHeight: '70vh' },
              body: { padding: 0 },
              header: { paddingLeft: `${themeTokens.spacing[3]}px`, paddingRight: `${themeTokens.spacing[3]}px` },
            }}
          >
            <PlaylistSelectionContent
              climbUuid={currentClimb.uuid}
              boardDetails={boardDetails}
              angle={currentAngle}
              onDone={handleClosePlaylist}
            />
          </SwipeableDrawer>
        )}
      </>) : null}

        {/* Queue list drawer */}
        {queueMounted && (
          <QueueDrawer
            open={isQueueOpen}
            onClose={handleCloseQueueDrawer}
            onTransitionEnd={handleQueueTransitionEnd}
            boardDetails={boardDetails}
          />
        )}
    </SwipeableDrawer>
    </>
  );
};

export default React.memo(PlayViewDrawer);

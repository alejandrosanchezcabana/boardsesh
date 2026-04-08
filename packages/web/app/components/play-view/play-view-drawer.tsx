'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo, useDeferredValue } from 'react';
import MuiBadge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import FavoriteBorderOutlined from '@mui/icons-material/FavoriteBorderOutlined';
import Favorite from '@mui/icons-material/Favorite';
import SkipPreviousOutlined from '@mui/icons-material/SkipPreviousOutlined';
import SkipNextOutlined from '@mui/icons-material/SkipNextOutlined';
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined';
import FormatListBulletedOutlined from '@mui/icons-material/FormatListBulletedOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
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
import ClimbDetailHeader from '@/app/components/climb-detail/climb-detail-header';
import { LogAscentDrawer } from '../logbook/log-ascent-drawer';
import type { ActiveDrawer } from '../queue-control/queue-control-bar';
import type { BoardDetails, Angle, Climb } from '@/app/lib/types';
import styles from './play-view-drawer.module.css';
import ClimbDetailShellClient from '@/app/components/climb-detail/climb-detail-shell.client';
import { useBuildClimbDetailSections } from '@/app/components/climb-detail/build-climb-detail-sections';
import { renderBoard } from '@/app/lib/board-render-worker/worker-manager';
import { useNestedDrawerSwipe } from '@/app/lib/hooks/use-nested-drawer-swipe';
import { usePullToClose, findScrollContainer } from '@/app/lib/hooks/pull-to-close';
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
  onPrevClick: () => void;
  onNextClick: () => void;
  onMirror: () => void;
  onToggleFavorite: () => void;
  onOpenActions: () => void;
  onOpenQueue: () => void;
}

export const PlayViewActionBar = React.memo(function PlayViewActionBar({
  canSwipePrevious,
  canSwipeNext,
  isMirrored,
  supportsMirroring,
  isFavorited,
  remainingQueueCount,
  onPrevClick,
  onNextClick,
  onMirror,
  onToggleFavorite,
  onOpenActions,
  onOpenQueue,
}: PlayViewActionBarProps) {
  return (
    <div className={styles.actionBar}>
      <IconButton disabled={!canSwipePrevious} onClick={onPrevClick}>
        <SkipPreviousOutlined />
      </IconButton>
      {supportsMirroring && (
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
      )}
      <IconButton onClick={onToggleFavorite}>
        {isFavorited ? <Favorite sx={{ color: themeTokens.colors.error }} /> : <FavoriteBorderOutlined />}
      </IconButton>
      <ShareBoardButton />
      <IconButton onClick={onOpenActions} aria-label="Climb actions">
        <MoreHorizOutlined />
      </IconButton>
      <MuiBadge badgeContent={remainingQueueCount} max={99} sx={{ '& .MuiBadge-badge': { backgroundColor: themeTokens.colors.primary, color: 'common.white' } }}>
        <IconButton onClick={onOpenQueue} aria-label="Open queue">
          <FormatListBulletedOutlined />
        </IconButton>
      </MuiBadge>
      <IconButton disabled={!canSwipeNext} onClick={onNextClick}>
        <SkipNextOutlined />
      </IconButton>
    </div>
  );
});
PlayViewActionBar.displayName = 'PlayViewActionBar';

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
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  // Lazy-mount: queue drawer tree only exists in DOM after the user first opens it.
  // This avoids mounting ~30 ClimbListItems (~225ms) when the play drawer opens.
  const [queueMounted, setQueueMounted] = useState(false);
  const [isPlaylistSelectorOpen, setIsPlaylistSelectorOpen] = useState(false);
  const [isTickDrawerOpen, setIsTickDrawerOpen] = useState(false);
  const [isBoardZoomed, setIsBoardZoomed] = useState(false);

  // Lock the scroll container when the board is zoomed so single-finger
  // drags pan the zoomed board instead of scrolling below the fold.
  // isOpen re-runs the query when the drawer mounts (scroll container may not exist yet).
  useEffect(() => {
    const scrollContainer = playPaperRef.current?.querySelector('[data-scroll-container]') as HTMLElement | null;
    if (!scrollContainer) return;
    scrollContainer.style.overflowY = isBoardZoomed ? 'hidden' : '';
  }, [isBoardZoomed, isOpen]);

  const playPaperRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();

  // Get logbook data for tick FAB badge
  const { logbook } = useBoardProvider();

  // Fine-grained context hooks (only re-render when specific data changes)
  const currentClimbData = useCurrentClimb();
  const queueListData = useQueueList();
  const sessionData = useSessionData();

  // When the drawer is closed, defer context updates so they don't block the main
  // thread. React will batch these into low-priority renders that yield to user input.
  const deferredCurrentClimb = useDeferredValue(currentClimbData);
  const deferredQueue = useDeferredValue(queueListData);
  const deferredSession = useDeferredValue(sessionData);

  // Use immediate values when open (responsive), deferred when closed (non-blocking)
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

  // Wake lock when drawer is open
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
    if (isActionsOpen || isQueueOpen || isPlaylistSelectorOpen || isTickDrawerOpen) return;
    // Set drawerOpen false directly so React batches it with the parent state
    // update in a single render. This avoids a multi-cycle delay that would
    // leave the Paper sitting at the swipe position after a fling gesture.
    setDrawerOpen(false);
    setActiveDrawer('none');
    if (window.location.hash === '#playing') {
      window.history.back();
    }
  }, [setActiveDrawer, isActionsOpen, isQueueOpen, isPlaylistSelectorOpen, isTickDrawerOpen]);

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

  const handleTickFabClick = useCallback(() => setIsTickDrawerOpen(true), []);
  const handlePrevNavClick = useCallback(() => {
    const prev = getPreviousClimbQueueItem();
    if (prev) setCurrentClimbQueueItem(prev);
  }, [getPreviousClimbQueueItem, setCurrentClimbQueueItem]);
  const handleNextNavClick = useCallback(() => {
    const next = getNextClimbQueueItem();
    if (next) setCurrentClimbQueueItem(next);
  }, [getNextClimbQueueItem, setCurrentClimbQueueItem]);
  const handleOpenActionsMenu = useCallback(() => {
    setIsQueueOpen(false);
    setIsPlaylistSelectorOpen(false);
    setIsActionsOpen(true);
  }, []);
  const handleOpenQueueDrawer = useCallback(() => {
    setIsActionsOpen(false);
    setIsPlaylistSelectorOpen(false);
    setQueueMounted(true);
    setIsQueueOpen(true);
  }, []);

  const isMirrored = !!currentClimb?.mirrored;

  // Custom swipe-to-close for nested disablePortal drawers (actions + playlist)
  const handleCloseActions = useCallback(() => setIsActionsOpen(false), []);
  const actionsSwipe = useNestedDrawerSwipe(handleCloseActions);
  const handleClosePlaylist = useCallback(() => setIsPlaylistSelectorOpen(false), []);
  const playlistSwipe = useNestedDrawerSwipe(handleClosePlaylist);

  // Queue drawer callbacks
  const handleCloseQueueDrawer = useCallback(() => {
    setIsQueueOpen(false);
  }, []);
  const handleQueueTransitionEnd = useCallback((open: boolean) => {
    if (!open && !isQueueOpen) {
      // Unmount queue tree after close animation completes
      setQueueMounted(false);
    }
  }, [isQueueOpen]);
  const handleQueueClimbNavigate = useCallback(() => {
    setIsQueueOpen(false);
    setActiveDrawer('none');
  }, [setActiveDrawer]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openRafRef = useRef<number>(0);
  const hasBeenMountedRef = useRef(false);

  // Eagerly pre-mount drawer content during browser idle time so the DOM and
  // WASM board render are ready before the user ever opens the drawer.
  // Falls back to immediate mount if the user opens before idle fires.
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

  // Close path: runs before paint so the Slide exit animation starts immediately
  useLayoutEffect(() => {
    if (!isOpen) {
      cancelAnimationFrame(openRafRef.current);
      setDrawerOpen(false);
      // Unmount queue drawer tree when play drawer closes
      setQueueMounted(false);
      setIsQueueOpen(false);
    }
  }, [isOpen]);

  // Open path: if content is already pre-mounted, open immediately (0ms).
  // Otherwise give the browser one frame to paint freshly-mounted content.
  useEffect(() => {
    if (isOpen) {
      // Clear any leftover inline styles from a custom pull-to-close gesture
      if (playPaperRef.current) {
        playPaperRef.current.style.transform = '';
        playPaperRef.current.style.transition = '';
      }
      setContentReady(true); // ensure content mounts if idle hasn't fired yet
      if (hasBeenMountedRef.current) {
        // Content already in DOM — open instantly
        setDrawerOpen(true);
      } else {
        // First open before idle: single rAF (~16ms) instead of double (~33ms)
        hasBeenMountedRef.current = true;
        openRafRef.current = requestAnimationFrame(() => {
          setDrawerOpen(true);
        });
      }
    }
    return () => cancelAnimationFrame(openRafRef.current);
  }, [isOpen]);

  // Once the open animation completes, enable below-fold sections permanently.
  // Using "once enabled, stays enabled" avoids section unmount/remount on re-opens.
  const [sectionsEverEnabled, setSectionsEverEnabled] = useState(false);
  const handleTransitionEnd = useCallback((open: boolean) => {
    if (open) setSectionsEverEnabled(true);
  }, []);

  // Pre-warm WASM board render whenever the current climb changes (even when
  // drawer is closed). The worker runs off-thread so this has zero main-thread
  // cost. When the drawer opens, BoardCanvasRenderer gets an instant cache hit.
  //
  // Deps use optional chaining (currentClimb?.frames, currentClimb?.mirrored)
  // intentionally: we only care about re-running when the climb's visual data
  // changes, not when the entire currentClimb object reference changes. The
  // guard `if (currentClimb)` inside the effect body ensures safe access.
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

  // Custom pull-to-close on the board area.
  // MUI's getDomTreeShapes fails to detect the mobileScrollLayout scroll
  // container through the board's overflow:hidden layers, so we block MUI
  // and handle the close gesture ourselves. When at scroll top and pulling
  // down, the play drawer Paper follows the finger and closes past threshold.
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

    // Find nearest scroll container (mobileScrollLayout) by walking up from
    // the touched element, not e.currentTarget (which is drawerContent — the
    // scroll container is a descendant of drawerContent, not an ancestor).
    const scrollContainer = findScrollContainer(e.target as HTMLElement);
    const y = e.touches[0].clientY;
    boardPull.onTouchStart(y, scrollContainer);

    // When at scroll top at touch start, set pullOriginY to the touch Y
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

  const aboveFold = useMemo(() => {
    if (!currentClimb) return null;
    return (
    <>
      {/* Header: Grade | Name | Angle Selector */}
      <div className={styles.headerSection}>
        <ClimbDetailHeader
          climb={currentClimb}
          boardDetails={boardDetails}
          angle={currentAngle}
          isAngleAdjustable={true}
        />
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

        {/* Floating Tick FAB - only when drawer is open */}
        {isOpen && (
          <div className={styles.tickFabContainer}>
            <button
              className={`${styles.tickFab} ${hasSuccessfulAscent ? styles.tickFabSuccess : ''}`}
              onClick={handleTickFabClick}
              aria-label="Log ascent"
            >
              <CheckOutlined className={styles.tickFabIcon} />
              {ascentCount > 0 && (
                <span className={styles.tickFabBadge}>{ascentCount}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Action bar - only rendered when drawer is open */}
      {isOpen && (
        <PlayViewActionBar
          canSwipePrevious={canSwipePrevious}
          canSwipeNext={canSwipeNext}
          isMirrored={isMirrored}
          supportsMirroring={!!boardDetails.supportsMirroring}
          isFavorited={isFavorited}
          remainingQueueCount={remainingQueueCount}
          onPrevClick={handlePrevNavClick}
          onNextClick={handleNextNavClick}
          onMirror={mirrorClimb}
          onToggleFavorite={toggleFavorite}
          onOpenActions={handleOpenActionsMenu}
          onOpenQueue={handleOpenQueueDrawer}
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
    isMirrored,
    isFavorited,
    remainingQueueCount,
    handlePrevNavClick,
    handleNextNavClick,
    mirrorClimb,
    toggleFavorite,
    handleOpenActionsMenu,
    handleOpenQueueDrawer,
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
      swipeEnabled={!isActionsOpen && !isQueueOpen && !isPlaylistSelectorOpen}
      showDragHandle={true}
      styles={{
        body: { padding: 0 },
        wrapper: { height: '100%', backgroundColor: 'var(--semantic-background)' },
      }}
    >
      {(contentReady || isOpen) ? (<>
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

        {/* Climb actions drawer — only mount when play drawer is open AND actions requested */}
        {isOpen && currentClimb && isActionsOpen && (
          <SwipeableDrawer
            title={<DrawerClimbHeader climb={currentClimb} boardDetails={boardDetails} />}
            placement="bottom"
            open={isActionsOpen}
            onClose={handleCloseActions}
            paperRef={actionsSwipe.paperRef}
            swipeEnabled={false}
            disablePortal
            styles={{
              wrapper: { height: 'auto' },
              body: { padding: `${themeTokens.spacing[2]}px 0` },
              header: { paddingLeft: `${themeTokens.spacing[3]}px`, paddingRight: `${themeTokens.spacing[3]}px` },
            }}
          >
            <ClimbActions
              climb={currentClimb}
              boardDetails={boardDetails}
              angle={currentAngle}
              currentPathname={pathname}
              viewMode="list"
              onOpenPlaylistSelector={() => {
                setIsActionsOpen(false);
                setIsPlaylistSelectorOpen(true);
              }}
              onActionComplete={handleCloseActions}
            />
          </SwipeableDrawer>
        )}

        {/* Playlist selector drawer — only mount when play drawer is open */}
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

        {/* Tick / Log Ascent drawer — only mount when play drawer is open */}
        {isOpen && currentClimb && isTickDrawerOpen && (
          <LogAscentDrawer
            open={isTickDrawerOpen}
            onClose={() => setIsTickDrawerOpen(false)}
            currentClimb={currentClimb}
            boardDetails={boardDetails}
          />
        )}
      </>) : null}

        {/* Queue list drawer — lazy-mounted on first open, unmounted after close animation */}
        {queueMounted && (
          <QueueDrawer
            open={isQueueOpen}
            onClose={handleCloseQueueDrawer}
            onTransitionEnd={handleQueueTransitionEnd}
            boardDetails={boardDetails}
            onClimbNavigate={handleQueueClimbNavigate}
          />
        )}
    </SwipeableDrawer>
    </>
  );
};

export default React.memo(PlayViewDrawer);

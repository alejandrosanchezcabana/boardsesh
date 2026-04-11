'use client';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import OpenInFullOutlined from '@mui/icons-material/OpenInFullOutlined';
import { track } from '@vercel/analytics';
import { useQueueActions, useCurrentClimb, useQueueList, useSessionData } from '../graphql-queue';
import NextClimbButton from './next-climb-button';
import { usePathname, useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { constructPlayUrlWithSlugs, getContextAwareClimbViewUrl, isNumericId, tryConstructSlugPlayUrl } from '@/app/lib/url-utils';
import { BoardRouteParameters, BoardDetails, Angle } from '@/app/lib/types';
import PreviousClimbButton from './previous-climb-button';
import QueueList, { QueueListHandle } from './queue-list';
import { TickButton } from '../logbook/tick-button';
import { QuickTickBar } from '../logbook/quick-tick-bar';
import ClimbThumbnail from '../climb-card/climb-thumbnail';
import ClimbTitle from '../climb-card/climb-title';
import { themeTokens } from '@/app/theme/theme-config';
import { TOUR_DRAWER_EVENT } from '../onboarding/onboarding-tour';
import { ShareBoardButton } from '../board-page/share-button';
import { useCardSwipeNavigation, EXIT_DURATION, SNAP_BACK_DURATION, ENTER_ANIMATION_DURATION } from '@/app/hooks/use-card-swipe-navigation';
import PlayViewDrawer from '../play-view/play-view-drawer';
import CircularProgress from '@mui/material/CircularProgress';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import { getGradeTintColor } from '@/app/lib/grade-colors';
import { useColorMode } from '@/app/hooks/use-color-mode';
import { ConfirmPopover } from '@/app/components/ui/confirm-popover';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import styles from './queue-control-bar.module.css';

export type ActiveDrawer = 'none' | 'play' | 'queue' | 'tick';

// Re-export the window event so existing imports from this file keep working.
// The actual definition lives in ./play-drawer-event to keep the import graph
// light for callsites that only need the dispatch helper.
export { PLAY_DRAWER_EVENT, dispatchOpenPlayDrawer } from './play-drawer-event';
import { PLAY_DRAWER_EVENT as PLAY_DRAWER_EVENT_INTERNAL } from './play-drawer-event';

const QUEUE_DRAWER_STYLES = { wrapper: { height: '70%' }, body: { padding: 0 } } as const;

export interface QueueControlBarProps {
  boardDetails: BoardDetails;
  angle: Angle;
}

const QueueControlBar: React.FC<QueueControlBarProps> = ({ boardDetails, angle }) => {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>('none');
  const pathname = usePathname();
  const params = useParams<BoardRouteParameters>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queueListRef = useRef<QueueListHandle>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enterFallbackRef = useRef<NodeJS.Timeout | null>(null);

  // Reset activeDrawer on navigation
  useEffect(() => {
    setActiveDrawer('none');
  }, [pathname]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (enterFallbackRef.current) {
        clearTimeout(enterFallbackRef.current);
      }
    };
  }, []);

  // Listen for tour events to open/close the queue drawer
  useEffect(() => {
    const handler = (e: Event) => {
      const { open } = (e as CustomEvent<{ open: boolean }>).detail;
      setActiveDrawer(open ? 'queue' : 'none');
    };
    window.addEventListener(TOUR_DRAWER_EVENT, handler);
    return () => window.removeEventListener(TOUR_DRAWER_EVENT, handler);
  }, []);

  // Listen for play drawer open requests from climb list items that live
  // outside this component's React tree (board page, liked list, queue
  // suggestions, queue items). Callers set the active climb before dispatching.
  useEffect(() => {
    const handler = () => setActiveDrawer('play');
    window.addEventListener(PLAY_DRAWER_EVENT_INTERNAL, handler);
    return () => window.removeEventListener(PLAY_DRAWER_EVENT_INTERNAL, handler);
  }, []);

  // Scroll to current climb when drawer finishes opening
  const handleDrawerOpenChange = useCallback((open: boolean) => {
    if (open) {
      scrollTimeoutRef.current = setTimeout(() => {
        queueListRef.current?.scrollToCurrentClimb();
      }, 100);
    }
  }, []);

  const handleCloseDrawer = useCallback(() => setActiveDrawer('none'), []);

  const isViewPage = pathname.includes('/view/');
  const isListPage = pathname.includes('/list');
  const isPlayPage = pathname.includes('/play/');
  const { currentClimb } = useCurrentClimb();
  const { queue } = useQueueList();
  const { viewOnlyMode, connectionState, sessionId, isDisconnected, users } = useSessionData();
  const {
    mirrorClimb,
    setQueue,
    getNextClimbQueueItem,
    getPreviousClimbQueueItem,
    setCurrentClimbQueueItem,
    endSession,
    disconnect,
  } = useQueueActions();
  const handleThumbnailClick = useCallback(() => {
    if (!currentClimb || viewOnlyMode) return;
    const currentQueueItem = queue.find((item) => item.climb.uuid === currentClimb.uuid);
    if (currentQueueItem) {
      setCurrentClimbQueueItem(currentQueueItem);
    }
    setActiveDrawer('play');
  }, [currentClimb, viewOnlyMode, queue, setCurrentClimbQueueItem]);

  const { showMessage } = useSnackbar();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [dismissedDisconnect, setDismissedDisconnect] = useState(false);

  // Tick-bar comment state lives here so the comment field can render in a
  // separate bar *above* the queue control bar without reflowing the main bar.
  // QuickTickBar reads the value back out via props when saving the tick.
  const [tickComment, setTickComment] = useState('');
  const [tickCommentOpen, setTickCommentOpen] = useState(false);
  const [tickCommentFocused, setTickCommentFocused] = useState(false);
  const handleTickCommentToggle = useCallback(() => setTickCommentOpen((prev) => !prev), []);
  const handleTickCommentFocus = useCallback(() => setTickCommentFocused(true), []);
  const handleTickCommentBlur = useCallback(() => setTickCommentFocused(false), []);

  // Transient "swipe left to dismiss" hint that floats above the queue
  // control bar whenever the tick bar opens. Visible for 3s then fades out.
  const [swipeHintVisible, setSwipeHintVisible] = useState(false);

  // Note: the tick bar intentionally stays open when the active climb changes
  // (e.g. party session navigation). QuickTickBar snapshots its target climb
  // internally so the user can finish ticking the climb they opened the bar
  // for, even after someone else advances the queue.

  // Reset dismissed state when connection is restored so banner reappears on next disconnect
  useEffect(() => {
    if (!isDisconnected) {
      setDismissedDisconnect(false);
    }
  }, [isDisconnected]);

  const { mode } = useColorMode();
  const isDark = mode === 'dark';
  const gradeTintColor = useMemo(() => getGradeTintColor(currentClimb?.difficulty, 'default', isDark), [currentClimb?.difficulty, isDark]);

  // Show reconnecting UI only when online but WebSocket is down.
  // When truly offline (browser has no network), show normal controls with an offline indicator instead.
  const isReconnecting = !!sessionId && !isDisconnected && (connectionState === 'reconnecting' || connectionState === 'stale' || connectionState === 'error');

  const nextClimb = useMemo(() => getNextClimbQueueItem(), [getNextClimbQueueItem, queue, currentClimb]);
  const previousClimb = useMemo(() => getPreviousClimbQueueItem(), [getPreviousClimbQueueItem, queue, currentClimb]);
  const shouldNavigate = isViewPage || isPlayPage;

  // Build URL for a climb item (for navigation on view/play pages)
  const buildClimbUrl = useCallback((climb: { uuid: string; name: string }) => {
    let climbUrl: string | null = null;

    if (isPlayPage) {
      if (boardDetails?.layout_name && boardDetails?.size_name && boardDetails?.set_names) {
        climbUrl = constructPlayUrlWithSlugs(
          boardDetails.board_name,
          boardDetails.layout_name,
          boardDetails.size_name,
          boardDetails.size_description,
          boardDetails.set_names,
          angle,
          climb.uuid,
          climb.name,
        );
      } else if (params.board_name) {
        const numericFallback = `/${params.board_name}/${params.layout_id}/${params.size_id}/${params.set_ids}/${params.angle}/play/${climb.uuid}`;
        climbUrl = isNumericId(params.layout_id)
          ? tryConstructSlugPlayUrl(
              params.board_name, Number(params.layout_id), Number(params.size_id),
              decodeURIComponent(params.set_ids).split(',').map(Number),
              angle, climb.uuid, climb.name,
            ) ?? numericFallback
          : numericFallback;
      } else {
        climbUrl = null;
      }
    } else {
      climbUrl = getContextAwareClimbViewUrl(
        pathname,
        boardDetails,
        angle,
        climb.uuid,
        climb.name,
      );
    }

    if (!climbUrl) return null;

    // Preserve search params in play mode
    if (isPlayPage) {
      const queryString = searchParams.toString();
      if (queryString) {
        climbUrl = `${climbUrl}?${queryString}`;
      }
    }
    return climbUrl;
  }, [pathname, boardDetails, angle, params, searchParams, isPlayPage]);

  // Handle swipe navigation
  const handleSwipeNext = useCallback(() => {
    if (!nextClimb || viewOnlyMode) return;

    setCurrentClimbQueueItem(nextClimb);
    track('Queue Navigation', {
      direction: 'next',
      method: 'swipe',
      boardLayout: boardDetails?.layout_name || '',
    });

    if (shouldNavigate) {
      const url = buildClimbUrl(nextClimb.climb);
      if (url) {
        if (isPlayPage) {
          window.history.pushState(null, '', url);
        } else {
          router.push(url);
        }
      }
    }
  }, [nextClimb, viewOnlyMode, setCurrentClimbQueueItem, shouldNavigate, router, buildClimbUrl, boardDetails, isPlayPage]);

  const handleSwipePrevious = useCallback(() => {
    if (!previousClimb || viewOnlyMode) return;

    setCurrentClimbQueueItem(previousClimb);
    track('Queue Navigation', {
      direction: 'previous',
      method: 'swipe',
      boardLayout: boardDetails?.layout_name || '',
    });

    if (shouldNavigate) {
      const url = buildClimbUrl(previousClimb.climb);
      if (url) {
        if (isPlayPage) {
          window.history.pushState(null, '', url);
        } else {
          router.push(url);
        }
      }
    }
  }, [previousClimb, viewOnlyMode, setCurrentClimbQueueItem, shouldNavigate, router, buildClimbUrl, boardDetails, isPlayPage]);

  const tickBarActive = activeDrawer === 'tick';
  const canSwipeNext = !viewOnlyMode && !!nextClimb && !tickBarActive;
  const canSwipePrevious = !viewOnlyMode && !!previousClimb && !tickBarActive;

  // Clear tick-bar comment state whenever the tick bar closes so a fresh
  // activation always starts empty.
  useEffect(() => {
    if (!tickBarActive) {
      setTickComment('');
      setTickCommentOpen(false);
      setTickCommentFocused(false);
    }
  }, [tickBarActive]);

  // Show the swipe hint every time the tick bar opens, then auto-fade it
  // after 3 seconds so it stays out of the user's way.
  useEffect(() => {
    if (!tickBarActive) {
      setSwipeHintVisible(false);
      return;
    }
    setSwipeHintVisible(true);
    const timer = setTimeout(() => setSwipeHintVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [tickBarActive]);

  const { swipeHandlers, swipeOffset, isAnimating, animationDirection, enterDirection, clearEnterAnimation } = useCardSwipeNavigation({
    onSwipeNext: handleSwipeNext,
    onSwipePrevious: handleSwipePrevious,
    canSwipeNext,
    canSwipePrevious,
    threshold: 80,
    delayNavigation: true,
  });

  const playUrl = useMemo(() => {
    if (!currentClimb) return null;

    const { layout_name, size_name, size_description, set_names, board_name } = boardDetails;

    let baseUrl: string | null;
    if (layout_name && size_name && set_names) {
      baseUrl = constructPlayUrlWithSlugs(
        board_name,
        layout_name,
        size_name,
        size_description,
        set_names,
        angle,
        currentClimb.uuid,
        currentClimb.name,
      );
    } else if (params.board_name) {
      const numericFallback = `/${params.board_name}/${params.layout_id}/${params.size_id}/${params.set_ids}/${params.angle}/play/${currentClimb.uuid}`;
      baseUrl = isNumericId(params.layout_id)
        ? tryConstructSlugPlayUrl(
            params.board_name, Number(params.layout_id), Number(params.size_id),
            decodeURIComponent(params.set_ids).split(',').map(Number),
            angle, currentClimb.uuid, currentClimb.name,
          ) ?? numericFallback
        : numericFallback;
    } else {
      return null;
    }

    const queryString = searchParams.toString();
    if (queryString) {
      return `${baseUrl}?${queryString}`;
    }
    return baseUrl;
  }, [currentClimb, boardDetails, angle, params, searchParams]);

  const handleClearQueue = () => {
    setQueue([]);
    track('Queue Cleared', {
      boardLayout: boardDetails.layout_name || '',
      itemsCleared: queue.length,
    });
  };

  const handleClimbInfoClick = useCallback(() => {
    if (!currentClimb) return;
    setActiveDrawer('play');
    track('Play Drawer Opened', {
      boardLayout: boardDetails.layout_name || '',
      source: 'bar_tap',
    });
  }, [currentClimb, boardDetails.layout_name]);

  // Transition style shared by current and peek text
  const getTextTransitionStyle = () => {
    // After navigation completes, snap instantly (no transition) to avoid
    // the new text sliding in from the old exit position
    if (enterDirection) return 'none';
    if (isAnimating) return `transform ${EXIT_DURATION}ms ease-out`;
    if (swipeOffset === 0) return `transform ${SNAP_BACK_DURATION}ms ease`;
    return 'none';
  };

  // Peek: determine which climb to preview during swipe
  const showPeek = swipeOffset !== 0 || isAnimating;
  const peekIsNext = animationDirection === 'left' || (animationDirection === null && swipeOffset < 0);
  const peekClimbData = peekIsNext ? nextClimb?.climb : previousClimb?.climb;

  // Peek transform: positioned one container-width away, moves with swipeOffset.
  // Clamped so the peek stops at position 0 and never overshoots past it
  // (the exit offset is window.innerWidth which is wider than the clip container).
  const getPeekTransform = () => {
    return peekIsNext
      ? `translateX(max(0px, calc(100% + ${swipeOffset}px)))`
      : `translateX(min(0px, calc(-100% + ${swipeOffset}px)))`;
  };

  const reconnectMessage = connectionState === 'error' ? 'Connection error – retrying…' : 'Reconnecting…';

  const handleLeaveSession = useCallback(() => {
    if (endSession) {
      endSession();
      return;
    }
    if (disconnect) {
      disconnect();
    } else {
      showMessage('Unable to leave session. Please try again.', 'warning');
    }
  }, [endSession, disconnect]);

  // Reconnect-only view helpers
  const renderReconnectingRow = () => (
    <div className={styles.reconnectRow}>
      <CircularProgress size={16} thickness={5} />
      <span>{reconnectMessage}</span>
      <MuiButton variant="text" size="small" onClick={() => setShowCancelConfirm(true)}>Cancel</MuiButton>
    </div>
  );

  const renderConfirmRow = () => (
    <div className={styles.reconnectRow}>
      <span className={styles.confirmText}>Cancelling will leave the session. Is that what you want?</span>
      <IconButton aria-label="Leave session" color="error" onClick={() => { handleLeaveSession(); setShowCancelConfirm(false); }}>
        <CloseOutlined />
      </IconButton>
      <IconButton aria-label="Keep reconnecting" onClick={() => setShowCancelConfirm(false)}>
        <CheckOutlined />
      </IconButton>
    </div>
  );

  useEffect(() => {
    if (!isReconnecting) {
      setShowCancelConfirm(false);
    }
  }, [isReconnecting]);

  // Clear enterDirection (for thumbnail crossfade) after it plays
  useEffect(() => {
    if (enterDirection) {
      enterFallbackRef.current = setTimeout(() => {
        clearEnterAnimation();
      }, ENTER_ANIMATION_DURATION);
    }
    return () => {
      if (enterFallbackRef.current) {
        clearTimeout(enterFallbackRef.current);
        enterFallbackRef.current = null;
      }
    };
  }, [enterDirection, clearEnterAnimation]);

  const reconnectView = (
    <MuiCard variant="outlined" className={styles.card} sx={{ border: 'none', backgroundColor: 'transparent' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <div className={styles.swipeWrapper}>
          <div
            className={styles.swipeContainer}
            style={{
              padding: `${themeTokens.spacing[2]}px ${themeTokens.spacing[3]}px`,
              backgroundColor: gradeTintColor ?? (isDark ? 'transparent' : 'var(--semantic-surface)'),
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center' }} className={styles.row}>
              <Box sx={{ flex: 1 }} className={styles.climbInfoCol}>
                <div className={styles.climbInfoInner} style={{ gap: themeTokens.spacing[2] }}>
                  <div className={`${styles.boardPreviewContainer} ${enterDirection ? styles.thumbnailEnter : ''}`}>
                    <ClimbThumbnail
                      boardDetails={boardDetails}
                      currentClimb={currentClimb}
                      pathname={pathname}
                      onClick={handleThumbnailClick}
                    />
                  </div>

                  {/* Reconnect UI sits where the title normally lives */}
                  <div className={styles.textSwipeClip}>
                    {showCancelConfirm ? renderConfirmRow() : renderReconnectingRow()}
                  </div>
                </div>
              </Box>
            </Box>
          </div>
        </div>
      </CardContent>
    </MuiCard>
  );

  if (isReconnecting) {
    return (
      <div id="onboarding-queue-bar" className={`queue-bar-shadow ${styles.queueBar}`} data-testid="queue-control-bar">
        {reconnectView}
      </div>
    );
  }

  return (
    <div id="onboarding-queue-bar" className={`queue-bar-shadow ${styles.queueBar}`} data-testid="queue-control-bar">
      {/* Offline indicator */}
      {isDisconnected && !dismissedDisconnect && (
        <div
          className={styles.offlineBanner}
          onClick={() => setDismissedDisconnect(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDismissedDisconnect(true); } }}
        >
          <CloudOffOutlined sx={{ fontSize: 'body2.fontSize', flexShrink: 0 }} />
          <span className={styles.offlineBannerText}>
            {sessionId
              ? users && users.length > 1
                ? 'Offline. Queued climbs will still sync.'
                : 'Offline. Changes will sync when you reconnect.'
              : 'Offline'}
          </span>
        </div>
      )}
      {/* Transient "swipe left to dismiss" hint — floats above the queue
          control bar the first 3 seconds after tick mode opens, then fades
          away so it doesn't interfere with the stars or action buttons. */}
      {tickBarActive && (
        <div
          className={`${styles.swipeHint} ${swipeHintVisible ? styles.swipeHintVisible : ''}`}
          aria-hidden="true"
          data-testid="quick-tick-swipe-hint"
        >
          swipe left to dismiss
        </div>
      )}
      {/* Tick-mode comment bar — rendered above the main card so tapping the
          comment button doesn't reflow the queue control bar. */}
      {tickBarActive && tickCommentOpen && (
        <div className={styles.commentBar}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            variant="standard"
            placeholder="Comment..."
            value={tickComment}
            onChange={(e) => setTickComment(e.target.value)}
            onFocus={handleTickCommentFocus}
            onBlur={handleTickCommentBlur}
            slotProps={{ htmlInput: { maxLength: 2000, 'aria-label': 'Tick comment' } }}
          />
        </div>
      )}
      {/* Main Control Bar */}
      <MuiCard variant="outlined" className={styles.card} sx={{ border: 'none', backgroundColor: 'transparent' }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* Swipe container - captures swipe gestures, does NOT translate */}
        <div className={styles.swipeWrapper}>
          <div
            {...swipeHandlers}
            className={styles.swipeContainer}
            style={{
              padding: `${themeTokens.spacing[2]}px ${themeTokens.spacing[3]}px`,
              backgroundColor: gradeTintColor ?? (isDark ? 'transparent' : 'var(--semantic-surface)'),
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'center' }} className={styles.row}>
              {/* Left section: Thumbnail and climb info */}
              <Box sx={{ flex: 1 }} className={styles.climbInfoCol}>
                <div className={styles.climbInfoInner} style={{ gap: themeTokens.spacing[2] }}>
                  {/* Board preview — STATIC, with crossfade on enter */}
                  <div className={`${styles.boardPreviewContainer} ${enterDirection ? styles.thumbnailEnter : ''}`}>
                    <ClimbThumbnail
                      boardDetails={boardDetails}
                      currentClimb={currentClimb}
                      pathname={pathname}
                      onClick={handleThumbnailClick}
                    />
                  </div>

                  {/* Text swipe clip — overflow hidden to contain sliding text */}
                  <div className={styles.textSwipeClip}>
                    {tickBarActive ? (
                      <QuickTickBar
                        currentClimb={currentClimb}
                        angle={angle}
                        boardDetails={boardDetails}
                        onSave={() => setActiveDrawer('none')}
                        onCancel={() => setActiveDrawer('none')}
                        comment={tickComment}
                        commentOpen={tickCommentOpen}
                        onCommentToggle={handleTickCommentToggle}
                        commentFocused={tickCommentFocused}
                      />
                    ) : (
                      <>
                        {/* Current climb text — slides with finger */}
                        <div
                          id="onboarding-queue-toggle"
                          onClick={handleClimbInfoClick}
                          className={`${styles.queueToggle} ${isListPage ? styles.listPage : ''}`}
                          style={{
                            transform: `translateX(${swipeOffset}px)`,
                            transition: getTextTransitionStyle(),
                          }}
                        >
                          <ClimbTitle
                            climb={currentClimb}
                            gradePosition="right"
                            showSetterInfo
                          />
                        </div>

                        {/* Peek text — shows next/previous climb sliding in from the edge */}
                        {showPeek && peekClimbData && (
                          <div
                            className={`${styles.queueToggle} ${styles.peekText}`}
                            style={{
                              transform: getPeekTransform(),
                              transition: getTextTransitionStyle(),
                            }}
                          >
                            <ClimbTitle
                              climb={peekClimbData}
                              gradePosition="right"
                              showSetterInfo
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Box>

              {/* Button cluster — hidden when tick bar is active to give full width */}
              {!tickBarActive && (
              <Box sx={{ flex: 'none', marginLeft: `${themeTokens.spacing[1]}px` }}>
                <Stack direction="row" spacing={0.5}>
                  {/* Mirror button - desktop only */}
                  {boardDetails.supportsMirroring ? (
                    <span className={styles.desktopOnly}>
                      <IconButton
                        id="button-mirror"
                        onClick={() => {
                          mirrorClimb();
                          track('Mirror Climb Toggled', {
                            boardLayout: boardDetails.layout_name || '',
                            mirrored: !currentClimb?.mirrored,
                          });
                        }}
                        color={currentClimb?.mirrored ? 'primary' : 'default'}
                        sx={
                          currentClimb?.mirrored
                            ? { backgroundColor: themeTokens.colors.purple, borderColor: themeTokens.colors.purple, color: 'common.white', '&:hover': { backgroundColor: themeTokens.colors.purple } }
                            : undefined
                        }
                      >
                        <SyncOutlined />
                      </IconButton>
                    </span>
                  ) : null}
                  {/* Play link - desktop only */}
                  {!isPlayPage && playUrl && (
                    <span className={styles.desktopOnly}>
                      <Link
                        href={playUrl}
                        onClick={() => {
                          track('Play Mode Entered', {
                            boardLayout: boardDetails.layout_name || '',
                          });
                        }}
                      >
                        <IconButton aria-label="Enter play mode"><OpenInFullOutlined /></IconButton>
                      </Link>
                    </span>
                  )}
                  {/* Navigation buttons - desktop only */}
                  <span className={styles.navButtons}>
                    <Stack direction="row" spacing={0.5}>
                      <PreviousClimbButton navigate={isViewPage || isPlayPage} boardDetails={boardDetails} />
                      <NextClimbButton navigate={isViewPage || isPlayPage} boardDetails={boardDetails} />
                    </Stack>
                  </span>
                  {/* Party button */}
                  <ShareBoardButton />
                  {/* Tick button */}
                  <TickButton
                    currentClimb={currentClimb}
                    angle={angle}
                    boardDetails={boardDetails}
                    onActivateTickBar={() => setActiveDrawer('tick')}
                    tickBarActive={tickBarActive}
                  />
                </Stack>
              </Box>
              )}
            </Box>
          </div>
        </div>
        </CardContent>
      </MuiCard>

      {/* Drawer for showing the queue */}
      <SwipeableDrawer
        title="Queue"
        placement="bottom"
        open={activeDrawer === 'queue'}
        onClose={handleCloseDrawer}
        onTransitionEnd={handleDrawerOpenChange}
        styles={QUEUE_DRAWER_STYLES}
        extra={
          queue.length > 0 && (
            <ConfirmPopover
              title="Clear queue"
              description="Are you sure you want to clear all items from the queue?"
              onConfirm={handleClearQueue}
              okText="Clear"
              cancelText="Cancel"
            >
              <MuiButton variant="text" startIcon={<DeleteOutlined />} sx={{ color: 'var(--neutral-400)' }}>
                Clear
              </MuiButton>
            </ConfirmPopover>
          )
        }
      >
        <QueueList ref={queueListRef} boardDetails={boardDetails} active={activeDrawer === 'queue'} />
      </SwipeableDrawer>

      <PlayViewDrawer
        activeDrawer={activeDrawer}
        setActiveDrawer={setActiveDrawer}
        boardDetails={boardDetails}
        angle={angle}
      />
    </div>
  );
};

export default React.memo(QueueControlBar);

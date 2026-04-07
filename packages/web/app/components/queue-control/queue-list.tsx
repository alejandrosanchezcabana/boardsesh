'use client';
import React, { useEffect, useState, useCallback, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiDivider from '@mui/material/Divider';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import { useQueueActions, useCurrentClimbUuid, useQueueList, useSearchData, useSessionData } from '../graphql-queue';
import { Climb, BoardDetails } from '@/app/lib/types';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';
import { usePathname } from 'next/navigation';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import QueueClimbListItem from './queue-climb-list-item';
import ClimbListItem from '../climb-card/climb-list-item';
import DrawerClimbHeader from '../climb-card/drawer-climb-header';
import { ClimbActions } from '../climb-actions';
import PlaylistSelectionContent from '../climb-actions/playlist-selection-content';
import { getExcludedClimbActions } from '@/app/lib/climb-action-utils';
import { themeTokens } from '@/app/theme/theme-config';
import { useOptionalBoardProvider } from '../board-provider/board-provider-context';
import { LogAscentDrawer } from '../logbook/log-ascent-drawer';
import { useAuthModal } from '@/app/components/providers/auth-modal-provider';
import styles from './queue-list.module.css';


export type QueueListHandle = {
  scrollToCurrentClimb: () => void;
};

type QueueListProps = {
  boardDetails: BoardDetails;
  onClimbNavigate?: () => void;
  isEditMode?: boolean;
  showHistory?: boolean;
  selectedItems?: Set<string>;
  onToggleSelect?: (uuid: string) => void;
  scrollContainer?: HTMLElement | null;
  /** When false, suggested climbs and infinite scroll are not rendered.
   *  Use this when QueueList is inside a closed keepMounted drawer. */
  active?: boolean;
};

const QueueList = forwardRef<QueueListHandle, QueueListProps>(({ boardDetails, onClimbNavigate, isEditMode = false, showHistory = false, selectedItems, onToggleSelect, scrollContainer, active = true }, ref) => {
  const currentClimbUuid = useCurrentClimbUuid();
  const { queue, suggestedClimbs } = useQueueList();
  const { hasMoreResults, isFetchingClimbs, isFetchingNextPage } = useSearchData();
  const { viewOnlyMode } = useSessionData();
  const {
    setCurrentClimbQueueItem,
    setQueue,
    addToQueue,
  } = useQueueActions();
  const pathname = usePathname();
  const isDark = useIsDarkMode();

  const isAuthenticated = useOptionalBoardProvider()?.isAuthenticated ?? false;

  // Tick drawer state
  const [tickDrawerVisible, setTickDrawerVisible] = useState(false);
  const [tickClimb, setTickClimb] = useState<Climb | null>(null);
  const { openAuthModal } = useAuthModal();

  // Shared drawer state — one actions drawer and one playlist drawer for all items.
  // This replaces the per-ClimbListItem drawers (previously 100+ drawer trees).
  const [actionsClimb, setActionsClimb] = useState<Climb | null>(null);
  const [playlistClimb, setPlaylistClimb] = useState<Climb | null>(null);

  const handleOpenActions = useCallback((climb: Climb) => {
    setPlaylistClimb(null);
    setActionsClimb(climb);
  }, []);
  const handleOpenPlaylistSelector = useCallback((climb: Climb) => {
    setActionsClimb(null);
    setPlaylistClimb(climb);
  }, []);
  const handleCloseActions = useCallback(() => setActionsClimb(null), []);
  const handleOpenPlaylistFromActions = useCallback(() => {
    setActionsClimb(null);
    setPlaylistClimb(actionsClimb);
  }, [actionsClimb]);
  const handleClosePlaylist = useCallback(() => setPlaylistClimb(null), []);

  // Stabilize onClimbNavigate via ref to prevent suggested ClimbListItems from
  // re-rendering when the parent passes a new function reference.
  const onClimbNavigateRef = useRef(onClimbNavigate);
  onClimbNavigateRef.current = onClimbNavigate;
  const stableOnClimbNavigate = useCallback(() => {
    onClimbNavigateRef.current?.();
  }, []);

  const excludeActions = useMemo(
    () => getExcludedClimbActions(boardDetails.board_name, 'list'),
    [boardDetails.board_name],
  );

  // Ref for scrolling to position that shows only 2 history items above current
  const scrollTargetRef = useRef<HTMLDivElement>(null);

  // Expose scroll method to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToCurrentClimb: () => {
      if (scrollTargetRef.current) {
        scrollTargetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  }));

  const handleTickClick = useCallback((climb: Climb) => {
    setTickClimb(climb);
    setTickDrawerVisible(true);
  }, []);

  const closeTickDrawer = useCallback(() => {
    setTickDrawerVisible(false);
    setTickClimb(null);
  }, []);

  // Monitor for drag-and-drop events
  useEffect(() => {
    if (isEditMode) return;

    const cleanup = monitorForElements({
      onDrop({ location, source }) {
        const target = location.current.dropTargets[0];
        if (!target) return;

        const sourceIndex = Number(source.data.index);
        const targetIndex = Number(target.data.index);

        if (isNaN(sourceIndex) || isNaN(targetIndex)) return;

        const edge = extractClosestEdge(target.data);
        let finalIndex = edge === 'bottom' ? targetIndex + 1 : targetIndex;

        // Adjust for the fact that removing the source item shifts indices
        if (sourceIndex < finalIndex) {
          finalIndex = finalIndex - 1;
        }

        const newQueue = reorder({
          list: queue,
          startIndex: sourceIndex,
          finishIndex: finalIndex,
        });

        setQueue(newQueue);
      },
    });

    return cleanup; // Cleanup listener on component unmount
  }, [queue, setQueue, isEditMode]);

  // No infinite scroll here — QueueContext's proactive fetch handles loading
  // more suggestions when they run low.

  // Find the index of the current climb in the queue
  const currentIndex = queue.findIndex((item) => item.uuid === currentClimbUuid);
  const currentItem = currentIndex >= 0 ? queue[currentIndex] : null;

  // Split queue into history (past), current, and future items
  // Rendered in Spotify-like order: history (oldest to newest) → current → future
  const historyItems = currentIndex > 0 ? queue.slice(0, currentIndex) : [];
  // When no current climb (currentIndex === -1), show entire queue as future items
  const futureItems = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;

  // Calculate which history item to scroll to:
  // Show only 2 history items above current, so scroll target is at index (length - 2)
  const scrollToHistoryIndex = historyItems.length > 2 ? historyItems.length - 2 : 0;

  // Memoize suggested item title props — match queue item layout (grade on right)
  const suggestedTitleProps = useMemo(
    () => ({ gradePosition: 'right' as const, showSetterInfo: true, titleFontSize: themeTokens.typography.fontSize.xl }),
    [],
  );

  const loadMoreContainerStyle = useMemo(
    () => ({
      minHeight: themeTokens.spacing[5],
      marginTop: themeTokens.spacing[2],
    }),
    [],
  );

  const loadMoreSkeletonStyle = useMemo(
    () => ({
      gap: `${themeTokens.spacing[2]}px`,
      padding: `${themeTokens.spacing[2]}px`,
    }),
    [],
  );

  // Virtualizer for suggested climbs — only mounts items in/near the viewport
  const suggestedVirtualizer = useVirtualizer({
    count: suggestedClimbs.length,
    getScrollElement: () => scrollContainer ?? null,
    estimateSize: () => 102,
    overscan: 15,
    getItemKey: (index) => suggestedClimbs[index]?.uuid ?? index,
  });

  const suggestedVirtualItems = suggestedVirtualizer.getVirtualItems();

  return (
    <>
      <div className={styles.queueColumn}>
        {/* History items (oldest to newest at top) - only shown when showHistory is true */}
        {showHistory && historyItems.length > 0 && (
          <>
            {historyItems.map((climbQueueItem, index) => {
              // Calculate original queue index for drag-and-drop
              // historyItems = queue.slice(0, currentIndex), so original index equals map index
              const originalIndex = index;
              // Add scroll target ref at the position that shows only 2 history items
              const isScrollTarget = historyItems.length > 2 && index === scrollToHistoryIndex;

              return (
                <div key={climbQueueItem.uuid} ref={isScrollTarget ? scrollTargetRef : undefined}>
                  <QueueClimbListItem
                    item={climbQueueItem}
                    index={originalIndex}
                    isCurrent={false}
                    isHistory={true}
                    boardDetails={boardDetails}
                    pathname={pathname}
                    isDark={isDark}
                    setCurrentClimbQueueItem={setCurrentClimbQueueItem}
                    onTickClick={handleTickClick}
                    onOpenActions={handleOpenActions}
                    onOpenPlaylistSelector={handleOpenPlaylistSelector}
                    isEditMode={isEditMode}
                    isSelected={selectedItems?.has(climbQueueItem.uuid) ?? false}
                    onToggleSelect={onToggleSelect}
                  />
                </div>
              );
            })}
            <MuiDivider className={styles.historyDivider} />
          </>
        )}

        {/* Current climb item */}
        {currentItem && (
          <div key={currentItem.uuid} ref={!showHistory || historyItems.length <= 2 ? scrollTargetRef : undefined}>
            <QueueClimbListItem
              item={currentItem}
              index={currentIndex}
              isCurrent={true}
              isHistory={false}
              boardDetails={boardDetails}
              pathname={pathname}
              isDark={isDark}
              setCurrentClimbQueueItem={setCurrentClimbQueueItem}
              onTickClick={handleTickClick}
              onOpenActions={handleOpenActions}
              onOpenPlaylistSelector={handleOpenPlaylistSelector}
              isEditMode={isEditMode}
              isSelected={selectedItems?.has(currentItem.uuid) ?? false}
              onToggleSelect={onToggleSelect}
            />
          </div>
        )}

        {/* Future items (after current) */}
        {futureItems.map((climbQueueItem, index) => {
          // Calculate original index: future items start after current climb
          const originalIndex = currentIndex >= 0 ? currentIndex + 1 + index : index;
          // Attach scroll target to first future item if there's no current climb
          // and history has 2 or fewer items (scrollTargetRef wouldn't be attached elsewhere)
          const isScrollTarget = index === 0 && !currentItem && (!showHistory || historyItems.length <= 2);

          return (
            <div key={climbQueueItem.uuid} ref={isScrollTarget ? scrollTargetRef : undefined}>
              <QueueClimbListItem
                item={climbQueueItem}
                index={originalIndex}
                isCurrent={false}
                isHistory={false}
                boardDetails={boardDetails}
                pathname={pathname}
                isDark={isDark}
                setCurrentClimbQueueItem={setCurrentClimbQueueItem}
                onTickClick={handleTickClick}
                onOpenActions={handleOpenActions}
                onOpenPlaylistSelector={handleOpenPlaylistSelector}
                isEditMode={isEditMode}
                isSelected={selectedItems?.has(climbQueueItem.uuid) ?? false}
                onToggleSelect={onToggleSelect}
              />
            </div>
          );
        })}
      </div>
      {active && !viewOnlyMode && (
        <>
          <div className={styles.suggestedSectionHeader}>
            <Typography variant="overline" color="text.secondary">
              Suggestions
            </Typography>
          </div>
          <div
            className={styles.suggestedColumn}
            style={{
              height: suggestedVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {suggestedVirtualizer.getVirtualItems().map((virtualItem) => {
              const climb = suggestedClimbs[virtualItem.index];
              if (!climb) return null;
              return (
                <div
                  key={virtualItem.key}
                  ref={suggestedVirtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    contain: 'layout style paint',
                  }}
                >
                  <ClimbListItem
                    climb={climb}
                    boardDetails={boardDetails}
                    pathname={pathname}
                    isDark={isDark}
                    titleProps={suggestedTitleProps}
                    onNavigate={stableOnClimbNavigate}
                    onOpenActions={handleOpenActions}
                    onOpenPlaylistSelector={handleOpenPlaylistSelector}
                    addToQueue={addToQueue}
                  />
                </div>
              );
            })}
          </div>
          {(suggestedClimbs.length > 0 || isFetchingClimbs || isFetchingNextPage) && (
            <div
              style={loadMoreContainerStyle}
            >
              {(isFetchingClimbs || isFetchingNextPage) && (
                <div
                  className={styles.loadMoreContainer}
                  style={loadMoreSkeletonStyle}
                >
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.loadMoreSkeletonRow}>
                      <Skeleton variant="rectangular" width={64} height={60} animation="wave" sx={{ flexShrink: 0 }} />
                      <Skeleton variant="text" animation="wave" sx={{ flex: 1 }} />
                      <Skeleton variant="rectangular" width={32} height={32} animation="wave" sx={{ flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )}
              {!hasMoreResults && !isFetchingClimbs && suggestedClimbs.length > 0 && (
                <div className={styles.noMoreSuggestions}>
                  <Typography variant="body2" color="text.disabled">
                    That's all for now
                  </Typography>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Tick drawer - now works with just NextAuth authentication */}
      {isAuthenticated ? (
        <LogAscentDrawer
          open={tickDrawerVisible}
          onClose={closeTickDrawer}
          currentClimb={tickClimb}
          boardDetails={boardDetails}
        />
      ) : (
        <SwipeableDrawer
          title="Sign In Required"
          placement="bottom"
          onClose={closeTickDrawer}
          open={tickDrawerVisible}
          styles={{ wrapper: { height: '50%' } }}
        >
          <Stack spacing={3} sx={{ width: '100%', textAlign: 'center', padding: `${themeTokens.spacing[6]}px 0` }}>
            <Typography variant="body2" component="span" fontWeight={600} sx={{ fontSize: themeTokens.typography.fontSize.base }}>Sign in to record ticks</Typography>
            <Typography variant="body1" component="p" color="text.secondary">
              Create a Boardsesh account to log your climbs and track your progress.
            </Typography>
            <Button variant="contained" startIcon={<LoginOutlined />} onClick={() => openAuthModal({ title: 'Sign in to record ticks', description: 'Create an account to log your climbs and track your progress.' })} fullWidth>
              Sign In
            </Button>
          </Stack>
        </SwipeableDrawer>
      )}

      {/* Shared actions drawer — only mount when a climb's actions are open */}
      {actionsClimb && (
        <SwipeableDrawer
          title={<DrawerClimbHeader climb={actionsClimb} boardDetails={boardDetails} />}
          placement="bottom"
          open
          onClose={handleCloseActions}
          styles={actionsDrawerStyles}
        >
          <ClimbActions
            climb={actionsClimb}
            boardDetails={boardDetails}
            angle={actionsClimb.angle}
            currentPathname={pathname}
            viewMode="list"
            exclude={excludeActions}
            onOpenPlaylistSelector={handleOpenPlaylistFromActions}
            onActionComplete={handleCloseActions}
          />
        </SwipeableDrawer>
      )}

      {/* Shared playlist selector drawer — only mount when a climb's playlist is open */}
      {playlistClimb && (
        <SwipeableDrawer
          title={<DrawerClimbHeader climb={playlistClimb} boardDetails={boardDetails} />}
          placement="bottom"
          open
          onClose={handleClosePlaylist}
          styles={playlistDrawerStyles}
        >
          <PlaylistSelectionContent
            climbUuid={playlistClimb.uuid}
            boardDetails={boardDetails}
            angle={playlistClimb.angle}
            onDone={handleClosePlaylist}
          />
        </SwipeableDrawer>
      )}

    </>
  );
});

// Static drawer styles — hoisted to avoid per-render allocation
const actionsDrawerStyles = {
  wrapper: { height: 'auto', width: '100%' },
  body: { padding: `${themeTokens.spacing[2]}px 0` },
  header: { paddingLeft: `${themeTokens.spacing[3]}px`, paddingRight: `${themeTokens.spacing[3]}px` },
} as const;

const playlistDrawerStyles = {
  wrapper: { height: 'auto', maxHeight: '70vh', width: '100%' },
  body: { padding: 0 },
  header: { paddingLeft: `${themeTokens.spacing[3]}px`, paddingRight: `${themeTokens.spacing[3]}px` },
} as const;

QueueList.displayName = 'QueueList';

export default React.memo(QueueList);

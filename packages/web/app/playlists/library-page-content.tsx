'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MuiButton from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import { AddOutlined, LabelOutlined, LoginOutlined, SentimentDissatisfiedOutlined } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { useLocaleRouter } from '@/app/lib/i18n/use-locale-router';
import { executeGraphQL } from '@/app/lib/graphql/client';
import {
  type GetAllUserPlaylistsQueryResponse,
  type GetAllUserPlaylistsInput,
  type DiscoverPlaylistsQueryResponse,
  type DiscoverPlaylistsInput,
  type Playlist,
  type DiscoverablePlaylist,
  GET_ALL_USER_PLAYLISTS,
  DISCOVER_PLAYLISTS,
} from '@/app/lib/graphql/operations/playlists';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { useMyBoards } from '@/app/hooks/use-my-boards';
import { useQueueBridgeBoardInfo } from '@/app/components/queue-control/queue-bridge-context';
import { constructBoardSlugPlaylistsUrl } from '@/app/lib/url-utils';
import { findMatchingBoard } from '@/app/lib/find-matching-board';
import { deriveIsAuthenticated } from '@/app/lib/derive-auth-status';
import type { UserBoard, PopularBoardConfig } from '@boardsesh/shared-schema';
import { useAuthModal } from '@/app/components/providers/auth-modal-provider';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import PlaylistCardGrid from '@/app/components/library/playlist-card-grid';
import PlaylistScrollSection from '@/app/components/library/playlist-scroll-section';
import PlaylistCard from '@/app/components/library/playlist-card';
import CreatePlaylistDrawer from '@/app/components/library/create-playlist-drawer';
import BoardDiscoveryScroll from '@/app/components/board-scroll/board-discovery-scroll';
import BoardSelectorDrawer from '@/app/components/board-selector-drawer/board-selector-drawer';
import SwipeableDrawer from '@/app/components/swipeable-drawer/swipeable-drawer';
import BoardFilterStrip from '@/app/components/board-scroll/board-filter-strip';
import { themeTokens } from '@/app/theme/theme-config';
import type { BoardConfigData } from '@/app/lib/server-board-configs';
import type { StoredBoardConfig } from '@/app/lib/saved-boards-db';
import styles from '@/app/components/library/library.module.css';

type SelectedBoardForCreate = { boardType: string; layoutId: number };

type PendingDrawerAction = { type: 'create'; context: SelectedBoardForCreate } | { type: 'custom' } | null;

type LibraryPageContentProps = {
  /** When set, the page was rendered from a board route and this board is pre-selected. */
  boardSlug?: string;
  /** Base path for playlist detail links (e.g. "/b/my-kilter/40/playlists" or "/kilter/original/12x12/default/45/playlists"). Defaults to "/playlists". */
  playlistsBasePath?: string;
  /** SSR-fetched user boards for instant rendering. */
  initialMyBoards?: UserBoard[] | null;
  /** SSR-fetched user playlists for instant rendering. */
  initialPlaylists?: Playlist[] | null;
  /** SSR-fetched discover playlists for instant rendering. */
  initialDiscoverPlaylists?: {
    popular: DiscoverablePlaylist[];
    recent: DiscoverablePlaylist[];
  } | null;
  /** Board configuration data for the custom-board picker path. */
  boardConfigs?: BoardConfigData;
  /** Analytics label that distinguishes which page the FAB is on. */
  createSource?: string;
};

export default function LibraryPageContent({
  boardSlug,
  playlistsBasePath = '/playlists',
  initialMyBoards,
  initialPlaylists,
  initialDiscoverPlaylists,
  boardConfigs,
  createSource = 'discover-fab',
}: LibraryPageContentProps) {
  const { data: session, status: sessionStatus } = useSession();
  const { token, isLoading: tokenLoading } = useWsAuthToken();
  const router = useLocaleRouter();
  const { t } = useTranslation('playlists');

  const hasInitialBoardData = initialMyBoards != null && initialMyBoards.length > 0;
  const hasInitialPlaylistData = initialPlaylists != null;
  const hasInitialDiscoverData = initialDiscoverPlaylists != null;

  const hasServerUserData = hasInitialPlaylistData || hasInitialBoardData;
  const isAuthenticated = deriveIsAuthenticated(sessionStatus, hasServerUserData);
  // Initialize selectedBoard from SSR data immediately when boardSlug is provided
  const [selectedBoard, setSelectedBoard] = useState<UserBoard | null>(() =>
    findMatchingBoard(initialMyBoards, boardSlug),
  );
  const { openAuthModal } = useAuthModal();
  const { showMessage } = useSnackbar();
  const defaultBoardAppliedRef = useRef(!!selectedBoard);

  // Fetch user's boards for the board selector (with SSR initial data)
  const { boards: myBoards, isLoading: boardsLoading } = useMyBoards(
    hasInitialBoardData || sessionStatus === 'authenticated',
    50,
    initialMyBoards,
  );

  // Get current session/queue board info to use as default selection (global route only)
  const { boardDetails: currentBoardDetails, hasActiveQueue } = useQueueBridgeBoardInfo();

  // Auto-select the matching board once boards finish loading (fallback for non-SSR paths)
  useEffect(() => {
    if (defaultBoardAppliedRef.current || boardsLoading || myBoards.length === 0) return;

    if (boardSlug) {
      // Board route: match by slug
      const match = myBoards.find((b) => b.slug === boardSlug);
      if (match) {
        setSelectedBoard(match);
      }
      defaultBoardAppliedRef.current = true;
    } else {
      // Global route: match from current session/queue board
      // Wait if there's an active queue but board details haven't loaded yet
      if (!currentBoardDetails && hasActiveQueue) return;

      const match = currentBoardDetails
        ? findMatchingBoard(myBoards, undefined, {
            boardType: currentBoardDetails.board_name,
            layoutId: currentBoardDetails.layout_id,
            sizeId: currentBoardDetails.size_id,
          })
        : null;
      if (match) {
        setSelectedBoard(match);
      }
      defaultBoardAppliedRef.current = true;
    }
  }, [myBoards, boardsLoading, currentBoardDetails, hasActiveQueue, boardSlug]);

  // Data states — initialized from SSR data when available
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists ?? []);
  const [popularPlaylists, setPopularPlaylists] = useState<DiscoverablePlaylist[]>(
    initialDiscoverPlaylists?.popular ?? [],
  );
  const [recentPlaylists, setRecentPlaylists] = useState<DiscoverablePlaylist[]>(
    initialDiscoverPlaylists?.recent ?? [],
  );

  // Loading states — skip loading when SSR data is available
  const [playlistsLoading, setPlaylistsLoading] = useState(!hasInitialPlaylistData);
  const [discoverLoading, setDiscoverLoading] = useState(!hasInitialDiscoverData);
  const [error, setError] = useState<string | null>(null);

  // Track whether we already have data to avoid re-showing loading skeleton on refetches
  const hasPlaylistDataRef = useRef(hasInitialPlaylistData);
  const hasDiscoverDataRef = useRef(hasInitialDiscoverData);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (tokenLoading || !isAuthenticated) {
      setPlaylistsLoading(false);
      return;
    }

    try {
      // Only show loading if we don't already have data
      if (!hasPlaylistDataRef.current) {
        setPlaylistsLoading(true);
      }
      setError(null);

      const input: GetAllUserPlaylistsInput = selectedBoard
        ? { boardType: selectedBoard.boardType, layoutId: selectedBoard.layoutId }
        : {};

      const playlistsRes = await executeGraphQL<GetAllUserPlaylistsQueryResponse, { input: GetAllUserPlaylistsInput }>(
        GET_ALL_USER_PLAYLISTS,
        { input },
        token,
      );

      setPlaylists(playlistsRes.allUserPlaylists);
      hasPlaylistDataRef.current = true;
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(t('library.errors.loadFailed'));
    } finally {
      setPlaylistsLoading(false);
    }
  }, [selectedBoard, token, tokenLoading, isAuthenticated, t]);

  // Fetch discover playlists (works for both "All" and specific board)
  const fetchDiscoverData = useCallback(async () => {
    try {
      // Only show loading if we don't already have data
      if (!hasDiscoverDataRef.current) {
        setDiscoverLoading(true);
      }

      const baseInput: DiscoverPlaylistsInput = {
        pageSize: 10,
        ...(selectedBoard && {
          boardType: selectedBoard.boardType,
          layoutId: selectedBoard.layoutId,
        }),
      };

      const [popularRes, recentRes] = await Promise.all([
        executeGraphQL<DiscoverPlaylistsQueryResponse, { input: DiscoverPlaylistsInput }>(DISCOVER_PLAYLISTS, {
          input: { ...baseInput, sortBy: 'popular' },
        }),
        executeGraphQL<DiscoverPlaylistsQueryResponse, { input: DiscoverPlaylistsInput }>(DISCOVER_PLAYLISTS, {
          input: { ...baseInput, sortBy: 'recent' },
        }),
      ]);

      setPopularPlaylists(popularRes.discoverPlaylists.playlists);
      setRecentPlaylists(recentRes.discoverPlaylists.playlists);
      hasDiscoverDataRef.current = true;
    } catch (err) {
      console.error('Error fetching discover playlists:', err);
    } finally {
      setDiscoverLoading(false);
    }
  }, [selectedBoard]);

  useEffect(() => {
    void fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    void fetchDiscoverData();
  }, [fetchDiscoverData]);

  const getPlaylistUrl = useCallback(
    (playlistUuid: string) => {
      return `${playlistsBasePath}/${playlistUuid}`;
    },
    [playlistsBasePath],
  );

  // Filter discover playlists to exclude user's own
  const getDiscoverPlaylists = useCallback(() => {
    const userId = session?.user?.id;
    const combined = [...popularPlaylists, ...recentPlaylists];
    const seen = new Set<string>();
    const filtered: DiscoverablePlaylist[] = [];

    for (const p of combined) {
      if (seen.has(p.uuid)) continue;
      if (userId && p.creatorId === userId) continue;
      seen.add(p.uuid);
      filtered.push(p);
    }

    return filtered;
  }, [popularPlaylists, recentPlaylists, session?.user?.id]);

  const handleBoardSelect = useCallback(
    (board: UserBoard | null) => {
      setSelectedBoard(board);
      // Reset data refs so loading skeletons show for new board filter
      hasPlaylistDataRef.current = false;
      hasDiscoverDataRef.current = false;

      // When rendered from a board route, switching boards navigates to the correct URL
      if (boardSlug || playlistsBasePath !== '/playlists') {
        if (board) {
          const nextPlaylistsPath = constructBoardSlugPlaylistsUrl(board.slug, board.angle);
          router.push(nextPlaylistsPath);
        } else {
          router.push('/playlists');
        }
      }
    },
    [boardSlug, playlistsBasePath, router],
  );

  // Create-playlist flow state. The *Rendered flags keep each drawer mounted
  // through its slide-out animation; the *Open flags drive the visible state.
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isCreateDrawerRendered, setIsCreateDrawerRendered] = useState(false);
  const [isBoardPickerOpen, setIsBoardPickerOpen] = useState(false);
  const [isBoardPickerRendered, setIsBoardPickerRendered] = useState(false);
  const [isCustomBoardOpen, setIsCustomBoardOpen] = useState(false);
  const [isCustomBoardRendered, setIsCustomBoardRendered] = useState(false);
  const [createBoardContext, setCreateBoardContext] = useState<SelectedBoardForCreate | null>(null);

  // Pending action to fire once the currently-closing drawer finishes its
  // slide-out, so two drawers are never mounted-and-animating at once.
  const [pendingDrawer, setPendingDrawer] = useState<PendingDrawerAction>(null);

  const openCreateDrawerFor = useCallback((boardType: string, layoutId: number) => {
    setCreateBoardContext({ boardType, layoutId });
    setIsCreateDrawerRendered(true);
    setIsCreateDrawerOpen(true);
  }, []);

  const fulfillPendingDrawer = useCallback(() => {
    if (!pendingDrawer) return;
    if (pendingDrawer.type === 'create') {
      openCreateDrawerFor(pendingDrawer.context.boardType, pendingDrawer.context.layoutId);
    } else if (pendingDrawer.type === 'custom') {
      setIsCustomBoardRendered(true);
      setIsCustomBoardOpen(true);
    }
    setPendingDrawer(null);
  }, [pendingDrawer, openCreateDrawerFor]);

  const handleCreateDrawerTransitionEnd = useCallback((open: boolean) => {
    if (!open) setIsCreateDrawerRendered(false);
  }, []);
  const handleBoardPickerTransitionEnd = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsBoardPickerRendered(false);
        fulfillPendingDrawer();
      }
    },
    [fulfillPendingDrawer],
  );
  const handleCustomBoardTransitionEnd = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsCustomBoardRendered(false);
        fulfillPendingDrawer();
      }
    },
    [fulfillPendingDrawer],
  );

  const handleCreateClick = useCallback(() => {
    // Prefer the filter strip's selectedBoard, but fall back to a fresh slug
    // lookup against myBoards: on board routes the auto-select effect runs
    // after first paint, so a fast tap can still find selectedBoard === null
    // even though the route already pins us to a specific board.
    const board = selectedBoard ?? (boardSlug ? findMatchingBoard(myBoards, boardSlug) : null);
    if (board) {
      openCreateDrawerFor(board.boardType, board.layoutId);
      return;
    }
    setIsBoardPickerRendered(true);
    setIsBoardPickerOpen(true);
  }, [selectedBoard, boardSlug, myBoards, openCreateDrawerFor]);

  const handlePickerBoardClick = useCallback((board: UserBoard) => {
    setPendingDrawer({ type: 'create', context: { boardType: board.boardType, layoutId: board.layoutId } });
    setIsBoardPickerOpen(false);
  }, []);

  const handlePickerConfigClick = useCallback((config: PopularBoardConfig) => {
    setPendingDrawer({ type: 'create', context: { boardType: config.boardType, layoutId: config.layoutId } });
    setIsBoardPickerOpen(false);
  }, []);

  const handlePickerCustomClick = useCallback(() => {
    if (!boardConfigs) {
      // Defensive: every parent route passes boardConfigs, so this is unexpected.
      // Tell the user instead of swallowing the tap silently.
      setIsBoardPickerOpen(false);
      showMessage(t('library.customUnavailable'), 'error');
      return;
    }
    setPendingDrawer({ type: 'custom' });
    setIsBoardPickerOpen(false);
  }, [boardConfigs, showMessage, t]);

  const handleCustomBoardSelected = useCallback(
    (_url: string, config?: StoredBoardConfig) => {
      if (config && config.layoutId > 0) {
        setPendingDrawer({ type: 'create', context: { boardType: config.board, layoutId: config.layoutId } });
        setIsCustomBoardOpen(false);
        return;
      }
      // BoardSelectorDrawer can fire onBoardSelected with no config (e.g. when it
      // navigates without a stored entry); we have nothing to feed the create
      // mutation, so surface the failure instead of dropping the tap.
      setIsCustomBoardOpen(false);
      showMessage(t('bottomTabBar.selectBoardForPlaylist'), 'error');
    },
    [showMessage, t],
  );

  const handlePlaylistCreated = useCallback(
    (created: Playlist) => {
      setPlaylists((prev) => [created, ...prev]);
      router.push(getPlaylistUrl(created.uuid));
    },
    [router, getPlaylistUrl],
  );

  // Error state (only for authenticated users with fetch errors)
  if (isAuthenticated && error) {
    return (
      <div className={styles.errorContainer}>
        <SentimentDissatisfiedOutlined className={styles.errorIcon} />
        <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
          {t('library.errors.loadTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('library.errors.loadDescription')}
        </Typography>
        <MuiButton variant="outlined" onClick={fetchUserData}>
          {t('library.errors.tryAgain')}
        </MuiButton>
      </div>
    );
  }

  const isLoading = playlistsLoading || tokenLoading || (!hasServerUserData && sessionStatus === 'loading');
  const discoverItems = getDiscoverPlaylists();

  // Server query already filters by boardType + layoutId; no client-side filter needed
  const filteredPlaylists = playlists;

  return (
    <>
      {/* Board Selector */}
      <BoardFilterStrip
        boards={myBoards}
        loading={boardsLoading && myBoards.length === 0}
        selectedBoard={selectedBoard}
        onBoardSelect={handleBoardSelect}
      />

      {/* Placeholder to reserve space while auth status resolves (prevents CLS) */}
      {!hasServerUserData && sessionStatus === 'loading' && (
        <div className={styles.signInBannerPlaceholder} aria-hidden="true" />
      )}

      {/* Sign-in banner for non-authenticated users */}
      {!hasServerUserData && !isAuthenticated && sessionStatus !== 'loading' && (
        <div className={styles.signInBanner}>
          <LoginOutlined sx={{ color: 'text.secondary', fontSize: 28 }} />
          <div className={styles.signInBannerText}>
            <Typography variant="body2" fontWeight={600}>
              {t('library.signInBanner.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('library.signInBanner.description')}
            </Typography>
          </div>
          <MuiButton
            variant="contained"
            size="small"
            onClick={() =>
              openAuthModal({
                title: t('library.signInBanner.modalTitle'),
                description: t('library.signInBanner.modalDescription'),
              })
            }
          >
            {t('library.signInBanner.cta')}
          </MuiButton>
        </div>
      )}

      {/* Authenticated: Recent Playlists Grid */}
      {isAuthenticated && (
        <PlaylistCardGrid playlists={filteredPlaylists} getPlaylistUrl={getPlaylistUrl} loading={isLoading} />
      )}

      {/* Empty state if no playlists (authenticated only) */}
      {isAuthenticated && !isLoading && playlists.length === 0 && (
        <div className={styles.emptyContainer}>
          <LabelOutlined className={styles.emptyIcon} />
          <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
            {t('library.empty.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mb: 2 }}>
            {t('library.empty.description')}
          </Typography>
        </div>
      )}

      {/* Jump Back In (authenticated only) */}
      {isAuthenticated && (isLoading || filteredPlaylists.length > 0) && (
        <PlaylistScrollSection title={t('library.sections.jumpBackIn')} loading={isLoading}>
          {filteredPlaylists.slice(0, 10).map((p, i) => (
            <PlaylistCard
              key={p.uuid}
              name={p.name}
              climbCount={p.climbCount}
              boardType={p.boardType}
              layoutId={p.layoutId}
              color={p.color}
              icon={p.icon}
              href={getPlaylistUrl(p.uuid)}
              variant="scroll"
              index={i}
            />
          ))}
        </PlaylistScrollSection>
      )}

      {/* Discover */}
      {(discoverLoading || discoverItems.length > 0) && (
        <PlaylistScrollSection title={t('library.sections.discover')} loading={discoverLoading}>
          {discoverItems.map((p, i) => (
            <PlaylistCard
              key={p.uuid}
              name={p.name}
              climbCount={p.climbCount}
              boardType={p.boardType}
              layoutId={p.layoutId}
              color={p.color}
              icon={p.icon}
              href={getPlaylistUrl(p.uuid)}
              variant="scroll"
              index={i}
              fetchPriority={i === 0 ? 'high' : undefined}
            />
          ))}
        </PlaylistScrollSection>
      )}

      {/* Create Playlist FAB (authenticated users only) */}
      {isAuthenticated && (
        <Fab
          color="primary"
          size="small"
          onClick={handleCreateClick}
          aria-label={t('library.createFab.ariaLabel')}
          sx={{
            position: 'fixed',
            // Anchor the FAB to the right edge of .pageContainer (see --library-page-max-width
            // in library.module.css) so it doesn't drift to the browser edge on wide viewports.
            right: `max(${themeTokens.spacing[4]}px, calc((100vw - var(--library-page-max-width)) / 2 + ${themeTokens.spacing[4]}px))`,
            // --bottom-bar-height is set by persistent-session-wrapper after hydration with the
            // measured queue-control + tab-bar height; the 145px fallback matches the SSR estimate
            // declared in app/components/index.css and is what users see during first paint only.
            bottom: `calc(var(--bottom-bar-height, 145px) + ${themeTokens.spacing[4]}px)`,
            zIndex: themeTokens.zIndex.fixed,
          }}
        >
          <AddOutlined />
        </Fab>
      )}

      {/* Board picker shown when no board is currently selected */}
      {isBoardPickerRendered && (
        <SwipeableDrawer
          title={t('common:boardSelector.title')}
          placement="bottom"
          open={isBoardPickerOpen}
          onClose={() => setIsBoardPickerOpen(false)}
          onTransitionEnd={handleBoardPickerTransitionEnd}
        >
          <BoardDiscoveryScroll
            onBoardClick={handlePickerBoardClick}
            onConfigClick={handlePickerConfigClick}
            onCustomClick={handlePickerCustomClick}
            myBoards={myBoards}
          />
        </SwipeableDrawer>
      )}

      {/* Custom board configuration drawer (mounted only when boardConfigs is provided) */}
      {boardConfigs && isCustomBoardRendered && (
        <BoardSelectorDrawer
          open={isCustomBoardOpen}
          onClose={() => setIsCustomBoardOpen(false)}
          onTransitionEnd={handleCustomBoardTransitionEnd}
          boardConfigs={boardConfigs}
          placement="bottom"
          onBoardSelected={handleCustomBoardSelected}
        />
      )}

      {/* Create-playlist drawer */}
      {isCreateDrawerRendered && createBoardContext && (
        <CreatePlaylistDrawer
          open={isCreateDrawerOpen}
          onClose={() => setIsCreateDrawerOpen(false)}
          onTransitionEnd={handleCreateDrawerTransitionEnd}
          boardName={createBoardContext.boardType}
          layoutId={createBoardContext.layoutId}
          source={createSource}
          onCreated={handlePlaylistCreated}
        />
      )}
    </>
  );
}

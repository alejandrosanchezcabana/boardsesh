'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import BoardScrollSection from './board-scroll-section';
import BoardScrollCard from './board-scroll-card';
import FindNearbyCard, { type FindNearbyStatus } from './find-nearby-card';
import CustomBoardCard from './custom-board-card';
import SearchBoardsCard from './search-boards-card';
import BluetoothQuickStartCard from './bluetooth-quick-start-card';
import BoardSearchDrawer from '../board-search-drawer/board-search-drawer';
import { useDiscoverBoards } from '@/app/hooks/use-discover-boards';
import { usePopularBoardConfigs } from '@/app/hooks/use-popular-board-configs';
import { useMyBoards } from '@/app/hooks/use-my-boards';
import type { UserBoard, PopularBoardConfig } from '@boardsesh/shared-schema';
import styles from './board-scroll.module.css';

function deriveFindNearbyStatus({
  locationEnabled,
  isLoading,
  error,
  hasLocation,
}: {
  locationEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  hasLocation: boolean;
}): FindNearbyStatus {
  if (!locationEnabled) return 'idle';
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (!hasLocation) return 'geo-denied';
  return 'no-results';
}

type BoardDiscoveryScrollProps = {
  onBoardClick: (board: UserBoard) => void;
  onConfigClick: (config: PopularBoardConfig) => void;
  onCustomClick: () => void;
  selectedBoardUuid?: string;
  initialPopularConfigs?: PopularBoardConfig[];
  /** Externally-provided boards to display inline (avoids double-fetch when parent already calls useMyBoards) */
  myBoards?: UserBoard[];
};

export default function BoardDiscoveryScroll({
  onBoardClick,
  onConfigClick,
  onCustomClick,
  selectedBoardUuid,
  initialPopularConfigs,
  myBoards: externalMyBoards,
}: BoardDiscoveryScrollProps) {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [locationEnabled, setLocationEnabled] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const {
    boards: discoverBoards,
    isLoading: isBoardsLoading,
    hasLocation,
    error: discoverError,
  } = useDiscoverBoards({ limit: 20, enableLocation: locationEnabled });

  const {
    configs: popularConfigs,
    isLoadingMore,
    hasMore,
    loadMore,
  } = usePopularBoardConfigs({ limit: 12, initialData: initialPopularConfigs });

  // Use externally-provided boards if available, otherwise fetch internally
  const { boards: internalMyBoards } = useMyBoards(externalMyBoards === undefined && isAuthenticated);
  const myBoards = externalMyBoards ?? internalMyBoards;
  const [myBoardsVisible, setMyBoardsVisible] = useState(false);

  useEffect(() => {
    if (myBoards.length > 0) {
      requestAnimationFrame(() => setMyBoardsVisible(true));
    } else {
      setMyBoardsVisible(false);
    }
  }, [myBoards.length]);

  const handleFindNearbyClick = useCallback(() => {
    setLocationEnabled(true);
  }, []);

  const handleSearchClick = useCallback(() => {
    setSearchDrawerOpen(true);
  }, []);

  const handleSearchDrawerClose = useCallback(() => {
    setSearchDrawerOpen(false);
  }, []);

  const handleSearchDrawerBoardClick = useCallback(
    (board: UserBoard) => {
      setSearchDrawerOpen(false);
      onBoardClick(board);
    },
    [onBoardClick],
  );

  return (
    <>
      <BoardScrollSection
        title="Boards near you"
        loading={isBoardsLoading && popularConfigs.length === 0 && myBoards.length === 0}
        onLoadMore={loadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
      >
        {/* Always-visible 2x2 mini-card cluster: Find Nearby + Search / Custom + Bluetooth */}
        <div className={styles.stackedCardsDouble}>
          <div className={styles.stackedCards}>
            <FindNearbyCard
              onClick={handleFindNearbyClick}
              status={deriveFindNearbyStatus({
                locationEnabled,
                isLoading: isBoardsLoading,
                error: discoverError,
                hasLocation,
              })}
              size="small"
            />
            <CustomBoardCard onClick={onCustomClick} size="small" />
          </div>
          <div className={styles.stackedCards}>
            <SearchBoardsCard onClick={handleSearchClick} size="small" />
            <BluetoothQuickStartCard size="small" />
          </div>
        </div>

        {/* Nearby boards (if any) */}
        {discoverBoards.map((board) => (
          <BoardScrollCard
            key={board.uuid}
            userBoard={board}
            selected={selectedBoardUuid === board.uuid}
            onClick={() => onBoardClick(board)}
          />
        ))}

        {/* My boards - animate in between cluster and popular */}
        {myBoards.map((board) => (
          <div
            key={board.uuid}
            className={`${styles.myBoardCardFadeIn} ${myBoardsVisible ? styles.myBoardCardFadeInVisible : ''}`}
          >
            <BoardScrollCard
              userBoard={board}
              selected={selectedBoardUuid === board.uuid}
              onClick={() => onBoardClick(board)}
            />
          </div>
        ))}

        {popularConfigs.map((config) => (
          <BoardScrollCard
            key={`${config.boardType}-${config.layoutId}-${config.sizeId}`}
            popularConfig={config}
            onClick={() => onConfigClick(config)}
          />
        ))}
      </BoardScrollSection>

      <BoardSearchDrawer
        open={searchDrawerOpen}
        onClose={handleSearchDrawerClose}
        onBoardOpen={handleSearchDrawerBoardClick}
      />
    </>
  );
}

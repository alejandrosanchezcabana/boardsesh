'use client';

import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { GetUserProfileStatsQueryResponse } from '@/app/lib/graphql/operations/ticks';
import styles from '@/app/profile/[user_id]/profile-page.module.css';
import { useProfileData } from '@/app/profile/[user_id]/hooks/use-profile-data';
import StatsSummary from '@/app/profile/[user_id]/components/stats-summary';
import BoardStatsSection from '@/app/profile/[user_id]/components/board-stats-section';
import type { UserProfile, LogbookEntry } from '@/app/profile/[user_id]/utils/profile-constants';
import { StatsFilterBridgeInjector } from '@/app/components/stats-filter-bridge/stats-filter-bridge-context';
import StatsFilterDrawer from '@/app/components/stats-filter-drawer/stats-filter-drawer';

export interface YouProgressContentProps {
  userId: string;
  initialProfile?: UserProfile | null;
  initialProfileStats?: GetUserProfileStatsQueryResponse['userProfileStats'] | null;
  initialAllBoardsTicks?: Record<string, LogbookEntry[]>;
  initialLogbook?: LogbookEntry[];
}

export default function YouProgressContent({
  userId,
  initialProfile,
  initialProfileStats,
  initialAllBoardsTicks,
  initialLogbook,
}: YouProgressContentProps) {
  const {
    loading,
    selectedBoard,
    setSelectedBoard,
    filteredLogbook,
    unifiedTimeframe,
    setUnifiedTimeframe,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    weeklyBars,
    aggregatedFlashRedpointBars,
    vPointsTimeline,
    loadingAggregated,
    aggregatedStackedBars,
    loadingProfileStats,
    statisticsSummary,
    hardestSend,
    hardestFlash,
    percentile,
  } = useProfileData(userId, {
    initialProfile: initialProfile ?? undefined,
    initialProfileStats: initialProfileStats ?? undefined,
    initialAllBoardsTicks,
    initialLogbook,
    initialIsOwnProfile: true,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRendered, setDrawerRendered] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerRendered(true);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleDrawerTransitionEnd = useCallback((open: boolean) => {
    if (!open) setDrawerRendered(false);
  }, []);

  const hasActiveFilters = unifiedTimeframe !== 'all' || selectedBoard !== 'all';

  if (loading) {
    return (
      <Box className={styles.loadingContent}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <>
      <StatsFilterBridgeInjector
        openDrawer={openDrawer}
        pageTitle="Progress"
        backUrl={null}
        hasActiveFilters={hasActiveFilters}
        isActive={true}
      />
      <StatsSummary
        statisticsSummary={statisticsSummary}
        hardestSend={hardestSend}
        hardestFlash={hardestFlash}
        loadingProfileStats={loadingProfileStats}
        loadingAggregated={loadingAggregated}
        weeklyBars={weeklyBars}
        aggregatedStackedBars={aggregatedStackedBars}
        aggregatedFlashRedpointBars={aggregatedFlashRedpointBars}
        vPointsTimeline={vPointsTimeline}
        percentile={percentile}
      />
      <BoardStatsSection
        selectedBoard={selectedBoard}
        loading={loadingAggregated}
        filteredLogbook={filteredLogbook}
        isOwnProfile={true}
      />
      {drawerRendered && (
        <StatsFilterDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          selectedBoard={selectedBoard}
          onBoardChange={setSelectedBoard}
          timeframe={unifiedTimeframe}
          onTimeframeChange={setUnifiedTimeframe}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          onTransitionEnd={handleDrawerTransitionEnd}
        />
      )}
    </>
  );
}

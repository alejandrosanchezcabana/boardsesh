'use client';

import React from 'react';
import type { GetUserProfileStatsQueryResponse } from '@/app/lib/graphql/operations/ticks';
import ProfileSubPageLayout from '../components/profile-sub-page-layout';
import StatsSummary from '../components/stats-summary';
import BoardStatsSection from '../components/board-stats-section';
import { useProfileData } from '../hooks/use-profile-data';
import type { LogbookEntry } from '../utils/profile-constants';

interface AnalyticsContentProps {
  userId: string;
  initialProfileStats?: GetUserProfileStatsQueryResponse['userProfileStats'] | null;
  initialAllBoardsTicks?: Record<string, LogbookEntry[]>;
  initialLogbook?: LogbookEntry[];
  initialIsOwnProfile?: boolean;
}

export default function AnalyticsContent({
  userId,
  initialProfileStats,
  initialAllBoardsTicks,
  initialLogbook,
  initialIsOwnProfile,
}: AnalyticsContentProps) {
  const {
    isOwnProfile,
    selectedBoard,
    setSelectedBoard,
    loadingStats,
    filteredLogbook,
    timeframe,
    setTimeframe,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    weeklyBars,
    aggregatedFlashRedpointBars,
    vPointsTimeline,
    weeklyFromDate,
    setWeeklyFromDate,
    weeklyToDate,
    setWeeklyToDate,
    aggregatedTimeframe,
    setAggregatedTimeframe,
    loadingAggregated,
    aggregatedStackedBars,
    loadingProfileStats,
    statisticsSummary,
  } = useProfileData(userId, {
    initialProfileStats: initialProfileStats ?? undefined,
    initialAllBoardsTicks,
    initialLogbook,
    initialIsOwnProfile,
  });

  return (
    <ProfileSubPageLayout userId={userId} title="Statistics">
      <StatsSummary
        statisticsSummary={statisticsSummary}
        loadingProfileStats={loadingProfileStats}
        aggregatedTimeframe={aggregatedTimeframe}
        onAggregatedTimeframeChange={setAggregatedTimeframe}
        loadingAggregated={loadingAggregated}
        aggregatedStackedBars={aggregatedStackedBars}
        aggregatedFlashRedpointBars={aggregatedFlashRedpointBars}
        vPointsTimeline={vPointsTimeline}
      />
      <BoardStatsSection
        selectedBoard={selectedBoard}
        onBoardChange={setSelectedBoard}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        loadingStats={loadingStats}
        filteredLogbook={filteredLogbook}
        weeklyBars={weeklyBars}
        isOwnProfile={isOwnProfile}
        weeklyFromDate={weeklyFromDate}
        onWeeklyFromDateChange={setWeeklyFromDate}
        weeklyToDate={weeklyToDate}
        onWeeklyToDateChange={setWeeklyToDate}
      />
    </ProfileSubPageLayout>
  );
}

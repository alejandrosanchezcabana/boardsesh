'use client';

import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import ActivityFeed from '@/app/components/activity-feed/activity-feed';
import LogbookFeed from '@/app/components/library/logbook-feed';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GetUserProfileStatsQueryResponse } from '@/app/lib/graphql/operations/ticks';
import styles from '@/app/profile/[user_id]/profile-page.module.css';
import { useProfileData } from '@/app/profile/[user_id]/hooks/use-profile-data';
import StatsSummary from '@/app/profile/[user_id]/components/stats-summary';
import BoardStatsSection from '@/app/profile/[user_id]/components/board-stats-section';
import type { UserProfile, LogbookEntry } from '@/app/profile/[user_id]/utils/profile-constants';

type YouTab = 'progress' | 'sessions' | 'logbook';
const VALID_TABS: YouTab[] = ['progress', 'sessions', 'logbook'];

interface YouPageContentProps {
  userId: string;
  initialProfile?: UserProfile | null;
  initialProfileStats?: GetUserProfileStatsQueryResponse['userProfileStats'] | null;
  initialAllBoardsTicks?: Record<string, LogbookEntry[]>;
  initialLogbook?: LogbookEntry[];
}

export default function YouPageContent({
  userId,
  initialProfile,
  initialProfileStats,
  initialAllBoardsTicks,
  initialLogbook,
}: YouPageContentProps) {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    loading,
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
    initialProfile: initialProfile ?? undefined,
    initialProfileStats: initialProfileStats ?? undefined,
    initialAllBoardsTicks,
    initialLogbook,
    initialIsOwnProfile: true,
  });

  // Tab state from URL search params
  const tabParam = searchParams.get('tab');
  const activeTab: YouTab = VALID_TABS.includes(tabParam as YouTab)
    ? (tabParam as YouTab)
    : 'progress';

  const handleTabChange = useCallback((_: React.SyntheticEvent, value: YouTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'progress') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    const qs = params.toString();
    router.push(qs ? `/you?${qs}` : '/you', { scroll: false });
  }, [router, searchParams]);

  // Determine if user is authenticated (for ActivityFeed)
  const isAuthenticated = sessionStatus === 'authenticated';

  if (loading) {
    return (
      <Box className={styles.layout}>
        <Box component="main" className={styles.loadingContent}>
          <CircularProgress size={48} />
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.layout}>
      <Box component="main" className={styles.content} sx={{ pt: 'calc(var(--global-header-height) + 8px)' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab label="Progress" value="progress" />
          <Tab label="Sessions" value="sessions" />
          <Tab label="Logbook" value="logbook" />
        </Tabs>

        {activeTab === 'progress' && (
          <>
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
              isOwnProfile={true}
              weeklyFromDate={weeklyFromDate}
              onWeeklyFromDateChange={setWeeklyFromDate}
              weeklyToDate={weeklyToDate}
              onWeeklyToDateChange={setWeeklyToDate}
            />
          </>
        )}

        {activeTab === 'sessions' && (
          <ActivityFeed
            isAuthenticated={isAuthenticated}
            userId={userId}
          />
        )}

        {activeTab === 'logbook' && (
          <LogbookFeed />
        )}
      </Box>
    </Box>
  );
}

'use client';

import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { HistoryOutlined, IosShare } from '@mui/icons-material';
import Link from 'next/link';
import { EmptyState } from '@/app/components/ui/empty-state';
import Logo from '@/app/components/brand/logo';
import BackButton from '@/app/components/back-button';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { shareWithFallback } from '@/app/lib/share-utils';
import AscentsFeed from '@/app/components/activity-feed';
import SetterClimbList from '@/app/components/climb-list/setter-climb-list';
import type { GetUserProfileStatsQueryResponse } from '@/app/lib/graphql/operations/ticks';
import styles from './profile-page.module.css';
import { useProfileData } from './hooks/use-profile-data';
import ProfileHeader from './components/profile-header';
import BoardStatsSection from './components/board-stats-section';
import type { UserProfile, LogbookEntry } from './utils/profile-constants';

interface ProfilePageContentProps {
  userId: string;
  initialProfile?: UserProfile | null;
  initialProfileStats?: GetUserProfileStatsQueryResponse['userProfileStats'] | null;
  initialAllBoardsTicks?: Record<string, LogbookEntry[]>;
  initialLogbook?: LogbookEntry[];
  initialIsOwnProfile?: boolean;
  initialNotFound?: boolean;
}

export default function ProfilePageContent({
  userId,
  initialProfile,
  initialProfileStats,
  initialAllBoardsTicks,
  initialLogbook,
  initialIsOwnProfile,
  initialNotFound,
}: ProfilePageContentProps) {
  const { showMessage } = useSnackbar();
  const {
    loading,
    notFound,
    profile,
    setProfile,
    isOwnProfile,
    hasCredentials,
    authToken,
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
    activeTab,
    setActiveTab,
  } = useProfileData(userId, {
    initialProfile: initialProfile ?? undefined,
    initialProfileStats: initialProfileStats ?? undefined,
    initialAllBoardsTicks,
    initialLogbook,
    initialIsOwnProfile,
    initialNotFound,
  });

  const handleShare = useCallback(async () => {
    const displayName = profile?.profile?.displayName || profile?.name || 'Crusher';
    const shareUrl = `${window.location.origin}/crusher/${userId}`;

    await shareWithFallback({
      url: shareUrl,
      title: `${displayName}'s climbing profile`,
      text: `Check out ${displayName}'s climbing profile on Boardsesh`,
      trackingEvent: 'Profile Shared',
      trackingProps: { userId },
      onClipboardSuccess: () => showMessage('Link copied to clipboard!', 'success'),
      onError: () => showMessage('Failed to share', 'error'),
    });
  }, [profile, userId, showMessage]);

  if (loading) {
    return (
      <Box className={styles.layout}>
        <Box component="main" className={styles.loadingContent}>
          <CircularProgress size={48} />
        </Box>
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box className={styles.layout}>
        <Box component="header" className={styles.header}>
          <BackButton fallbackUrl="/" />
          <Logo size="sm" showText={false} />
          <Typography variant="h6" component="h4" className={styles.headerTitle}>
            Profile
          </Typography>
        </Box>
        <Box component="main" className={styles.content}>
          <EmptyState description="User not found" />
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.layout}>
      <Box component="header" className={styles.header}>
        <BackButton fallbackUrl="/" />
        <Logo size="sm" showText={false} />
        <Typography variant="h6" component="h4" className={styles.headerTitle}>
          Profile
        </Typography>
        {profile && (
          <IconButton onClick={handleShare} aria-label="Share profile">
            <IosShare />
          </IconButton>
        )}
      </Box>

      <Box component="main" className={styles.content}>
        {profile && (
          <ProfileHeader
            userId={userId}
            profile={profile}
            isOwnProfile={isOwnProfile}
            statisticsSummary={statisticsSummary}
            loadingProfileStats={loadingProfileStats}
            onProfileUpdate={setProfile}
            aggregatedTimeframe={aggregatedTimeframe}
            onAggregatedTimeframeChange={setAggregatedTimeframe}
            loadingAggregated={loadingAggregated}
            aggregatedStackedBars={aggregatedStackedBars}
            aggregatedFlashRedpointBars={aggregatedFlashRedpointBars}
            vPointsTimeline={vPointsTimeline}
          />
        )}

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

        {hasCredentials && (
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab label="Activity" value="activity" />
            <Tab label="Created Climbs" value="createdClimbs" />
          </Tabs>
        )}

        {(!hasCredentials || activeTab === 'activity') && (
          <MuiCard className={styles.statsCard}>
            <CardContent>
              <Typography variant="h6" component="h5">
                Recent Activity
              </Typography>
              <Typography variant="body2" component="span" color="text.secondary" className={styles.chartDescription}>
                Latest ascents and attempts
              </Typography>
              <AscentsFeed userId={userId} pageSize={10} isOwnProfile={isOwnProfile} />
              {isOwnProfile && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <MuiButton
                    component={Link}
                    href="/playlists"
                    startIcon={<HistoryOutlined />}
                    variant="text"
                    size="small"
                    sx={{ textTransform: 'none' }}
                  >
                    View full logbook
                  </MuiButton>
                </Box>
              )}
            </CardContent>
          </MuiCard>
        )}

        {activeTab === 'createdClimbs' &&
          profile?.credentials &&
          (() => {
            const uniqueSetters = Array.from(
              new Map(profile.credentials.map((c) => [c.auroraUsername, c])).values(),
            );
            return uniqueSetters.map((cred) => (
              <MuiCard key={cred.auroraUsername} className={styles.statsCard}>
                <CardContent>
                  <Typography variant="h6" component="h5">
                    Created Climbs
                  </Typography>
                  <Typography
                    variant="body2"
                    component="span"
                    color="text.secondary"
                    className={styles.chartDescription}
                  >
                    Climbs set by {cred.auroraUsername} on{' '}
                    {cred.boardType.charAt(0).toUpperCase() + cred.boardType.slice(1)}
                  </Typography>
                  <SetterClimbList username={cred.auroraUsername} authToken={authToken} />
                </CardContent>
              </MuiCard>
            ));
          })()}
      </Box>
    </Box>
  );
}

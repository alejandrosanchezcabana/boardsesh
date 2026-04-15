'use client';

import React, { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { IosShare } from '@mui/icons-material';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import FitnessCenterOutlined from '@mui/icons-material/FitnessCenterOutlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import { EmptyState } from '@/app/components/ui/empty-state';
import Logo from '@/app/components/brand/logo';
import BackButton from '@/app/components/back-button';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { shareWithFallback } from '@/app/lib/share-utils';
import { CssBarChart } from '@/app/components/charts/css-bar-chart';
import { useGradeFormat } from '@/app/hooks/use-grade-format';
import type { GetUserProfileStatsQueryResponse } from '@/app/lib/graphql/operations/ticks';
import styles from './profile-page.module.css';
import { useProfileData } from './hooks/use-profile-data';
import { buildWeeklyBars } from './utils/chart-data-builders';
import UserCard from './components/user-card';
import ProfileNavCard from './components/profile-nav-card';
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
  const { gradeFormat } = useGradeFormat();

  const {
    loading,
    notFound,
    profile,
    setProfile,
    isOwnProfile,
    statisticsSummary,
  } = useProfileData(userId, {
    initialProfile: initialProfile ?? undefined,
    initialProfileStats: initialProfileStats ?? undefined,
    initialAllBoardsTicks,
    initialLogbook,
    initialIsOwnProfile,
    initialNotFound,
  });

  // Build overview bars: last 3 months across all boards
  const overviewBars = useMemo(() => {
    if (!initialAllBoardsTicks) return null;
    const allTicks = Object.values(initialAllBoardsTicks).flat();
    if (allTicks.length === 0) return null;
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const fromDate = threeMonthsAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];
    return buildWeeklyBars(allTicks, fromDate, toDate, gradeFormat);
  }, [initialAllBoardsTicks, gradeFormat]);

  const handleShare = useCallback(async () => {
    const displayName = profile?.profile?.displayName || profile?.name || 'Climber';
    const shareUrl = `${window.location.origin}/profile/${userId}`;

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
        <Box component="main" className={styles.content} sx={{ pb: 'calc(170px + env(safe-area-inset-bottom, 0px))' }}>
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

      <Box component="main" className={styles.content} sx={{ pb: 'calc(170px + env(safe-area-inset-bottom, 0px))' }}>
        {profile && (
          <UserCard
            userId={userId}
            profile={profile}
            isOwnProfile={isOwnProfile}
            onProfileUpdate={setProfile}
          />
        )}

        {/* Overview: last 3 months activity */}
        {overviewBars && overviewBars.length > 0 && (
          <MuiCard className={styles.statsCard}>
            <CardContent>
              <Typography variant="body2" component="span" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                Last 3 months
              </Typography>
              <CssBarChart
                bars={overviewBars}
                height={100}
                mobileHeight={80}
                showLegend={false}
                ariaLabel="Activity over the last 3 months"
              />
            </CardContent>
          </MuiCard>
        )}

        {/* Navigation cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <ProfileNavCard
            title="Sessions"
            subtitle="Climbing sessions and activity"
            href={`/profile/${userId}/sessions`}
            icon={<TimelineOutlined />}
          />
          <ProfileNavCard
            title="Analytics"
            subtitle={statisticsSummary.totalAscents > 0 ? `${statisticsSummary.totalAscents} distinct climbs` : 'Grades, progression, and more'}
            href={`/profile/${userId}/analytics`}
            icon={<ShowChartOutlined />}
          />
          {profile?.credentials && profile.credentials.length > 0 && (
            <ProfileNavCard
              title="Their Climbs"
              subtitle="Problems they created"
              href={`/profile/${userId}/climbs`}
              icon={<FitnessCenterOutlined />}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

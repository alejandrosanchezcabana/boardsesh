'use client';

import React, { useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import ClearOutlined from '@mui/icons-material/ClearOutlined';
import FilterListOutlined from '@mui/icons-material/FilterListOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import IosShareOutlined from '@mui/icons-material/IosShare';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import Badge from '@mui/material/Badge';
import LocaleLink from '@/app/components/i18n/locale-link';
import { useUnreadNotificationCount } from '@/app/hooks/use-unread-notification-count';
import { useSession } from 'next-auth/react';
import UnifiedSearchDrawer from '@/app/components/search-drawer/unified-search-drawer';
import { shareWithFallback } from '@/app/lib/share-utils';
import { useSearchDrawerBridge } from '@/app/components/search-drawer/search-drawer-bridge-context';
import UserDrawer from '@/app/components/user-drawer/user-drawer';
import { useIsOnBoardRoute } from '@/app/components/persistent-session/persistent-session-context';
import type { BoardConfigData } from '@/app/lib/server-board-configs';
import { isBoardCreatePath } from '@/app/lib/board-route-paths';

import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { usePathname } from 'next/navigation';
import BackButton from '@/app/components/back-button';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useStatsFilterBridge } from '@/app/components/stats-filter-bridge/stats-filter-bridge-context';
import { useProfileHeaderShare } from '@/app/components/profile-header-bridge/profile-header-bridge-context';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import styles from './global-header.module.css';

/** Route prefix → translation key for pages that show a simple title header instead of the default search/sesh header */
const TITLE_HEADER_PAGES: Record<string, string> = {
  '/aurora-migration': 'header.auroraMigration',
};

/** Pages where the global header is completely hidden */
const HIDDEN_HEADER_PAGES = ['/'];

type GlobalHeaderProps = {
  boardConfigs: BoardConfigData;
};

type CenteredHeaderProps = {
  left?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
};

type ProfileHeaderConfig = {
  userId: string;
  title: string;
  backUrl: string;
  isRoot: boolean;
};

function CenteredHeader({ left, title, right }: CenteredHeaderProps) {
  return (
    <header className={styles.header}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(48px, 1fr) auto minmax(48px, 1fr)',
          columnGap: 1.5,
          alignItems: 'center',
          width: '100%',
          minWidth: 0,
          flex: '1 1 auto',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifySelf: 'start',
            minWidth: 0,
          }}
        >
          {left}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
            pointerEvents: 'none',
          }}
        >
          <Typography
            variant="h6"
            component="h1"
            sx={{
              margin: 0,
              maxWidth: 'min(60vw, 320px)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            justifySelf: 'end',
            minWidth: 0,
          }}
        >
          {right}
        </Box>
      </Box>
    </header>
  );
}

function getProfileHeaderConfig(
  pathname: string,
  t: (key: string) => string,
): ProfileHeaderConfig | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'profile' || !segments[1]) {
    return null;
  }

  const userId = segments[1];
  const childPage = segments[2];

  if (!childPage) {
    return {
      userId,
      title: t('header.profile'),
      backUrl: '/',
      isRoot: true,
    };
  }

  const childPageTitleKeys: Record<string, string> = {
    statistics: 'header.statistics',
    sessions: 'header.sessions',
    climbs: 'header.createdClimbs',
  };

  return {
    userId,
    title: t(childPageTitleKeys[childPage] ?? 'header.profile'),
    backUrl: `/profile/${userId}`,
    isRoot: false,
  };
}

export default function GlobalHeader({ boardConfigs }: GlobalHeaderProps) {
  const { t } = useTranslation('common');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchRendered, setSearchRendered] = useState(false);
  const { data: session } = useSession();
  const { showMessage } = useSnackbar();

  const isOnBoardRoute = useIsOnBoardRoute();
  const notificationUnreadCount = useUnreadNotificationCount();
  const {
    openClimbSearchDrawer,
    nameFilter,
    setNameFilter,
    hasActiveNonNameFilters: nonNameFiltersActive,
  } = useSearchDrawerBridge();
  const statsFilterBridge = useStatsFilterBridge();
  const profileHeaderShare = useProfileHeaderShare();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const profileHeaderConfig = getProfileHeaderConfig(pathname, t);

  // Unmount drawer trees after close animation finishes to avoid rendering
  // MUI Modal/Portal/FocusTrap infrastructure on every parent re-render.
  const handleSearchTransitionEnd = useCallback((open: boolean) => {
    if (!open) setSearchRendered(false);
  }, []);

  const handleShareOwnProfile = useCallback(() => {
    if (!session?.user?.id) return;

    const shareUrl = `${window.location.origin}/profile/${session.user.id}`;
    const displayName = session.user.name || t('share.fallbackName');

    void shareWithFallback({
      url: shareUrl,
      title: t('share.profileTitle', { name: displayName }),
      text: t('share.profileText', { name: displayName }),
      trackingEvent: 'Profile Shared',
      trackingProps: { source: 'you-header' },
    });
  }, [session, t]);

  const handleShareViewedProfile = useCallback(async () => {
    if (!profileHeaderConfig?.isRoot || !profileHeaderShare.isActive) return;

    const displayName = profileHeaderShare.displayName || t('share.viewedFallbackName');
    const shareUrl = `${window.location.origin}/profile/${profileHeaderConfig.userId}`;

    await shareWithFallback({
      url: shareUrl,
      title: t('share.profileTitle', { name: displayName }),
      text: t('share.profileText', { name: displayName }),
      trackingEvent: 'Profile Shared',
      trackingProps: {
        source: 'profile-header',
        userId: profileHeaderConfig.userId,
      },
      onClipboardSuccess: () => showMessage(t('share.linkCopied'), 'success'),
      onError: () => showMessage(t('share.shareFailed'), 'error'),
    });
  }, [profileHeaderConfig, profileHeaderShare.displayName, profileHeaderShare.isActive, showMessage, t]);

  const notificationButton = (
    <IconButton component={LocaleLink} href="/notifications" aria-label={t('ariaLabels.notifications')} size="small">
      <Badge
        badgeContent={notificationUnreadCount}
        color="error"
        max={99}
        sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}
      >
        <NotificationsOutlined />
      </Badge>
    </IconButton>
  );

  // On board create routes, hide the header entirely
  if (isBoardCreatePath(pathname)) {
    return null;
  }

  // On the root /you page, show a centered title while keeping the avatar anchored left.
  if (pathname === '/you') {
    return (
      <CenteredHeader
        left={
          <div className={styles.headerActions}>
            <UserDrawer boardConfigs={boardConfigs} />
            <IconButton component={LocaleLink} href="/settings" aria-label={t('ariaLabels.settings')} size="small">
              <SettingsOutlined />
            </IconButton>
          </div>
        }
        title={t('header.you')}
        right={
          <div className={styles.headerActions}>
            {statsFilterBridge.isActive && (
              <div className={styles.filterButton}>
                <IconButton
                  onClick={() => statsFilterBridge.openFilterDrawer?.()}
                  aria-label={t('ariaLabels.openStatsFilters')}
                  size="small"
                >
                  <TuneOutlined />
                </IconButton>
                {statsFilterBridge.hasActiveFilters && <span className={styles.filterActiveIndicator} />}
              </div>
            )}
            {session?.user?.id && (
              <IconButton onClick={handleShareOwnProfile} aria-label={t('ariaLabels.shareProfile')} size="small">
                <IosShareOutlined />
              </IconButton>
            )}
            {notificationButton}
          </div>
        }
      />
    );
  }

  // On /you child pages, show user drawer + share + settings cog, no search bar
  if (pathname.startsWith('/you')) {
    return (
      <header className={styles.header}>
        <UserDrawer boardConfigs={boardConfigs} />
        <Box sx={{ flex: 1 }} />
        {session?.user?.id && (
          <IconButton onClick={handleShareOwnProfile} aria-label={t('ariaLabels.shareProfile')} size="small">
            <IosShareOutlined />
          </IconButton>
        )}
        {notificationButton}
        <IconButton component={LocaleLink} href="/settings" aria-label={t('ariaLabels.settings')} size="small">
          <SettingsOutlined />
        </IconButton>
      </header>
    );
  }

  // On /settings pages, show user drawer only, no search bar or settings cog (already on settings)
  if (pathname.startsWith('/settings')) {
    return (
      <header className={styles.header}>
        <UserDrawer boardConfigs={boardConfigs} />
        <Box sx={{ flex: 1 }} />
      </header>
    );
  }

  // On /profile pages, show a centered title with a back button in the left slot.
  if (profileHeaderConfig) {
    const title = statsFilterBridge.isActive
      ? (statsFilterBridge.pageTitle ?? profileHeaderConfig.title)
      : profileHeaderConfig.title;
    const backUrl = statsFilterBridge.isActive
      ? (statsFilterBridge.backUrl ?? profileHeaderConfig.backUrl)
      : profileHeaderConfig.backUrl;

    return (
      <CenteredHeader
        left={<BackButton fallbackUrl={backUrl} />}
        title={title}
        right={
          <div className={styles.headerActions}>
            {statsFilterBridge.isActive && (
              <div className={styles.filterButton}>
                <IconButton
                  onClick={() => statsFilterBridge.openFilterDrawer?.()}
                  aria-label={t('ariaLabels.openStatsFilters')}
                  size="small"
                >
                  <TuneOutlined />
                </IconButton>
                {statsFilterBridge.hasActiveFilters && <span className={styles.filterActiveIndicator} />}
              </div>
            )}
            {!statsFilterBridge.isActive && profileHeaderConfig.isRoot && profileHeaderShare.isActive && (
              <IconButton onClick={handleShareViewedProfile} aria-label={t('ariaLabels.shareProfile')} size="small">
                <IosShareOutlined />
              </IconButton>
            )}
          </div>
        }
      />
    );
  }

  // On hidden-header pages, show only the avatar in a transparent bar
  if (HIDDEN_HEADER_PAGES.includes(pathname)) {
    return (
      <header className={styles.headerTransparent}>
        <UserDrawer boardConfigs={boardConfigs} />
      </header>
    );
  }

  // Check if current page wants a simple title header
  const titleHeaderPage = Object.entries(TITLE_HEADER_PAGES).find(([prefix]) => pathname.startsWith(prefix));

  // When the bridge is active (on a board list page), delegate to the board route's drawer
  const useClimbSearchBridge = openClimbSearchDrawer !== null;

  const handleSearchFocus = () => {
    // On non-list pages, the input acts as a fake search trigger
    if (!useClimbSearchBridge) {
      inputRef.current?.blur();
      setSearchRendered(true);
      setSearchOpen(true);
    }
  };

  const handleFilterClick = () => {
    if (useClimbSearchBridge) {
      openClimbSearchDrawer();
    }
  };

  const searchPlaceholder = useClimbSearchBridge ? t('header.searchClimbsPlaceholder') : t('header.searchPlaceholder');

  // Simple title header for specific pages (back button + title, no search/sesh)
  if (titleHeaderPage) {
    return <CenteredHeader left={<BackButton fallbackUrl="/" />} title={t(titleHeaderPage[1])} />;
  }

  return (
    <>
      <header className={styles.header}>
        <UserDrawer boardConfigs={boardConfigs} />

        <div id={useClimbSearchBridge ? 'onboarding-search-button' : undefined} className={styles.searchInput}>
          <TextField
            inputRef={inputRef}
            placeholder={searchPlaceholder}
            variant="outlined"
            size="small"
            fullWidth
            value={useClimbSearchBridge ? nameFilter : ''}
            onChange={(e) => setNameFilter?.(e.target.value)}
            onFocus={handleSearchFocus}
            aria-label={t('ariaLabels.searchClimbsByName')}
            slotProps={{
              input: {
                readOnly: !useClimbSearchBridge,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment:
                  useClimbSearchBridge && nameFilter ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setNameFilter?.('')}
                        aria-label={t('ariaLabels.clearSearch')}
                        edge="end"
                        sx={{ padding: '2px' }}
                      >
                        <ClearOutlined sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
              },
            }}
          />
        </div>

        {useClimbSearchBridge && (
          <div className={styles.filterButton}>
            <IconButton onClick={handleFilterClick} aria-label={t('ariaLabels.openFilters')} size="small">
              <FilterListOutlined />
            </IconButton>
            {nonNameFiltersActive && <span className={styles.filterActiveIndicator} />}
          </div>
        )}
      </header>

      {searchRendered && (
        <UnifiedSearchDrawer
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onTransitionEnd={handleSearchTransitionEnd}
          defaultCategory={isOnBoardRoute ? 'climbs' : 'boards'}
        />
      )}
    </>
  );
}

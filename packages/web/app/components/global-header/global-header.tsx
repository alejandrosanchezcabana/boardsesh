'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import ClearOutlined from '@mui/icons-material/ClearOutlined';
import FilterListOutlined from '@mui/icons-material/FilterListOutlined';
import UnifiedSearchDrawer from '@/app/components/search-drawer/unified-search-drawer';
import { useSearchDrawerBridge } from '@/app/components/search-drawer/search-drawer-bridge-context';
import UserDrawer from '@/app/components/user-drawer/user-drawer';
import SeshSettingsDrawer from '@/app/components/sesh-settings/sesh-settings-drawer';
import { SESH_SETTINGS_DRAWER_EVENT } from '@/app/components/sesh-settings/sesh-settings-drawer-event';
import { useIsOnBoardRoute } from '@/app/components/persistent-session/persistent-session-context';
import { BoardConfigData } from '@/app/lib/server-board-configs';
import { isBoardCreatePath } from '@/app/lib/board-route-paths';

import { usePathname } from 'next/navigation';
import BackButton from '@/app/components/back-button';
import Typography from '@mui/material/Typography';
import styles from './global-header.module.css';

/** Route prefix → title for pages that show a simple title header instead of the default search/sesh header */
const TITLE_HEADER_PAGES: Record<string, string> = {
  '/aurora-migration': 'Aurora Migration',
};

/** Pages where the global header is completely hidden */
const HIDDEN_HEADER_PAGES = ['/'];

interface GlobalHeaderProps {
  boardConfigs: BoardConfigData;
}

export default function GlobalHeader({ boardConfigs }: GlobalHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchRendered, setSearchRendered] = useState(false);
  const [seshSettingsOpen, setSeshSettingsOpen] = useState(false);
  const [seshSettingsRendered, setSeshSettingsRendered] = useState(false);

  const isOnBoardRoute = useIsOnBoardRoute();
  const { openClimbSearchDrawer, nameFilter, setNameFilter, hasActiveNonNameFilters: nonNameFiltersActive } = useSearchDrawerBridge();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);



  // Unmount drawer trees after close animation finishes to avoid rendering
  // MUI Modal/Portal/FocusTrap infrastructure on every parent re-render.
  const handleSearchTransitionEnd = useCallback((open: boolean) => {
    if (!open) setSearchRendered(false);
  }, []);
  const handleSeshSettingsTransitionEnd = useCallback((open: boolean) => {
    if (!open) setSeshSettingsRendered(false);
  }, []);

  // Listen for session mini-bar events to open the sesh settings drawer
  useEffect(() => {
    const handleOpenSeshSettings = () => {
      setSeshSettingsRendered(true);
      setSeshSettingsOpen(true);
    };
    window.addEventListener(SESH_SETTINGS_DRAWER_EVENT, handleOpenSeshSettings);
    return () => window.removeEventListener(SESH_SETTINGS_DRAWER_EVENT, handleOpenSeshSettings);
  }, []);

  // On board create routes, hide the header entirely
  if (isBoardCreatePath(pathname)) {
    return null;
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


  const searchPlaceholder = useClimbSearchBridge ? 'Search climbs...' : 'What do you want to climb?';

  // Simple title header for specific pages (back button + title, no search/sesh)
  if (titleHeaderPage) {
    return (
      <header className={styles.header}>
        <BackButton fallbackUrl="/" />
        <Typography variant="h6" sx={{ flex: 1, margin: 0 }}>
          {titleHeaderPage[1]}
        </Typography>
      </header>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <UserDrawer boardConfigs={boardConfigs} />

        <div
          id={useClimbSearchBridge ? 'onboarding-search-button' : undefined}
          className={styles.searchInput}
        >
          <TextField
            inputRef={inputRef}
            placeholder={searchPlaceholder}
            variant="outlined"
            size="small"
            fullWidth
            value={useClimbSearchBridge ? nameFilter : ''}
            onChange={(e) => setNameFilter?.(e.target.value)}
            onFocus={handleSearchFocus}
            aria-label="Search climbs by name"
            slotProps={{
              input: {
                readOnly: !useClimbSearchBridge,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: useClimbSearchBridge && nameFilter ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setNameFilter?.('')}
                      aria-label="Clear search"
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
            <IconButton
              onClick={handleFilterClick}
              aria-label="Open filters"
              size="small"
            >
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

      {seshSettingsRendered && (
        <SeshSettingsDrawer
          open={seshSettingsOpen}
          onClose={() => setSeshSettingsOpen(false)}
          onTransitionEnd={handleSeshSettingsTransitionEnd}
        />
      )}
    </>
  );
}

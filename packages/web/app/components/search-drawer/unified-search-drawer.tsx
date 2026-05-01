'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import UserSearchResults from '../social/user-search-results';
import BoardSearchResults from '../social/board-search-results';
import PlaylistSearchResults from '../social/playlist-search-results';
import GymSearchResults from '../social/gym-search-results';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import type { BoardDetails } from '@/app/lib/types';

export type SearchCategory = 'climbs' | 'users' | 'playlists' | 'boards' | 'gyms';

type UnifiedSearchDrawerProps = {
  open: boolean;
  onClose: () => void;
  onTransitionEnd?: (open: boolean) => void;
  defaultCategory?: SearchCategory;
  boardDetails?: BoardDetails;
  /** Render prop for climb search content (accordion form). Only used when boardDetails is provided. */
  renderClimbSearch?: () => React.ReactNode;
  /** Render prop for climb search footer (search/clear buttons). Only used when boardDetails is provided. */
  renderClimbFooter?: () => React.ReactNode;
  /** Optional allow-list for category pills/results. */
  allowedCategories?: SearchCategory[];
  /** Show drawer close button on mobile devices. */
  showCloseButtonOnMobile?: boolean;
  /** Show drawer close button. */
  showCloseButton?: boolean;
};

export default function UnifiedSearchDrawer({
  open,
  onClose,
  onTransitionEnd,
  defaultCategory = 'boards',
  boardDetails,
  renderClimbSearch,
  renderClimbFooter,
  allowedCategories,
  showCloseButtonOnMobile = false,
  showCloseButton = false,
}: UnifiedSearchDrawerProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>(defaultCategory);
  const { token } = useWsAuthToken();

  const handleClose = useCallback(() => {
    onClose();
    setQuery('');
  }, [onClose]);

  // Stable string key for the allow-list. Callers commonly pass a fresh
  // array literal every render (e.g. `allowedCategories={['climbs']}`),
  // which would otherwise break memoization of `visibleCategories`. Joining
  // on a character that can't appear in a `SearchCategory` literal gives us
  // a cheap value-equality key without a deep-compare helper.
  const hasBoardDetails = !!boardDetails;
  const allowedCategoriesKey = allowedCategories ? allowedCategories.join('|') : '';
  const visibleCategories = useMemo<{ key: SearchCategory; label: string }[]>(() => {
    const all: { key: SearchCategory; label: string; visible: boolean }[] = [
      { key: 'climbs', label: 'Climbs', visible: hasBoardDetails },
      { key: 'boards', label: 'Boards', visible: true },
      { key: 'gyms', label: 'Gyms', visible: true },
      { key: 'users', label: 'Users', visible: true },
      { key: 'playlists', label: 'Playlists', visible: true },
    ];
    const allowedSet = allowedCategoriesKey ? new Set(allowedCategoriesKey.split('|') as SearchCategory[]) : null;
    return all
      .filter((c) => c.visible && (allowedSet ? allowedSet.has(c.key) : true))
      .map(({ key, label }) => ({ key, label }));
  }, [hasBoardDetails, allowedCategoriesKey]);

  // Derive the effective category during render instead of correcting it in
  // a post-render effect. This avoids a one-frame flash of the wrong results
  // when `selectedCategory` isn't (or no longer is) in `visibleCategories`.
  const category: SearchCategory = useMemo(() => {
    if (visibleCategories.length === 0) return selectedCategory;
    if (visibleCategories.some((c) => c.key === selectedCategory)) return selectedCategory;
    return visibleCategories[0].key;
  }, [selectedCategory, visibleCategories]);

  const handleCategoryChange = (newCategory: SearchCategory) => {
    setSelectedCategory(newCategory);
    setQuery('');
  };

  const isClimbMode = category === 'climbs' && !!boardDetails && !!renderClimbSearch;

  const showCategoryChips = visibleCategories.length > 1;

  const searchPlaceholderByCategory: Record<string, string> = {
    boards: 'Search boards...',
    gyms: 'Search gyms...',
    users: 'Search climbers...',
  };
  const searchPlaceholder = searchPlaceholderByCategory[category] ?? 'Search playlists...';

  return (
    <SwipeableDrawer
      placement="top"
      open={open}
      onClose={handleClose}
      onTransitionEnd={onTransitionEnd}
      height={isClimbMode ? '100%' : '80vh'}
      fullHeight={isClimbMode}
      showDragHandle
      showCloseButton={showCloseButton}
      showCloseButtonOnMobile={showCloseButtonOnMobile}
      swipeEnabled
      footer={isClimbMode && renderClimbFooter ? renderClimbFooter() : undefined}
      styles={{
        body: {
          padding: isClimbMode ? '0 16px 16px' : '0',
          backgroundColor: isClimbMode ? 'var(--semantic-background, #F3F4F6)' : undefined,
        },
        footer: isClimbMode ? { padding: 0, border: 'none' } : undefined,
        header: isClimbMode ? { display: 'none' } : undefined,
        mask: { backgroundColor: 'rgba(128, 128, 128, 0.7)' },
      }}
    >
      {/* Category pills */}
      {showCategoryChips && (
        <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1, flexWrap: 'wrap' }}>
          {visibleCategories.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              variant={category === c.key ? 'filled' : 'outlined'}
              color={category === c.key ? 'primary' : 'default'}
              onClick={() => handleCategoryChange(c.key)}
            />
          ))}
        </Box>
      )}

      {/* Climb mode: render via parent's render prop (has access to queue context) */}
      {isClimbMode && renderClimbSearch()}

      {/* Text search mode */}
      {!isClimbMode && (
        <>
          <Box sx={{ px: 2, pt: 0, pb: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Box sx={{ overflow: 'auto', flex: 1 }}>
            {category === 'boards' && <BoardSearchResults query={query} authToken={token} />}
            {category === 'gyms' && <GymSearchResults query={query} authToken={token} />}
            {category === 'users' && <UserSearchResults query={query} authToken={token} />}
            {category === 'playlists' && <PlaylistSearchResults query={query} authToken={token} />}
          </Box>
        </>
      )}
    </SwipeableDrawer>
  );
}

'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { HistoryOutlined } from '@mui/icons-material';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  DEFAULT_ANGLE_RANGE,
  sanitizeLogbookPreferences,
  type LogbookFilterState as FilterState,
  type LogbookSortState as SortState,
  type SortField,
} from '@/app/lib/logbook-preferences';
import { getPreference, setPreference } from '@/app/lib/user-preferences-db';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { useInfiniteScroll } from '@/app/hooks/use-infinite-scroll';
import { useQueryClient } from '@tanstack/react-query';
import {
  GET_USER_ASCENTS_FEED,
  DELETE_TICK,
  type GetUserAscentsFeedQueryVariables,
  type GetUserAscentsFeedQueryResponse,
  type AscentFeedItem,
  type DeleteTickMutationVariables,
  type LayoutStats,
} from '@/app/lib/graphql/operations/ticks';
import { getLayoutDisplayName } from '@/app/profile/[user_id]/utils/profile-constants';
import { getDefaultSizeForLayout, getSetsForLayoutAndSize } from '@boardsesh/board-constants/product-sizes';
import { getLayoutById, MOONBOARD_SETS, type MoonBoardLayoutKey } from '@/app/lib/moonboard-config';
import type { BoardName } from '@/app/lib/types';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { isInstagramPostingSupported } from '@/app/lib/instagram-posting';
import type { UserBoard } from '@boardsesh/shared-schema';
import LogbookFeedItem from './logbook-feed-item';
import LogbookSwipeHintOrchestrator from './logbook-swipe-hint-orchestrator';
import LogbookSearchForm from './logbook-search-form';
import LogbookItemSkeleton from './logbook-item-skeleton';
import styles from './library.module.css';
import feedStyles from '@/app/components/activity-feed/ascents-feed.module.css';

const PAGE_SIZE = 20;
type StatusMode = 'both' | 'send' | 'attempt';

// Orphaned layouts not in LAYOUTS config but with valid sets data
const ORPHANED_KILTER_DEFAULTS: Record<number, { sizeId: number; setIds: string }> = {
  2: { sizeId: 11, setIds: '21' },   // JUUL Full Wall
  3: { sizeId: 12, setIds: '22' },   // Demo
  4: { sizeId: 13, setIds: '23' },   // BKB
  5: { sizeId: 15, setIds: '24' },   // Spire
  6: { sizeId: 16, setIds: '25' },   // Orbit
  7: { sizeId: 16, setIds: '25' },   // Orbit
};

// ---------- URL query param helpers ----------

function parseQueryParamBoolean(params: URLSearchParams, key: string): boolean | undefined {
  const val = params.get(key);
  if (val === '1' || val === 'true') return true;
  if (val === '0' || val === 'false') return false;
  return undefined;
}

function parseQueryParamInt(params: URLSearchParams, key: string): number | undefined {
  const val = params.get(key);
  if (val === null) return undefined;
  const num = parseInt(val, 10);
  return Number.isFinite(num) ? num : undefined;
}

function readFiltersFromQuery(params: URLSearchParams): Partial<FilterState> {
  const partial: Partial<FilterState> = {};

  const sends = parseQueryParamBoolean(params, 'sends');
  if (sends !== undefined) partial.includeSends = sends;

  const attempts = parseQueryParamBoolean(params, 'attempts');
  if (attempts !== undefined) partial.includeAttempts = attempts;

  const flash = parseQueryParamBoolean(params, 'flash');
  if (flash !== undefined) partial.flashOnly = flash;

  const benchmark = parseQueryParamBoolean(params, 'benchmark');
  if (benchmark !== undefined) partial.benchmarkOnly = benchmark;

  const minGrade = parseQueryParamInt(params, 'minGrade');
  if (minGrade !== undefined) partial.minGrade = minGrade;

  const maxGrade = parseQueryParamInt(params, 'maxGrade');
  if (maxGrade !== undefined) partial.maxGrade = maxGrade;

  const from = params.get('from');
  if (from) partial.fromDate = from;

  const to = params.get('to');
  if (to) partial.toDate = to;

  const minAngle = parseQueryParamInt(params, 'minAngle');
  const maxAngle = parseQueryParamInt(params, 'maxAngle');
  if (minAngle !== undefined || maxAngle !== undefined) {
    partial.angleRange = [
      minAngle ?? DEFAULT_ANGLE_RANGE[0],
      maxAngle ?? DEFAULT_ANGLE_RANGE[1],
    ];
  }

  return partial;
}

const VALID_SORT_FIELDS: Set<SortField> = new Set(['climbName', 'loggedGrade', 'consensusGrade', 'date', 'attemptCount']);

function isValidSortField(value: string): value is SortField {
  return VALID_SORT_FIELDS.has(value as SortField);
}

function readSortFromQuery(params: URLSearchParams): Partial<SortState> {
  const partial: Partial<SortState> = {};
  const sort = params.get('sort');
  if (sort && isValidSortField(sort)) {
    partial.mode = 'custom';
    partial.primaryField = sort;
  }
  const order = params.get('order');
  if (order === 'asc' || order === 'desc') {
    partial.primaryDirection = order;
  }
  const sort2 = params.get('sort2');
  if (sort2 && isValidSortField(sort2)) partial.secondaryField = sort2;
  const order2 = params.get('order2');
  if (order2 === 'asc' || order2 === 'desc') partial.secondaryDirection = order2;
  return partial;
}

function filtersToQueryParams(
  searchText: string,
  filters: FilterState,
  sortState: SortState,
  selectedBoardUuids: string[],
): Record<string, string> {
  const params: Record<string, string> = {};

  if (searchText) params.q = searchText;
  if (selectedBoardUuids.length > 0) params.boards = selectedBoardUuids.join(',');
  if (filters.minGrade !== '' && filters.minGrade !== undefined) params.minGrade = String(filters.minGrade);
  if (filters.maxGrade !== '' && filters.maxGrade !== undefined) params.maxGrade = String(filters.maxGrade);

  // Only write non-default filter values
  if (!filters.includeSends) params.sends = '0';
  if (!filters.includeAttempts) params.attempts = '0';
  if (filters.flashOnly) params.flash = '1';
  if (filters.benchmarkOnly) params.benchmark = '1';
  if (filters.fromDate) params.from = filters.fromDate;
  if (filters.toDate) params.to = filters.toDate;
  if (filters.angleRange[0] !== DEFAULT_ANGLE_RANGE[0]) params.minAngle = String(filters.angleRange[0]);
  if (filters.angleRange[1] !== DEFAULT_ANGLE_RANGE[1]) params.maxAngle = String(filters.angleRange[1]);

  if (sortState.mode === 'custom') {
    if (sortState.primaryField !== DEFAULT_SORT.primaryField) params.sort = sortState.primaryField;
    if (sortState.primaryDirection !== DEFAULT_SORT.primaryDirection) params.order = sortState.primaryDirection;
    if (sortState.secondaryField) params.sort2 = sortState.secondaryField;
    if (sortState.secondaryField && sortState.secondaryDirection !== 'desc') params.order2 = sortState.secondaryDirection;
  }

  return params;
}

// ---------- Component ----------

interface LogbookFeedProps {
  layoutStats: LayoutStats[];
  loadingLayoutStats: boolean;
}

export default function LogbookFeed({ layoutStats, loadingLayoutStats }: LogbookFeedProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, isLoading: authLoading, error: authError } = useWsAuthToken();
  const userId = session?.user?.id;
  const isNarrowViewport = useMediaQuery('(max-width: 768px)', { noSsr: true });

  const queryClient = useQueryClient();
  const { showMessage } = useSnackbar();

  // Build board list from layout stats (boards the user has ticks for)
  const logbookBoards: UserBoard[] = useMemo(() =>
    layoutStats.map((ls) => {
      const layoutId = ls.layoutId ?? 0;
      const boardName = ls.boardType as BoardName;

      let sizeId = 0;
      let setIds = '';

      if (boardName === 'moonboard') {
        // MoonBoard uses its own set system, not Aurora's
        const layoutEntry = getLayoutById(layoutId);
        if (layoutEntry) {
          const [layoutKey] = layoutEntry;
          const moonSets = MOONBOARD_SETS[layoutKey as MoonBoardLayoutKey] ?? [];
          setIds = moonSets.map((s) => s.id).join(',');
        }
      } else {
        const defaultSize = getDefaultSizeForLayout(boardName, layoutId);
        if (defaultSize !== null) {
          sizeId = defaultSize;
          const sets = getSetsForLayoutAndSize(boardName, layoutId, sizeId);
          setIds = sets.map((s) => s.id).join(',');
        } else {
          const fallback = boardName === 'kilter' ? ORPHANED_KILTER_DEFAULTS[layoutId] : undefined;
          if (fallback) {
            sizeId = fallback.sizeId;
            setIds = fallback.setIds;
          }
        }
      }

      return {
        uuid: `logbook-${ls.boardType}-${layoutId}`,
        slug: '',
        ownerId: '',
        boardType: ls.boardType,
        layoutId,
        sizeId,
        setIds,
        name: getLayoutDisplayName(ls.boardType, ls.layoutId),
        isPublic: false,
        isUnlisted: false,
        hideLocation: false,
        isOwned: false,
        angle: 0,
        isAngleAdjustable: false,
        createdAt: '',
        totalAscents: ls.distinctClimbCount,
        uniqueClimbers: 0,
        followerCount: 0,
        commentCount: 0,
        isFollowedByMe: false,
      };
    }),
  [layoutStats]);

  // State
  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);
  const [selectedBoards, setSelectedBoards] = useState<UserBoard[]>([]);
  const [editingItemUuid, setEditingItemUuid] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [boardsInitialized, setBoardsInitialized] = useState(() => !searchParams.get('boards'));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search text
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 350);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Load preferences from IndexedDB, then overlay URL query params
  useEffect(() => {
    let isCancelled = false;

    getPreference('logbookPreferences').then((saved) => {
      if (isCancelled) return;

      let baseFilters = DEFAULT_FILTERS;
      let baseSort = DEFAULT_SORT;

      if (saved) {
        const sanitized = sanitizeLogbookPreferences(saved);
        baseFilters = sanitized.filters;
        baseSort = sanitized.sort;
      }

      // Overlay URL query params if present
      const hasQueryParams = searchParams.toString().length > 0;
      if (hasQueryParams) {
        const queryFilters = readFiltersFromQuery(searchParams);
        baseFilters = { ...baseFilters, ...queryFilters };

        const querySort = readSortFromQuery(searchParams);
        baseSort = { ...baseSort, ...querySort };
      }

      setFilters(baseFilters);
      setSortState(baseSort);
      setPreferencesLoaded(true);
    });

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve selected boards from URL param after boards load
  useEffect(() => {
    if (loadingLayoutStats) return;

    const boardsParam = searchParams.get('boards');
    if (boardsParam && logbookBoards.length > 0) {
      const uuids = boardsParam.split(',');
      const matched = logbookBoards.filter((b) => uuids.includes(b.uuid));
      if (matched.length > 0) {
        setSelectedBoards(matched);
      }
    }
    setBoardsInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingLayoutStats, logbookBoards]);

  // Update URL query params when state changes
  const updateUrlRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!preferencesLoaded || !boardsInitialized) return;

    clearTimeout(updateUrlRef.current);
    updateUrlRef.current = setTimeout(() => {
      const params = filtersToQueryParams(
        debouncedSearch,
        filters,
        sortState,
        selectedBoards.map((b) => b.uuid),
      );

      const newSearchParams = new URLSearchParams(params);
      const newSearch = newSearchParams.toString();
      const currentSearch = searchParams.toString();

      if (newSearch !== currentSearch) {
        router.replace(`${pathname}${newSearch ? `?${newSearch}` : ''}`, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(updateUrlRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters, sortState, selectedBoards, preferencesLoaded, boardsInitialized]);

  // Persist to IndexedDB
  useEffect(() => {
    if (!preferencesLoaded) return;
    void setPreference('logbookPreferences', {
      version: 1 as const,
      boardFilter: 'all' as const,
      layoutSelections: {
        kilter: [],
        tension: [],
        moonboard: [],
      },
      filters,
      sort: sortState,
    });
  }, [filters, sortState, preferencesLoaded]);

  // Board toggle handler (multi-select)
  const handleBoardToggle = useCallback((board: UserBoard | null) => {
    if (board === null) {
      setSelectedBoards([]);
      return;
    }
    setSelectedBoards((prev) => {
      const isSelected = prev.some((b) => b.uuid === board.uuid);
      if (isSelected) {
        return prev.filter((b) => b.uuid !== board.uuid);
      }
      return [...prev, board];
    });
  }, []);

  // Build query variables from state
  const selectedBoardTypes = useMemo(() => {
    if (selectedBoards.length === 0) return undefined;
    const types = [...new Set(selectedBoards.map((b) => b.boardType))];
    return types;
  }, [selectedBoards]);

  const selectedLayoutIds = useMemo(() => {
    if (selectedBoards.length === 0) return undefined;
    const ids = selectedBoards.map((b) => b.layoutId).filter((id): id is number => id != null);
    return ids.length > 0 ? ids : undefined;
  }, [selectedBoards]);

  const climbNameParam = debouncedSearch || undefined;

  const sortParams = useMemo(() => {
    if (sortState.mode === 'preset') {
      if (sortState.preset === 'hardest') {
        return { sortBy: 'hardest' as const, sortOrder: 'desc' as const };
      }
      return { sortBy: 'recent' as const, sortOrder: 'desc' as const };
    }
    return {
      sortBy: sortState.primaryField,
      sortOrder: sortState.primaryDirection,
      ...(sortState.secondaryField
        ? { secondarySortBy: sortState.secondaryField, secondarySortOrder: sortState.secondaryDirection }
        : {}),
    };
  }, [sortState]);

  const activeFilters = useMemo(() => ({
    statusMode: (filters.includeSends && filters.includeAttempts ? 'both' : filters.includeSends ? 'send' : 'attempt') as StatusMode,
    flashOnly: filters.includeSends ? filters.flashOnly : false,
    minDifficulty: filters.minGrade !== '' ? filters.minGrade : undefined,
    maxDifficulty: filters.maxGrade !== '' ? filters.maxGrade : undefined,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
    minAngle: filters.angleRange[0] !== DEFAULT_ANGLE_RANGE[0] ? filters.angleRange[0] : undefined,
    maxAngle: filters.angleRange[1] !== DEFAULT_ANGLE_RANGE[1] ? filters.angleRange[1] : undefined,
    benchmarkOnly: filters.benchmarkOnly || undefined,
  }), [filters]);

  const feedQueryKey = useMemo(() => [
    'logbookFeed',
    userId,
    selectedBoardTypes?.join(',') ?? 'all',
    selectedLayoutIds?.join(',') ?? 'all-layouts',
    climbNameParam ?? '',
    JSON.stringify(activeFilters),
    JSON.stringify(sortParams),
  ], [userId, selectedBoardTypes, selectedLayoutIds, climbNameParam, activeFilters, sortParams]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: async ({ pageParam }) => {
      const client = createGraphQLHttpClient(token ?? null);

      // For single board type, use boardType; for multiple, use boardTypes
      const boardTypeFilter = selectedBoardTypes?.length === 1
        ? { boardType: selectedBoardTypes[0] }
        : selectedBoardTypes && selectedBoardTypes.length > 1
          ? { boardTypes: selectedBoardTypes }
          : {};

      const variables: GetUserAscentsFeedQueryVariables = {
        userId: userId!,
        input: {
          limit: PAGE_SIZE,
          offset: pageParam,
          ...boardTypeFilter,
          ...(selectedLayoutIds ? { layoutIds: selectedLayoutIds } : {}),
          ...(climbNameParam ? { climbName: climbNameParam } : {}),
          statusMode: activeFilters.statusMode,
          flashOnly: activeFilters.flashOnly,
          ...(activeFilters.minDifficulty !== undefined ? { minDifficulty: activeFilters.minDifficulty } : {}),
          ...(activeFilters.maxDifficulty !== undefined ? { maxDifficulty: activeFilters.maxDifficulty } : {}),
          ...(activeFilters.fromDate ? { fromDate: activeFilters.fromDate } : {}),
          ...(activeFilters.toDate ? { toDate: activeFilters.toDate } : {}),
          ...(activeFilters.minAngle !== undefined ? { minAngle: activeFilters.minAngle } : {}),
          ...(activeFilters.maxAngle !== undefined ? { maxAngle: activeFilters.maxAngle } : {}),
          ...(activeFilters.benchmarkOnly ? { benchmarkOnly: activeFilters.benchmarkOnly } : {}),
          ...sortParams,
        },
      };
      const response = await client.request<GetUserAscentsFeedQueryResponse>(GET_USER_ASCENTS_FEED, variables);
      return response.userAscentsFeed;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore) return undefined;
      return lastPageParam + lastPage.items.length;
    },
    enabled: !!userId && !!token,
    staleTime: 60 * 1000,
  });

  const items: AscentFeedItem[] = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: fetchNextPage,
    hasMore: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
  });

  const pendingDeleteRef = useRef<{ uuid: string; item: AscentFeedItem; timerId: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timerId);
      }
    };
  }, []);

  // Keep token in a ref so handleDelete stays stable across auth refreshes,
  // which would otherwise invalidate React.memo on every LogbookFeedItem.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const handleDelete = useCallback((uuid: string) => {
    // If there's already a pending delete for a different item, flush it immediately
    if (pendingDeleteRef.current && pendingDeleteRef.current.uuid !== uuid) {
      const { uuid: prevUuid, timerId } = pendingDeleteRef.current;
      clearTimeout(timerId);
      pendingDeleteRef.current = null;
      const client = createGraphQLHttpClient(tokenRef.current ?? null);
      client.request<{ deleteTick: boolean }, DeleteTickMutationVariables>(DELETE_TICK, { uuid: prevUuid }).catch(() => {
        showMessage('Failed to delete tick', 'error');
      });
    }

    // Find and capture the item before removing it from the cache
    const currentData = queryClient.getQueryData<{ pages: { items: AscentFeedItem[]; hasMore: boolean }[] }>(feedQueryKey);
    const itemToDelete = currentData?.pages.flatMap((p) => p.items).find((i) => i.uuid === uuid);

    // Optimistically remove the item from the cache
    queryClient.setQueryData(
      feedQueryKey,
      (old: { pages: { items: AscentFeedItem[]; hasMore: boolean }[]; pageParams: number[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((i) => i.uuid !== uuid),
          })),
        };
      }
    );

    const timerId = setTimeout(() => {
      pendingDeleteRef.current = null;
      const client = createGraphQLHttpClient(tokenRef.current ?? null);
      client
        .request<{ deleteTick: boolean }, DeleteTickMutationVariables>(DELETE_TICK, { uuid })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['logbookFeed'] });
        })
        .catch(() => {
          if (itemToDelete) {
            queryClient.invalidateQueries({ queryKey: ['logbookFeed'] });
          }
          showMessage('Failed to delete tick', 'error');
        });
    }, 5000);

    pendingDeleteRef.current = { uuid, item: itemToDelete ?? ({ uuid } as AscentFeedItem), timerId };

    showMessage('Tick deleted', 'success', {
      label: 'Undo',
      onClick: () => {
        if (pendingDeleteRef.current?.uuid === uuid) {
          clearTimeout(pendingDeleteRef.current.timerId);
          pendingDeleteRef.current = null;
          queryClient.invalidateQueries({ queryKey: ['logbookFeed'] });
        }
      },
    }, 5000);
  }, [queryClient, showMessage, feedQueryKey]);

  const handleEdit = useCallback((item: AscentFeedItem) => {
    setEditingItemUuid(item.uuid);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingItemUuid(null);
  }, []);

  const showBoardType = selectedBoards.length === 0 || selectedBoards.length > 1;
  const hasFilters = selectedBoards.length > 0 || debouncedSearch.length > 0 ||
    filters.minGrade !== '' || filters.maxGrade !== '' ||
    filters.flashOnly || filters.benchmarkOnly ||
    !filters.includeSends || filters.includeAttempts ||
    filters.fromDate !== '' || filters.toDate !== '' ||
    filters.angleRange[0] !== DEFAULT_ANGLE_RANGE[0] || filters.angleRange[1] !== DEFAULT_ANGLE_RANGE[1];
  // Posting and linking are mutually exclusive — see `allowInstagramLinking` below.
  const enableInstagramPosting = pathname === '/you/logbook' && isNarrowViewport && isInstagramPostingSupported();
  const enableInstagramLinking = pathname === '/you/logbook';

  const searchForm = (
    <LogbookSearchForm
      searchText={searchText}
      onSearchChange={handleSearchChange}
      minGrade={filters.minGrade}
      maxGrade={filters.maxGrade}
      onMinGradeChange={(value) => setFilters((prev) => ({ ...prev, minGrade: value }))}
      onMaxGradeChange={(value) => setFilters((prev) => ({ ...prev, maxGrade: value }))}
      sortState={sortState}
      onSortChange={setSortState}
      boards={logbookBoards}
      boardsLoading={loadingLayoutStats}
      selectedBoards={selectedBoards}
      onBoardToggle={handleBoardToggle}
      filters={filters}
      onFiltersChange={setFilters}
    />
  );

  if (isLoading) {
    return (
      <>
        {searchForm}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <LogbookItemSkeleton key={i} />
          ))}
        </Box>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {searchForm}
        {userId && !authLoading && !token && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {authError
              ? 'Signed in, but Boardsesh could not load your authenticated logbook data on this device.'
              : 'Signed in, but Boardsesh could not access your authenticated logbook data on this device.'}
          </Alert>
        )}
        <div className={styles.emptyContainer}>
          <HistoryOutlined className={styles.emptyIcon} />
          <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
            {userId && !authLoading && !token
              ? 'Logbook unavailable on this device'
              : hasFilters
                ? 'No matching climbs'
                : 'No logged climbs yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
            {userId && !authLoading && !token
              ? 'Your account is signed in, but the authenticated data connection did not become available.'
              : hasFilters
                ? 'Try adjusting your filters or sort.'
                : 'Tick your sends and they show up here.'}
          </Typography>
        </div>
      </>
    );
  }

  return (
    <>
      {searchForm}
      <LogbookSwipeHintOrchestrator />
      <div className={feedStyles.feed}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, index) => (
            <LogbookFeedItem
              key={item.uuid}
              item={item}
              showBoardType={showBoardType}
              isEditing={editingItemUuid === item.uuid}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCancelEdit={handleCloseEdit}
              allowInstagramPosting={enableInstagramPosting}
              allowInstagramLinking={enableInstagramLinking && !enableInstagramPosting}
              // Orchestrator re-queries DOM at animation time, so re-sorts are safe.
              isSwipeHintTarget={index === 0}
            />
          ))}
        </Box>

        <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2, minHeight: 20 }}>
          {isFetchingNextPage && <CircularProgress size={24} />}
        </Box>
      </div>
    </>
  );
}

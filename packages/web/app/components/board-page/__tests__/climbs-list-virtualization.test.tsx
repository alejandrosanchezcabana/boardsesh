// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Climb, BoardDetails } from '@/app/lib/types';

// --- Mocks ---

vi.mock('next/navigation', () => ({
  usePathname: () => '/kilter/original/12x12/default/40/list',
}));

vi.mock('@/app/hooks/use-is-dark-mode', () => ({
  useIsDarkMode: () => false,
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('../../climb-card/climb-list-item', () => ({
  default: ({ climb }: { climb: Climb }) => (
    <div data-testid="climb-list-item" data-uuid={climb.uuid}>
      {climb.name}
    </div>
  ),
}));

vi.mock('../../climb-card/climb-card', () => ({
  default: ({ climb }: { climb: Climb }) => (
    <div data-testid="climb-card" data-uuid={climb.uuid}>
      {climb.name}
    </div>
  ),
}));

vi.mock('../../climb-card/drawer-climb-header', () => ({
  default: () => <div data-testid="drawer-climb-header" />,
}));

vi.mock('../../climb-actions', () => ({
  ClimbActions: () => <div data-testid="climb-actions" />,
}));

vi.mock('../../climb-actions/playlist-selection-content', () => ({
  default: () => <div data-testid="playlist-selection-content" />,
}));

vi.mock('../../error-boundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../board-page-skeleton', () => ({
  ClimbCardSkeleton: () => <div data-testid="climb-card-skeleton" />,
  ClimbListItemSkeleton: () => <div data-testid="climb-list-item-skeleton" />,
}));

vi.mock('@/app/lib/user-preferences-db', () => ({
  getPreference: vi.fn(() => Promise.resolve('list')),
  setPreference: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/app/hooks/use-infinite-scroll', () => ({
  useInfiniteScroll: () => ({ sentinelRef: { current: null } }),
}));

vi.mock('@/app/lib/rendering-metrics', () => ({
  trackListBatchRender: vi.fn(),
  trackRenderComplete: vi.fn(),
  trackRenderError: vi.fn(),
}));

vi.mock('../climb-list-utils', () => ({
  classifyClimbListChange: () => 'replace',
}));

vi.mock('@/app/lib/climb-action-utils', () => ({
  getExcludedClimbActions: () => [],
}));

vi.mock('../selected-climb-store', () => ({
  SelectionStoreContext: React.createContext(null),
  useSelectionStore: () => ({
    getSnapshot: () => null,
    subscribe: () => () => {},
    setUuid: vi.fn(),
  }),
  useIsClimbSelected: () => false,
}));

vi.mock('../climbs-list.module.css', () => ({
  default: { gridItem: 'gridItem', listItem: 'listItem' },
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 16: 64 },
    colors: { error: '#B8524C', primary: '#8C4A52', success: '#6B9080' },
    neutral: { 200: '#E5E7EB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563' },
    typography: {
      fontSize: { xs: 12, sm: 14, base: 16, xl: 20, '2xl': 24 },
      fontWeight: { normal: 400, semibold: 600, bold: 700 },
    },
    layout: { bottomNavSpacer: 80 },
  },
}));

// Track calls to useWindowVirtualizer
let lastVirtualizerOpts: { count: number } | null = null;

vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: (opts: { count: number; estimateSize: () => number; overscan: number; getItemKey: (i: number) => string | number }) => {
    lastVirtualizerOpts = opts;
    const itemCount = Math.min(15, opts.count);
    const items = Array.from({ length: itemCount }, (_, i) => ({
      index: i,
      key: opts.getItemKey ? opts.getItemKey(i) : `item-${i}`,
      start: i * 72,
      size: 72,
      end: (i + 1) * 72,
      lane: 0,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => opts.count * 72,
      measureElement: vi.fn(),
      scrollToIndex: vi.fn(),
    };
  },
}));

import ClimbsList from '../climbs-list';

// --- Helpers ---

function makeClimb(index: number): Climb {
  return {
    uuid: `climb-${index}`,
    name: `Test Boulder ${index}`,
    setter_username: 'setter',
    description: '',
    frames: `p${index}r14`,
    angle: 40,
    ascensionist_count: 5,
    difficulty: 'V4',
    quality_average: '3.0',
    stars: 0,
    difficulty_error: '0.5',
    benchmark_difficulty: null,
  };
}

function makeBoardDetails(): BoardDetails {
  return {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: [1],
    images_to_holds: {},
    holdsData: [],
    edge_left: 0,
    edge_right: 100,
    edge_bottom: 0,
    edge_top: 100,
    boardHeight: 100,
    boardWidth: 100,
  } as BoardDetails;
}

const allClimbs = Array.from({ length: 100 }, (_, i) => makeClimb(i));

describe('ClimbsList virtualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastVirtualizerOpts = null;
  });

  it('renders only virtual items in list mode (not all 100)', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('climb-list-item');
    expect(items.length).toBeLessThanOrEqual(15);
    expect(items.length).toBeGreaterThan(0);
  });

  it('virtual items map to correct climb data', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('climb-list-item');
    expect(items[0].getAttribute('data-uuid')).toBe('climb-0');
    expect(items[0].textContent).toBe('Test Boulder 0');
  });

  it('passes correct count to the virtualizer', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={allClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    // The virtualizer should receive the full climb count
    expect(lastVirtualizerOpts).not.toBeNull();
    expect(lastVirtualizerOpts!.count).toBe(100);
  });

  it('renders skeleton when fetching with no climbs', () => {
    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={[]}
        isFetching={true}
        hasMore={true}
        onLoadMore={vi.fn()}
      />,
    );

    const skeletons = screen.getAllByTestId('climb-list-item-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('with small climb list, renders all items', () => {
    const fiveClimbs = allClimbs.slice(0, 5);

    render(
      <ClimbsList
        boardDetails={makeBoardDetails()}
        climbs={fiveClimbs}
        isFetching={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('climb-list-item');
    expect(items).toHaveLength(5);
  });
});

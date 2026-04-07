// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Climb, BoardDetails } from '@/app/lib/types';
import type { ClimbQueueItem } from '../types';

// --- Mock data ---

function makeClimb(index: number): Climb {
  return {
    uuid: `suggested-${index}`,
    name: `Suggested Boulder ${index}`,
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

const suggestedClimbs = Array.from({ length: 20 }, (_, i) => makeClimb(i));

const mockQueueItems: ClimbQueueItem[] = [
  {
    uuid: 'queue-1',
    climb: {
      uuid: 'climb-q1',
      name: 'Queue Climb 1',
      setter_username: 'setter_q',
      description: '',
      frames: 'p3r16',
      angle: 40,
      ascensionist_count: 12,
      difficulty: 'V4',
      quality_average: '3.5',
      stars: 0,
      difficulty_error: '0.4',
      benchmark_difficulty: null,
    },
  },
  {
    uuid: 'queue-2',
    climb: {
      uuid: 'climb-q2',
      name: 'Queue Climb 2',
      setter_username: 'setter_q',
      description: '',
      frames: 'p4r17',
      angle: 40,
      ascensionist_count: 8,
      difficulty: 'V5',
      quality_average: '4.0',
      stars: 0,
      difficulty_error: '0.3',
      benchmark_difficulty: null,
    },
  },
];

// --- Mocks ---

vi.mock('../../graphql-queue', () => ({
  useCurrentClimbUuid: () => null,
  useQueueList: () => ({
    queue: mockQueueItems,
    suggestedClimbs,
  }),
  useSearchData: () => ({
    hasMoreResults: false,
    isFetchingClimbs: false,
    isFetchingNextPage: false,
  }),
  useSessionData: () => ({
    viewOnlyMode: false,
  }),
  useQueueActions: () => ({
    fetchMoreClimbs: vi.fn(),
    setCurrentClimbQueueItem: vi.fn(),
    setQueue: vi.fn(),
    addToQueue: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/kilter/original/12x12/default/40/play/some-climb',
}));

vi.mock('@/app/hooks/use-is-dark-mode', () => ({
  useIsDarkMode: () => false,
}));

vi.mock('../../board-provider/board-provider-context', () => ({
  useOptionalBoardProvider: () => null,
}));

vi.mock('@/app/components/providers/auth-modal-provider', () => ({
  useAuthModal: () => ({
    openAuthModal: vi.fn(),
  }),
}));

// Mock child components as simple stubs
vi.mock('../queue-climb-list-item', () => ({
  default: ({ item }: { item: ClimbQueueItem }) => (
    <div data-testid="queue-climb-list-item" data-uuid={item.uuid}>
      {item.climb.name}
    </div>
  ),
}));

vi.mock('../../climb-card/climb-list-item', () => ({
  default: ({ climb }: { climb: Climb }) => (
    <div data-testid="climb-list-item" data-uuid={climb.uuid}>
      {climb.name}
    </div>
  ),
}));

vi.mock('../../climb-card/drawer-climb-header', () => ({
  default: () => <div data-testid="drawer-climb-header" />,
}));

vi.mock('../../swipeable-drawer/swipeable-drawer', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="swipeable-drawer">{children}</div>
  ),
}));

vi.mock('../../climb-actions', () => ({
  ClimbActions: () => <div data-testid="climb-actions" />,
}));

vi.mock('../../climb-actions/playlist-selection-content', () => ({
  default: () => <div data-testid="playlist-selection-content" />,
}));

vi.mock('../../logbook/log-ascent-drawer', () => ({
  LogAscentDrawer: () => <div data-testid="log-ascent-drawer" />,
}));

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  monitorForElements: () => () => {},
}));

vi.mock('@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge', () => ({
  extractClosestEdge: () => null,
}));

vi.mock('@atlaskit/pragmatic-drag-and-drop/reorder', () => ({
  reorder: ({ list }: { list: unknown[] }) => list,
}));

vi.mock('@/app/lib/climb-action-utils', () => ({
  getExcludedClimbActions: () => [],
}));

vi.mock('../../board-page/constants', () => ({
  SUGGESTIONS_THRESHOLD: 5,
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 16: 64 },
    colors: { error: '#B8524C', primary: '#8C4A52', success: '#6B9080' },
    neutral: { 200: '#E5E7EB', 400: '#9CA3AF', 500: '#6B7280' },
    typography: {
      fontSize: { xs: 12, sm: 14, base: 16, xl: 20, '2xl': 24 },
      fontWeight: { normal: 400, semibold: 600, bold: 700 },
    },
  },
}));

vi.mock('../queue-list.module.css', () => ({
  default: {
    queueColumn: 'queueColumn',
    suggestedSectionHeader: 'suggestedSectionHeader',
    suggestedColumn: 'suggestedColumn',
    suggestedItem: 'suggestedItem',
    historyDivider: 'historyDivider',
    loadMoreContainer: 'loadMoreContainer',
    loadMoreSkeletonRow: 'loadMoreSkeletonRow',
    noMoreSuggestions: 'noMoreSuggestions',
  },
}));

// Mock @tanstack/react-virtual to make tests deterministic in jsdom
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; getItemKey?: (i: number) => string | number }) => {
    const items = Array.from({ length: opts.count }, (_, i) => ({
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

// Stub IntersectionObserver for jsdom
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
});

import QueueList from '../queue-list';

// --- Helpers ---

function makeBoardDetails(): BoardDetails {
  return {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: '1',
    images_to_holds: {},
    holdsData: [],
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
    boardHeight: 100,
    boardWidth: 100,
  } as unknown as BoardDetails;
}

describe('QueueList rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all suggested climbs when active', () => {
    render(<QueueList boardDetails={makeBoardDetails()} active={true} />);

    // All 20 suggested ClimbListItems should be in the DOM
    const suggestedItems = screen.getAllByTestId('climb-list-item');
    expect(suggestedItems).toHaveLength(20);

    // Verify first and last suggested climb data
    expect(suggestedItems[0].getAttribute('data-uuid')).toBe('suggested-0');
    expect(suggestedItems[0].textContent).toBe('Suggested Boulder 0');
    expect(suggestedItems[19].getAttribute('data-uuid')).toBe('suggested-19');
    expect(suggestedItems[19].textContent).toBe('Suggested Boulder 19');
  });

  it('queue items always render regardless of active prop', () => {
    render(<QueueList boardDetails={makeBoardDetails()} active={false} />);

    // All queue items should be rendered even when active=false
    const queueItems = screen.getAllByTestId('queue-climb-list-item');
    expect(queueItems).toHaveLength(2);
    expect(screen.getByText('Queue Climb 1')).toBeTruthy();
    expect(screen.getByText('Queue Climb 2')).toBeTruthy();

    // No suggested items should render when active=false
    expect(screen.queryAllByTestId('climb-list-item')).toHaveLength(0);
  });

  it('renders suggestions section header when active', () => {
    render(<QueueList boardDetails={makeBoardDetails()} active={true} />);

    expect(screen.getByText('Suggestions')).toBeTruthy();
  });

  it('does not render suggestions section when active is false', () => {
    render(<QueueList boardDetails={makeBoardDetails()} active={false} />);

    expect(screen.queryByText('Suggestions')).toBeNull();
    expect(screen.queryAllByTestId('climb-list-item')).toHaveLength(0);

    // Queue items still render
    const queueItems = screen.getAllByTestId('queue-climb-list-item');
    expect(queueItems).toHaveLength(2);
  });
});

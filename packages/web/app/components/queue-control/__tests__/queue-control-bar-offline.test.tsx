import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// -- All mocks before imports --

const mockShowMessage = vi.fn();
vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: mockShowMessage }),
}));

let mockQueueContext: Record<string, unknown> = {};
vi.mock('@/app/components/graphql-queue', () => ({
  useQueueContext: () => mockQueueContext,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/kilter/1/1/1/40',
  useParams: () => ({ board_name: 'kilter', layout_id: '1', size_id: '1', set_ids: '1', angle: '40' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('a', props, children),
}));

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

vi.mock('@/app/hooks/use-card-swipe-navigation', () => ({
  useCardSwipeNavigation: () => ({
    swipeHandlers: {},
    swipeOffset: 0,
    isAnimating: false,
    navigateToNext: vi.fn(),
    navigateToPrev: vi.fn(),
    peekIsNext: true,
    exitOffset: 0,
    enterDirection: null,
    clearEnterAnimation: vi.fn(),
  }),
  EXIT_DURATION: 300,
  SNAP_BACK_DURATION: 200,
  ENTER_ANIMATION_DURATION: 300,
}));

vi.mock('@/app/hooks/use-color-mode', () => ({
  useColorMode: () => ({ mode: 'light' }),
}));

vi.mock('@/app/lib/grade-colors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/grade-colors')>();
  return {
    ...actual,
    getGradeTintColor: () => null,
  };
});

vi.mock('@/app/components/climb-card/climb-thumbnail', () => ({
  default: () => React.createElement('div', { 'data-testid': 'climb-thumbnail' }),
}));

vi.mock('@/app/components/climb-card/climb-title', () => ({
  default: () => React.createElement('div', { 'data-testid': 'climb-title' }),
}));

vi.mock('@/app/components/queue-control/queue-list', () => ({
  default: React.forwardRef(() => React.createElement('div', { 'data-testid': 'queue-list' })),
}));

vi.mock('@/app/components/queue-control/next-climb-button', () => ({
  default: () => React.createElement('button', { 'data-testid': 'next-climb' }),
}));

vi.mock('@/app/components/queue-control/previous-climb-button', () => ({
  default: () => React.createElement('button', { 'data-testid': 'prev-climb' }),
}));

vi.mock('@/app/components/logbook/tick-button', () => ({
  TickButton: () => React.createElement('button', { 'data-testid': 'tick-button' }),
}));

vi.mock('@/app/components/board-page/share-button', () => ({
  ShareBoardButton: () => null,
}));

vi.mock('@/app/components/play-view/play-view-drawer', () => ({
  default: () => null,
}));

vi.mock('@/app/components/onboarding/onboarding-tour', () => ({
  TOUR_DRAWER_EVENT: 'tour-drawer',
}));

vi.mock('@/app/components/ui/confirm-popover', () => ({
  ConfirmPopover: () => null,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'unauthenticated', data: null }),
}));

vi.mock('@/app/components/persistent-session', () => ({
  usePersistentSession: () => ({
    activeSession: null,
    localBoardDetails: null,
    localCurrentClimbQueueItem: null,
  }),
}));

vi.mock('@/app/components/board-bluetooth-control/bluetooth-context', () => ({
  useBluetoothContext: () => ({
    isConnected: false,
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendLedUpdate: vi.fn(),
  }),
}));

// Import after mocks
import QueueControlBar from '../queue-control-bar';

const mockClimb = {
  uuid: 'climb-1',
  setter_username: 'setter1',
  name: 'Test Climb',
  description: '',
  frames: '',
  angle: 40,
  ascensionist_count: 5,
  difficulty: '7',
  quality_average: '3.5',
  stars: 3,
  difficulty_error: '',
  mirrored: false,
  benchmark_difficulty: null,
  userAscents: 0,
  userAttempts: 0,
};

const baseQueueContext = {
  queue: [{ uuid: 'item-1', climb: mockClimb, addedBy: 'user-1', suggested: false }],
  currentClimbQueueItem: { uuid: 'item-1', climb: mockClimb, addedBy: 'user-1', suggested: false },
  currentClimb: mockClimb,
  climbSearchResults: [],
  suggestedClimbs: [],
  isFetchingClimbs: false,
  isFetchingNextPage: false,
  hasDoneFirstFetch: true,
  viewOnlyMode: false,
  parsedParams: { board_name: 'kilter', layout_id: '1', size_id: '1', set_ids: ['1'], angle: '40' },
  connectionState: 'connected',
  sessionId: 'session-1',
  canMutate: true,
  isDisconnected: false,
  endSession: vi.fn(),
  disconnect: vi.fn(),
  addToQueue: vi.fn(),
  removeFromQueue: vi.fn(),
  setCurrentClimb: vi.fn(),
  setCurrentClimbQueueItem: vi.fn(),
  setClimbSearchParams: vi.fn(),
  setCountSearchParams: vi.fn(),
  mirrorClimb: vi.fn(),
  fetchMoreClimbs: vi.fn(),
  getNextClimbQueueItem: vi.fn().mockReturnValue(null),
  getPreviousClimbQueueItem: vi.fn().mockReturnValue(null),
  setQueue: vi.fn(),
};

const defaultProps = {
  angle: '40' as unknown as number,
  boardDetails: {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 1,
    set_ids: '1',
    images_to_holds: {},
    layout_name: 'Original',
    size_name: '12x12',
    size_description: 'Standard',
    set_names: ['Base'],
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
  } as never,
  activeDrawer: 'none' as const,
  setActiveDrawer: vi.fn(),
};

describe('QueueControlBar offline UI', () => {
  beforeEach(() => {
    mockQueueContext = { ...baseQueueContext };
  });

  it('renders normal controls when online with active session', () => {
    render(<QueueControlBar {...defaultProps} />);

    expect(screen.queryByText(/Reconnecting/)).toBeNull();
    expect(screen.queryByText(/Offline/i)).toBeNull();
  });

  it('shows reconnecting view when online but WebSocket reconnecting', () => {
    mockQueueContext = {
      ...baseQueueContext,
      connectionState: 'reconnecting',
      isDisconnected: false,
    };

    render(<QueueControlBar {...defaultProps} />);

    expect(screen.getByText(/Reconnecting/)).toBeTruthy();
  });

  it('shows offline indicator (not reconnecting view) when offline in party mode', () => {
    mockQueueContext = {
      ...baseQueueContext,
      connectionState: 'reconnecting',
      isDisconnected: true,
    };

    render(<QueueControlBar {...defaultProps} />);

    // Should NOT show the reconnecting spinner view
    expect(screen.queryByText(/Reconnecting/)).toBeNull();
    // Should show the offline indicator
    expect(screen.getByText(/Offline/i)).toBeTruthy();
  });

  it('shows normal controls when offline in solo mode (no session)', () => {
    mockQueueContext = {
      ...baseQueueContext,
      connectionState: 'idle',
      sessionId: null,
      isDisconnected: false,
    };

    render(<QueueControlBar {...defaultProps} />);

    expect(screen.queryByText(/Reconnecting/)).toBeNull();
  });
});

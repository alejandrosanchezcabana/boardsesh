import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

// -- All mocks before imports --

const mockShowMessage = vi.fn();
vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: mockShowMessage }),
}));

let mockQueueContext: Record<string, unknown> = {};
vi.mock('@/app/components/graphql-queue', () => ({
  useQueueContext: () => mockQueueContext,
  useQueueData: () => mockQueueContext,
  useQueueActions: () => mockQueueContext,
  useCurrentClimb: () => ({ currentClimb: (mockQueueContext as Record<string, unknown>).currentClimb }),
  useQueueList: () => ({ queue: (mockQueueContext as Record<string, unknown>).queue, suggestedClimbs: [] }),
  useSessionData: () => ({
    viewOnlyMode: (mockQueueContext as Record<string, unknown>).viewOnlyMode ?? false,
    isSessionActive: !!(mockQueueContext as Record<string, unknown>).sessionId,
    sessionId: (mockQueueContext as Record<string, unknown>).sessionId ?? null,
    sessionSummary: null,
    sessionGoal: null,
    connectionState: (mockQueueContext as Record<string, unknown>).connectionState ?? 'idle',
    canMutate: (mockQueueContext as Record<string, unknown>).canMutate ?? true,
    isDisconnected: (mockQueueContext as Record<string, unknown>).isDisconnected ?? false,
    users: (mockQueueContext as Record<string, unknown>).users ?? [],
    clientId: null,
    isLeader: true,
    isBackendMode: false,
    hasConnected: true,
    connectionError: null,
  }),
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
  usePersistentSessionState: () => ({
    activeSession: null,
    localBoardDetails: null,
    localCurrentClimbQueueItem: null,
  }),
  usePersistentSessionActions: () => ({}),
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

// Mock isNativeApp
const mockIsNativeApp = vi.fn();
vi.mock('@/app/lib/ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
}));

// Mock the native tab bar plugin module (including overlay helpers)
const mockAddNativeOverlay = vi.fn();
const mockRemoveNativeOverlay = vi.fn();

vi.mock('@/app/lib/native-tab-bar/native-tab-bar-plugin', () => ({
  getNativeTabBarPlugin: () => null,
  addNativeOverlay: () => mockAddNativeOverlay(),
  removeNativeOverlay: () => mockRemoveNativeOverlay(),
  _resetOverlayCountForTesting: vi.fn(),
}));

// Import after all mocks
import QueueControlBar from '../queue-control-bar';
import { dispatchOpenPlayDrawer } from '../play-drawer-event';

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
  users: [{ id: 'me', username: 'me', isLeader: true }, { id: 'other', username: 'other', isLeader: false }],
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
};

describe('QueueControlBar native tab bar integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueContext = { ...baseQueueContext };
    mockIsNativeApp.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('calls addNativeOverlay() when activeDrawer changes to "play"', async () => {
    render(<QueueControlBar {...defaultProps} />);

    await act(async () => {
      dispatchOpenPlayDrawer();
    });

    expect(mockAddNativeOverlay).toHaveBeenCalled();
  });

  it('calls addNativeOverlay() when activeDrawer changes to "queue" via tour event', async () => {
    render(<QueueControlBar {...defaultProps} />);

    mockAddNativeOverlay.mockClear();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('tour-drawer', { detail: { open: true } }));
    });

    expect(mockAddNativeOverlay).toHaveBeenCalled();
  });

  it('calls removeNativeOverlay() when activeDrawer returns to "none"', async () => {
    render(<QueueControlBar {...defaultProps} />);

    // Open a drawer first
    await act(async () => {
      dispatchOpenPlayDrawer();
    });

    expect(mockAddNativeOverlay).toHaveBeenCalled();
    mockRemoveNativeOverlay.mockClear();

    // Close via tour close event (resets to 'none')
    await act(async () => {
      window.dispatchEvent(new CustomEvent('tour-drawer', { detail: { open: false } }));
    });

    expect(mockRemoveNativeOverlay).toHaveBeenCalled();
  });

  it('addNativeOverlay is NOT called when isNativeApp() returns false', async () => {
    mockIsNativeApp.mockReturnValue(false);

    render(<QueueControlBar {...defaultProps} />);

    await act(async () => {
      dispatchOpenPlayDrawer();
    });

    expect(mockAddNativeOverlay).not.toHaveBeenCalled();
  });

  it('does not throw when getNativeTabBarPlugin() returns null', async () => {
    expect(() => {
      render(<QueueControlBar {...defaultProps} />);
    }).not.toThrow();

    await act(async () => {
      dispatchOpenPlayDrawer();
    });

    // Test passes if we reach here without error
    expect(mockAddNativeOverlay).toHaveBeenCalled();
  });

  it('calls removeNativeOverlay() on unmount when a drawer is open', async () => {
    const { unmount } = render(<QueueControlBar {...defaultProps} />);

    await act(async () => {
      dispatchOpenPlayDrawer();
    });

    mockRemoveNativeOverlay.mockClear();
    unmount();

    expect(mockRemoveNativeOverlay).toHaveBeenCalled();
  });
});

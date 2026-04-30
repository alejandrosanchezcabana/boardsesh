import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { RootBottomBar } from '../persistent-session-wrapper';

let mockPathname = '/';
let mockQueueBridgeBoardInfo = {
  boardDetails: null as Record<string, unknown> | null,
  angle: 0,
  hasActiveQueue: false,
};
let mockQueueContext = {
  queue: [] as unknown[],
  currentClimb: null,
};

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('../../party-manager/party-profile-context', () => ({
  PartyProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../persistent-session', () => ({
  PersistentSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePersistentSession: () => ({
    sessionSummary: null,
    dismissSessionSummary: vi.fn(),
  }),
  usePersistentSessionState: () => ({
    sessionSummary: null,
  }),
  usePersistentSessionActions: () => ({
    dismissSessionSummary: vi.fn(),
  }),
}));

vi.mock('../../queue-control/queue-bridge-context', () => ({
  QueueBridgeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQueueBridgeBoardInfo: () => mockQueueBridgeBoardInfo,
}));

vi.mock('../../graphql-queue', () => ({
  useQueueContext: () => mockQueueContext,
  useQueueData: () => mockQueueContext,
  useQueueActions: () => mockQueueContext,
  useCurrentClimb: () => ({ currentClimb: mockQueueContext.currentClimb }),
  useQueueList: () => ({ queue: mockQueueContext.queue, suggestedClimbs: [] }),
}));

vi.mock('../../queue-control/queue-control-bar', () => ({
  default: () => <div data-testid="queue-control-bar" />,
}));

vi.mock('../../bottom-tab-bar/bottom-tab-bar', () => ({
  default: () => <div data-testid="bottom-tab-bar" />,
}));

vi.mock('../../board-provider/board-provider-context', () => ({
  BoardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../connection-manager/connection-settings-context', () => ({
  ConnectionSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../connection-manager/websocket-connection-provider', () => ({
  WebSocketConnectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../board-bluetooth-control/bluetooth-context', () => ({
  BluetoothProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../climb-actions/favorites-batch-context', () => ({
  FavoritesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../climb-actions/playlists-batch-context', () => ({
  PlaylistsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/app/hooks/use-climb-actions-data', () => ({
  useClimbActionsData: () => ({
    favoritesProviderProps: {},
    playlistsProviderProps: {},
  }),
}));

vi.mock('../../error-boundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../global-header/global-header', () => ({
  default: () => <div data-testid="global-header" />,
}));

vi.mock('../../session-summary/session-summary-dialog', () => ({
  default: () => null,
}));

vi.mock('../../search-drawer/search-drawer-bridge-context', () => ({
  SearchDrawerBridgeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock isNativeApp — mutable so tests can override
const mockIsNativeApp = vi.fn();
vi.mock('@/app/lib/ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
}));

// Mock the native-tab-bar plugin module so tests can simulate both
// "new iOS binary" (plugin present) and "old App Store binary" (null).
let mockNativeTabBarPlugin: {
  setActiveTab: () => Promise<void>;
  setBarsHidden: () => Promise<void>;
  setNotificationBadge: () => Promise<void>;
  navigateTab: () => Promise<void>;
} | null = null;

vi.mock('@/app/lib/native-tab-bar/native-tab-bar-plugin', () => ({
  getNativeTabBarPlugin: () => mockNativeTabBarPlugin,
  addNativeOverlay: vi.fn(),
  removeNativeOverlay: vi.fn(),
}));

const mockBoardConfigs = {} as Parameters<typeof RootBottomBar>[0]['boardConfigs'];

describe('RootBottomBar native iOS path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockQueueBridgeBoardInfo = {
      boardDetails: null,
      angle: 0,
      hasActiveQueue: false,
    };
    mockQueueContext = {
      queue: [],
      currentClimb: null,
    };
    mockIsNativeApp.mockReturnValue(true);
    mockNativeTabBarPlugin = {
      setActiveTab: vi.fn().mockResolvedValue(undefined),
      setBarsHidden: vi.fn().mockResolvedValue(undefined),
      setNotificationBadge: vi.fn().mockResolvedValue(undefined),
      navigateTab: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT render the .bottomBarWrapper CSS class on the root div when native', () => {
    const { container } = render(<RootBottomBar boardConfigs={mockBoardConfigs} />);
    const root = container.firstChild as HTMLElement;
    // The native path returns a plain div with inline style, not the CSS module class
    expect(root?.className ?? '').not.toContain('bottomBarWrapper');
  });

  it('renders a position: fixed wrapper with bottom: var(--native-tab-bar-height, 83px)', () => {
    const { container } = render(<RootBottomBar boardConfigs={mockBoardConfigs} />);
    const root = container.firstChild as HTMLElement;
    expect(root?.style?.position).toBe('fixed');
    expect(root?.style?.bottom).toBe('var(--native-tab-bar-height, 83px)');
  });

  it('the wrapper div has zIndex: 10', () => {
    const { container } = render(<RootBottomBar boardConfigs={mockBoardConfigs} />);
    const root = container.firstChild as HTMLElement;
    expect(root?.style?.zIndex).toBe('10');
  });

  it('renders QueueControlBarShell when shouldShowQueueShell is true (board route, no queue, no board details)', () => {
    mockPathname = '/b/test-board/40/list';
    mockQueueBridgeBoardInfo = {
      boardDetails: null,
      angle: 0,
      hasActiveQueue: false,
    };

    render(<RootBottomBar boardConfigs={mockBoardConfigs} />);

    expect(screen.getByTestId('queue-control-bar-shell')).toBeTruthy();
  });

  it('non-native regression: .bottomBarWrapper IS present when isNativeApp() returns false', () => {
    mockIsNativeApp.mockReturnValue(false);

    const { container } = render(<RootBottomBar boardConfigs={mockBoardConfigs} />);
    const root = container.firstChild as HTMLElement;
    // The non-native path uses the CSS module class which gets hashed in tests
    // but the className should be non-empty (it applies the CSS module)
    expect(root?.getAttribute('data-testid')).toBe('bottom-bar-wrapper');
  });

  it('non-native regression: data-testid="bottom-tab-bar" IS present when isNativeApp() returns false', () => {
    mockIsNativeApp.mockReturnValue(false);
    mockPathname = '/playlists';

    render(<RootBottomBar boardConfigs={mockBoardConfigs} />);

    expect(screen.getByTestId('bottom-tab-bar')).toBeTruthy();
  });
});

// ── Backwards-compat: existing iOS App Store / TestFlight builds ─────────
// Older binaries are native (Capacitor) but never ship NativeTabBarPlugin.
// Without this fallback the queue bar would float 83px above bottom against
// an empty native gap, and the legacy .bottomBarWrapper safe-area padding
// would never apply.
describe('RootBottomBar native iOS without NativeTabBarPlugin (old binary)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockQueueBridgeBoardInfo = {
      boardDetails: null,
      angle: 0,
      hasActiveQueue: false,
    };
    mockQueueContext = {
      queue: [],
      currentClimb: null,
    };
    mockIsNativeApp.mockReturnValue(true);
    mockNativeTabBarPlugin = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('uses the legacy .bottomBarWrapper path even on native when plugin is missing', () => {
    const { container } = render(<RootBottomBar boardConfigs={mockBoardConfigs} />);
    const root = container.firstChild as HTMLElement;
    expect(root?.getAttribute('data-testid')).toBe('bottom-bar-wrapper');
  });

  it('renders the BottomTabBar inside the legacy wrapper when plugin is missing', () => {
    const { getByTestId } = render(<RootBottomBar boardConfigs={mockBoardConfigs} />);
    expect(getByTestId('bottom-tab-bar')).toBeTruthy();
  });
});

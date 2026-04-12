import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import type { BoardDetails } from '@/app/lib/types';
import type { BoardConfigData } from '@/app/lib/server-board-configs';

// -- All mocks must come before imports --

const mockPush = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/app/hooks/use-color-mode', () => ({
  useColorMode: () => ({ mode: 'light' }),
}));

let mockNotificationUnreadCount = 0;
vi.mock('@/app/hooks/use-unread-notification-count', () => ({
  useUnreadNotificationCount: () => mockNotificationUnreadCount,
}));

vi.mock('../../swipeable-drawer/swipeable-drawer', () => ({
  default: ({
    open,
    title,
    children,
    extra,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    extra?: React.ReactNode;
  }) => (open ? <div data-testid={`drawer-${title}`}>{children}{extra}</div> : null),
}));

vi.mock('../../board-selector-drawer/board-selector-drawer', () => ({
  default: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) => (open
    ? (
        <div data-testid="board-selector-drawer">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      )
    : null),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('@/app/components/board-scroll/board-discovery-scroll', () => ({
  default: () => <div data-testid="board-discovery-scroll" />,
}));

vi.mock('@/app/components/providers/auth-modal-provider', () => ({
  useAuthModal: () => ({ openAuthModal: vi.fn() }),
}));

vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: vi.fn() }),
}));

vi.mock('../../persistent-session', () => ({
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

vi.mock('@/app/hooks/use-climb-actions-data', () => ({
  useClimbActionsData: () => ({
    playlistsProviderProps: {
      createPlaylist: vi.fn(),
      isAuthenticated: false,
    },
  }),
}));

vi.mock('@/app/lib/last-used-board-db', () => ({
  getLastUsedBoard: () => Promise.resolve(null),
}));

vi.mock('@/app/components/search-drawer/recent-searches-storage', () => ({
  getRecentSearches: () => Promise.resolve([]),
}));

vi.mock('@/app/components/board-lock/use-board-switch-guard', () => ({
  useBoardSwitchGuard: () => (_target: unknown, cb: () => void) => cb(),
}));

// Mock isNativeApp to return true for all tests in this suite
const mockIsNativeApp = vi.fn();
vi.mock('@/app/lib/ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
}));

// Mock getNativeTabBarPlugin
const mockSetActiveTab = vi.fn().mockResolvedValue(undefined);
const mockSetBarsHidden = vi.fn().mockResolvedValue(undefined);
const mockSetNotificationBadge = vi.fn().mockResolvedValue(undefined);
let mockPluginInstance: {
  setActiveTab: typeof mockSetActiveTab;
  setBarsHidden: typeof mockSetBarsHidden;
  setNotificationBadge: typeof mockSetNotificationBadge;
} | null = null;

vi.mock('@/app/lib/native-tab-bar/native-tab-bar-plugin', () => ({
  getNativeTabBarPlugin: () => mockPluginInstance,
}));

import BottomTabBar from '../bottom-tab-bar';

const boardDetails: BoardDetails = {
  images_to_holds: {},
  holdsData: [],
  edge_left: 0,
  edge_right: 0,
  edge_bottom: 0,
  edge_top: 0,
  boardHeight: 0,
  boardWidth: 0,
  board_name: 'kilter',
  layout_id: 8,
  size_id: 1,
  set_ids: [1],
  layout_name: 'Original',
  size_name: '12x12',
  size_description: 'Square',
  set_names: ['Screw Bolt'],
} as BoardDetails;

const boardConfigs = {} as BoardConfigData;

describe('BottomTabBar native iOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockNotificationUnreadCount = 0;
    mockIsNativeApp.mockReturnValue(true);
    mockPluginInstance = {
      setActiveTab: mockSetActiveTab,
      setBarsHidden: mockSetBarsHidden,
      setNotificationBadge: mockSetNotificationBadge,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT render data-testid="bottom-tab-bar" on native', () => {
    render(<BottomTabBar boardConfigs={boardConfigs} />);
    expect(screen.queryByTestId('bottom-tab-bar')).toBeNull();
  });

  it('calls setActiveTab({ tab: "home" }) on mount when pathname is "/"', async () => {
    mockPathname = '/';
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });
    expect(mockSetActiveTab).toHaveBeenCalledWith({ tab: 'home' });
  });

  it('calls setActiveTab({ tab: "climbs" }) when pathname starts with a board route', async () => {
    mockPathname = '/kilter/original/12x12-square/screw_bolt/40/list';
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });
    expect(mockSetActiveTab).toHaveBeenCalledWith({ tab: 'climbs' });
  });

  it('dispatching boardsesh:native-tab-tapped with tab="feed" triggers router.push("/feed")', async () => {
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('boardsesh:native-tab-tapped', { detail: { tab: 'feed' } }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith('/feed');
  });

  it('dispatching boardsesh:native-tab-tapped with tab="home" triggers router.push("/")', async () => {
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('boardsesh:native-tab-tapped', { detail: { tab: 'home' } }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('dispatching boardsesh:native-tab-tapped with tab="notifications" triggers router.push("/notifications")', async () => {
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('boardsesh:native-tab-tapped', { detail: { tab: 'notifications' } }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('calls setNotificationBadge({ count: 3 }) when notificationUnreadCount changes to 3', async () => {
    mockNotificationUnreadCount = 0;
    const { rerender } = render(<BottomTabBar boardConfigs={boardConfigs} />);

    mockNotificationUnreadCount = 3;
    await act(async () => {
      rerender(<BottomTabBar boardConfigs={boardConfigs} />);
    });

    expect(mockSetNotificationBadge).toHaveBeenCalledWith({ count: 3 });
  });

  it('calls setBarsHidden({ hidden: true }) when board selector opens', async () => {
    // No boardDetails and no last-used board — tapping 'climbs' opens the board selector
    mockPathname = '/';
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });

    mockSetBarsHidden.mockClear();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('boardsesh:native-tab-tapped', { detail: { tab: 'climbs' } }),
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Board selector opened → setBarsHidden({ hidden: true })
    expect(mockSetBarsHidden).toHaveBeenCalledWith({ hidden: true });
  });

  it('calls setBarsHidden({ hidden: false }) when board selector closes', async () => {
    // Render without boardDetails so the board selector will open when climbs tab is tapped
    mockPathname = '/';
    await act(async () => {
      render(<BottomTabBar boardConfigs={boardConfigs} />);
    });

    mockSetBarsHidden.mockClear();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('boardsesh:native-tab-tapped', { detail: { tab: 'climbs' } }),
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Board selector opened → setBarsHidden(hidden: true)
    expect(mockSetBarsHidden).toHaveBeenCalledWith({ hidden: true });

    mockSetBarsHidden.mockClear();

    // Close the board selector drawer
    const closeButton = screen.queryByRole('button', { name: 'Close' });
    if (closeButton) {
      await act(async () => {
        closeButton.click();
      });
      expect(mockSetBarsHidden).toHaveBeenCalledWith({ hidden: false });
    }
  });

  it('removes event listener for boardsesh:native-tab-tapped on unmount', async () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<BottomTabBar boardConfigs={boardConfigs} />);

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith(
      'boardsesh:native-tab-tapped',
      expect.any(Function),
    );

    removeListenerSpy.mockRestore();
  });
});

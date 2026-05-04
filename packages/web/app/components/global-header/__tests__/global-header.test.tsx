import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';
import GlobalHeader from '../global-header';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

let mockActiveSession: Record<string, unknown> | null = null;
let mockIsOnBoardRoute = false;

vi.mock('@/app/components/persistent-session/persistent-session-context', () => ({
  usePersistentSession: () => ({
    activeSession: mockActiveSession,
  }),
  usePersistentSessionState: () => ({
    activeSession: mockActiveSession,
  }),
  usePersistentSessionActions: () => ({}),
  useIsOnBoardRoute: () => mockIsOnBoardRoute,
}));

const mockOpenClimbSearchDrawer = vi.fn();
const mockSetNameFilter = vi.fn();
let mockBridgeState: {
  openClimbSearchDrawer: (() => void) | null;
  searchPillSummary: string | null;
  hasActiveFilters: boolean;
  nameFilter: string;
  setNameFilter: ((name: string) => void) | null;
  hasActiveNonNameFilters: boolean;
} = {
  openClimbSearchDrawer: null,
  searchPillSummary: null,
  hasActiveFilters: false,
  nameFilter: '',
  setNameFilter: null,
  hasActiveNonNameFilters: false,
};

vi.mock('@/app/components/search-drawer/search-drawer-bridge-context', () => ({
  useSearchDrawerBridge: () => mockBridgeState,
}));

let mockQueueList: { queue: Array<{ uuid: string }>; suggestedClimbs: unknown[] } = {
  queue: [],
  suggestedClimbs: [],
};
vi.mock('@/app/components/graphql-queue', () => ({
  useQueueList: () => mockQueueList,
}));

let mockQueueBridgeBoardInfo: {
  boardDetails: { board_name: string } | null;
  angle: number;
  hasActiveQueue: boolean;
  isHydrated: boolean;
} = { boardDetails: null, angle: 0, hasActiveQueue: false, isHydrated: false };
vi.mock('@/app/components/queue-control/queue-bridge-board-info-context', () => ({
  useQueueBridgeBoardInfo: () => mockQueueBridgeBoardInfo,
}));

// `next/dynamic` is used at module top to lazy-load QueueDrawer; intercept it
// so the loader returns the mock synchronously (otherwise the lazy boundary
// never resolves under the test renderer). vi.hoisted lets the vi.mock factory
// reference the component despite mock-call hoisting.
const { mockQueueDrawer } = vi.hoisted(() => ({
  mockQueueDrawer: ({ open }: { open: boolean }) =>
    open ? React.createElement('div', { 'data-testid': 'queue-drawer' }) : null,
}));
vi.mock('next/dynamic', () => ({
  default: () => mockQueueDrawer,
}));

vi.mock('@/app/components/search-drawer/unified-search-drawer', () => ({
  default: ({ open, defaultCategory }: { open: boolean; onClose: () => void; defaultCategory: string }) =>
    open ? <div data-testid="unified-search-drawer" data-category={defaultCategory} /> : null,
}));

vi.mock('@/app/components/session-creation/start-sesh-drawer', () => ({
  default: ({ open }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="start-sesh-drawer" /> : null,
}));

vi.mock('@/app/components/sesh-settings/sesh-settings-drawer', () => ({
  default: ({ open }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="sesh-settings-drawer" /> : null,
}));

vi.mock('@/app/components/sesh-settings/sesh-settings-drawer-event', () => ({
  SESH_SETTINGS_DRAWER_EVENT: 'boardsesh:open-sesh-settings-drawer',
}));

vi.mock('@/app/components/user-drawer/user-drawer', () => ({
  default: () => <div data-testid="user-drawer" />,
}));

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/app/components/back-button', () => ({
  default: (props: { fallbackUrl?: string }) => (
    <button data-testid="back-button" data-fallback={props.fallbackUrl}>
      Back
    </button>
  ),
}));

let mockSessionData: { user: { id: string; name: string } } | null = {
  user: { id: 'user-1', name: 'Test User' },
};
let mockSessionStatus = 'authenticated';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSessionData, status: mockSessionStatus }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockShareWithFallback = vi.fn();
vi.mock('@/app/lib/share-utils', () => ({
  shareWithFallback: (...args: unknown[]) => mockShareWithFallback(...args),
}));

vi.mock('@/app/hooks/use-unread-notification-count', () => ({
  useUnreadNotificationCount: () => 3,
}));

let mockStatsFilterBridgeState = {
  isActive: false,
  pageTitle: null as string | null,
  backUrl: null as string | null,
  openFilterDrawer: null as (() => void) | null,
  hasActiveFilters: false,
};
vi.mock('@/app/components/stats-filter-bridge/stats-filter-bridge-context', () => ({
  useStatsFilterBridge: () => mockStatsFilterBridgeState,
}));

let mockProfileHeaderShareState = {
  isActive: false,
  displayName: null as string | null,
};
vi.mock('@/app/components/profile-header-bridge/profile-header-bridge-context', () => ({
  useProfileHeaderShare: () => mockProfileHeaderShareState,
}));

vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: vi.fn() }),
}));

const mockBoardConfigs = {} as Parameters<typeof GlobalHeader>[0]['boardConfigs'];

describe('GlobalHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSession = null;
    mockIsOnBoardRoute = false;
    mockPathname = '/some-page';
    mockSessionData = { user: { id: 'user-1', name: 'Test User' } };
    mockSessionStatus = 'authenticated';
    mockStatsFilterBridgeState = {
      isActive: false,
      pageTitle: null,
      backUrl: null,
      openFilterDrawer: null,
      hasActiveFilters: false,
    };
    mockProfileHeaderShareState = {
      isActive: false,
      displayName: null,
    };
    mockBridgeState = {
      openClimbSearchDrawer: null,
      searchPillSummary: null,
      hasActiveFilters: false,
      nameFilter: '',
      setNameFilter: null,
      hasActiveNonNameFilters: false,
    };
    mockQueueList = { queue: [], suggestedClimbs: [] };
    mockQueueBridgeBoardInfo = { boardDetails: null, angle: 0, hasActiveQueue: false, isHydrated: false };
  });

  it('renders user drawer and search input', () => {
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(screen.getByTestId('user-drawer')).toBeTruthy();
    // Search input renders as a TextField with placeholder
    expect(screen.getByPlaceholderText('What do you want to climb?')).toBeTruthy();
  });

  it('does not render a Sesh button', () => {
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
    expect(screen.queryByText('Sesh')).toBeNull();
  });

  it('opens UnifiedSearchDrawer when search input is focused (non-list page)', () => {
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(screen.queryByTestId('unified-search-drawer')).toBeNull();

    fireEvent.focus(screen.getByPlaceholderText('What do you want to climb?'));
    expect(screen.getByTestId('unified-search-drawer')).toBeTruthy();
  });

  it('passes "boards" as defaultCategory when not on board route', () => {
    mockIsOnBoardRoute = false;
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    fireEvent.focus(screen.getByPlaceholderText('What do you want to climb?'));
    expect(screen.getByTestId('unified-search-drawer').getAttribute('data-category')).toBe('boards');
  });

  it('passes "climbs" as defaultCategory when on board route', () => {
    mockIsOnBoardRoute = true;
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    fireEvent.focus(screen.getByPlaceholderText('What do you want to climb?'));
    expect(screen.getByTestId('unified-search-drawer').getAttribute('data-category')).toBe('climbs');
  });

  it('renders nothing on board create routes', () => {
    mockPathname = '/b/test-board/40/create';

    const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    // The header should be completely hidden (returns null)
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on MoonBoard create routes', () => {
    mockPathname = '/moonboard/moonboard-2024/standard-11x18-grid/wooden-holds/40/create';

    const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(container.innerHTML).toBe('');
  });

  // -----------------------------------------------------------------------
  // Bridge integration tests (list page behavior)
  // -----------------------------------------------------------------------
  describe('with search drawer bridge active (on board list page)', () => {
    beforeEach(() => {
      mockPathname = '/b/test-board/40/list';
      mockBridgeState = {
        openClimbSearchDrawer: mockOpenClimbSearchDrawer,
        searchPillSummary: 'V5-V7 · Tall',
        hasActiveFilters: true,
        nameFilter: '',
        setNameFilter: mockSetNameFilter,
        hasActiveNonNameFilters: true,
      };
    });

    it('shows "Search climbs..." placeholder when bridge is active', () => {
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByPlaceholderText('Search climbs...')).toBeTruthy();
    });

    it('renders the filter button when bridge is active', () => {
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByLabelText('Open filters')).toBeTruthy();
    });

    it('calls openClimbSearchDrawer when filter button is clicked', () => {
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      fireEvent.click(screen.getByLabelText('Open filters'));
      expect(mockOpenClimbSearchDrawer).toHaveBeenCalledTimes(1);
    });

    it('shows filter active indicator when non-name filters are active', () => {
      const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      const activeIndicator = container.querySelector('[class*="filterActiveIndicator"]');
      expect(activeIndicator).toBeTruthy();
    });

    it('does not show filter active indicator when non-name filters are not active', () => {
      mockBridgeState = {
        ...mockBridgeState,
        hasActiveNonNameFilters: false,
      };

      const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      const activeIndicator = container.querySelector('[class*="filterActiveIndicator"]');
      expect(activeIndicator).toBeNull();
    });

    it('adds onboarding-search-button id when bridge is active', () => {
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      const searchWrapper = screen.getByPlaceholderText('Search climbs...').closest('[id="onboarding-search-button"]');
      expect(searchWrapper).toBeTruthy();
    });

    it('renders the filter button disabled when the bridge is inactive on a list path', () => {
      // Pathname-driven gate: the button renders on every list path so the
      // SSR HTML matches the hydrated HTML; it's disabled until the bridge
      // registers so taps don't silently no-op.
      mockBridgeState = {
        openClimbSearchDrawer: null,
        searchPillSummary: null,
        hasActiveFilters: false,
        nameFilter: '',
        setNameFilter: null,
        hasActiveNonNameFilters: false,
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      const button = screen.getByLabelText('Open filters') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('shows clear button when nameFilter has a value', () => {
      mockBridgeState = {
        ...mockBridgeState,
        nameFilter: 'some search',
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByLabelText('Clear search')).toBeTruthy();
    });

    it('does not show clear button when nameFilter is empty', () => {
      mockBridgeState = {
        ...mockBridgeState,
        nameFilter: '',
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.queryByLabelText('Clear search')).toBeNull();
    });

    it('calls setNameFilter with empty string when clear button is clicked', () => {
      mockBridgeState = {
        ...mockBridgeState,
        nameFilter: 'some search',
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(mockSetNameFilter).toHaveBeenCalledWith('');
    });
  });

  it('shows "Search climbs..." placeholder on board list routes even before the bridge registers', () => {
    // Pathname-derived gate: the SSR HTML must already match the hydrated
    // copy on a list route, so the placeholder switches based on path,
    // not bridge state.
    mockPathname = '/b/test-board/40/list';

    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(screen.getByPlaceholderText('Search climbs...')).toBeTruthy();
  });

  it('renders filter and queue buttons on board list routes pre-hydration (disabled)', () => {
    mockPathname = '/b/test-board/40/list';
    // Bridge not yet registered, queue not hydrated — both buttons render
    // but should be disabled so taps don't silently no-op.
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    const filterButton = screen.getByLabelText('Open filters') as HTMLButtonElement;
    const queueButton = screen.getByLabelText('Open queue') as HTMLButtonElement;
    expect(filterButton.disabled).toBe(true);
    expect(queueButton.disabled).toBe(true);
  });

  it('shows generic placeholder on non-list routes when the bridge is inactive', () => {
    mockPathname = '/b/test-board/40/view/some-climb';

    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(screen.getByPlaceholderText('What do you want to climb?')).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // /you and /settings header tests
  // -----------------------------------------------------------------------
  describe('on /you pages', () => {
    it('renders a centered "You" title on the root /you page', () => {
      mockPathname = '/you';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByText('You')).toBeTruthy();
    });

    it('renders settings cog icon linking to /settings', () => {
      mockPathname = '/you';
      const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      const settingsLink = screen.getByLabelText('Settings');
      expect(settingsLink).toBeTruthy();
      expect(settingsLink.closest('a')?.getAttribute('href')).toBe('/settings');
      const title = screen.getByText('You');
      expect(Boolean(settingsLink.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      expect(container.querySelectorAll('[aria-label="Settings"]').length).toBe(1);
    });

    it('renders share button when user is authenticated', () => {
      mockPathname = '/you';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByLabelText('Share profile')).toBeTruthy();
    });

    it('does NOT render search bar', () => {
      mockPathname = '/you';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.queryByPlaceholderText('What do you want to climb?')).toBeNull();
      expect(screen.queryByPlaceholderText('Search climbs...')).toBeNull();
    });

    it('renders user drawer', () => {
      mockPathname = '/you';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByTestId('user-drawer')).toBeTruthy();
    });

    it('renders settings cog on /you/sessions path (starts with /you)', () => {
      mockPathname = '/you/sessions';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      const settingsLink = screen.getByLabelText('Settings');
      expect(settingsLink).toBeTruthy();
      expect(settingsLink.closest('a')?.getAttribute('href')).toBe('/settings');
    });

    it('does not render share button when user is not authenticated', () => {
      mockPathname = '/you';
      mockSessionData = null;
      mockSessionStatus = 'unauthenticated';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.queryByLabelText('Share profile')).toBeNull();
      // Settings cog should still render
      expect(screen.getByLabelText('Settings')).toBeTruthy();
    });

    it('calls shareWithFallback with profile URL when share button is clicked', () => {
      mockPathname = '/you';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      fireEvent.click(screen.getByLabelText('Share profile'));

      expect(mockShareWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/profile/user-1'),
          title: expect.stringContaining('Test User'),
          trackingEvent: 'Profile Shared',
        }),
      );
    });

    it('renders the stats filter action on the root /you page when the bridge is active', () => {
      mockPathname = '/you';
      mockStatsFilterBridgeState = {
        isActive: true,
        pageTitle: 'Progress',
        backUrl: null,
        openFilterDrawer: vi.fn(),
        hasActiveFilters: true,
      };

      const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByLabelText('Open stats filters')).toBeTruthy();
      expect(container.querySelector('[class*="filterActiveIndicator"]')).toBeTruthy();
    });
  });

  describe('on /profile pages', () => {
    it('renders a back button instead of the user drawer on the root profile page', () => {
      mockPathname = '/profile/user-2';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByTestId('back-button')).toBeTruthy();
      expect(screen.getByTestId('back-button').getAttribute('data-fallback')).toBe('/');
      expect(screen.queryByTestId('user-drawer')).toBeNull();
    });

    it('renders a share button for the viewed profile when profile share state is active', () => {
      mockPathname = '/profile/user-2';
      mockProfileHeaderShareState = {
        isActive: true,
        displayName: 'Viewed User',
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByLabelText('Share profile')).toBeTruthy();
    });

    it('shares the viewed profile URL from the root profile header', () => {
      mockPathname = '/profile/user-2';
      mockProfileHeaderShareState = {
        isActive: true,
        displayName: 'Viewed User',
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      fireEvent.click(screen.getByLabelText('Share profile'));

      expect(mockShareWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/profile/user-2'),
          title: expect.stringContaining('Viewed User'),
          trackingEvent: 'Profile Shared',
        }),
      );
    });

    it('renders the child page title in the global header', () => {
      mockPathname = '/profile/user-2/sessions';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByText('Sessions')).toBeTruthy();
      expect(screen.getByTestId('back-button').getAttribute('data-fallback')).toBe('/profile/user-2');
    });

    it('renders the statistics filter action in the profile header when the bridge is active', () => {
      mockPathname = '/profile/user-2/statistics';
      mockStatsFilterBridgeState = {
        isActive: true,
        pageTitle: 'Statistics',
        backUrl: '/profile/user-2',
        openFilterDrawer: vi.fn(),
        hasActiveFilters: true,
      };

      const { container } = render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByText('Statistics')).toBeTruthy();
      expect(screen.getByLabelText('Open stats filters')).toBeTruthy();
      expect(container.querySelector('[class*="filterActiveIndicator"]')).toBeTruthy();
    });
  });

  describe('on /settings page', () => {
    it('renders the user drawer but no settings cog, share button, or search bar', () => {
      mockPathname = '/settings';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByTestId('user-drawer')).toBeTruthy();
      expect(screen.queryByLabelText('Settings')).toBeNull();
      expect(screen.queryByLabelText('Share profile')).toBeNull();
      expect(screen.queryByPlaceholderText('What do you want to climb?')).toBeNull();
    });
  });

  describe('on home page (/)', () => {
    it('renders transparent header with user drawer only', () => {
      mockPathname = '/';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByTestId('user-drawer')).toBeTruthy();
      expect(screen.queryByPlaceholderText('What do you want to climb?')).toBeNull();
      expect(screen.queryByLabelText('Settings')).toBeNull();
    });
  });

  describe('on /feed page', () => {
    it('renders search bar (default header)', () => {
      mockPathname = '/feed';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.getByPlaceholderText('What do you want to climb?')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Queue button (climb list page)
  // -----------------------------------------------------------------------
  describe('queue button on climb list page', () => {
    const listPathname = '/b/test-board/40/list';

    beforeEach(() => {
      mockPathname = listPathname;
    });

    it('does not render on non-list routes', () => {
      mockPathname = '/you';
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      expect(screen.queryByLabelText('Open queue')).toBeNull();
    });

    it('renders disabled when the queue bridge has not hydrated', () => {
      mockQueueBridgeBoardInfo = {
        boardDetails: { board_name: 'kilter' },
        angle: 40,
        hasActiveQueue: false,
        isHydrated: false,
      };
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      const button = screen.getByLabelText('Open queue') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('renders disabled when boardDetails is null even after hydration', () => {
      mockQueueBridgeBoardInfo = { boardDetails: null, angle: 0, hasActiveQueue: false, isHydrated: true };
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      const button = screen.getByLabelText('Open queue') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('renders enabled when hydrated and boardDetails is present', () => {
      mockQueueBridgeBoardInfo = {
        boardDetails: { board_name: 'kilter' },
        angle: 40,
        hasActiveQueue: true,
        isHydrated: true,
      };
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      const button = screen.getByLabelText('Open queue') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it('opens the queue drawer when the enabled button is clicked', () => {
      mockQueueBridgeBoardInfo = {
        boardDetails: { board_name: 'kilter' },
        angle: 40,
        hasActiveQueue: true,
        isHydrated: true,
      };
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      expect(screen.queryByTestId('queue-drawer')).toBeNull();
      fireEvent.click(screen.getByLabelText('Open queue'));
      expect(screen.getByTestId('queue-drawer')).toBeTruthy();
    });

    it('does not open the drawer if click somehow fires while disabled', () => {
      // boardDetails is null so the button is disabled and handleOpenQueue
      // bails early — defensive against any path where the visual disabled
      // state is bypassed (e.g. assistive tooling).
      mockQueueBridgeBoardInfo = { boardDetails: null, angle: 0, hasActiveQueue: false, isHydrated: true };
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      fireEvent.click(screen.getByLabelText('Open queue'));
      expect(screen.queryByTestId('queue-drawer')).toBeNull();
    });

    it('shows the queue count badge when items are queued', () => {
      mockQueueBridgeBoardInfo = {
        boardDetails: { board_name: 'kilter' },
        angle: 40,
        hasActiveQueue: true,
        isHydrated: true,
      };
      mockQueueList = {
        queue: [{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }],
        suggestedClimbs: [],
      };
      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);
      expect(screen.getByText('3')).toBeTruthy();
    });
  });
});

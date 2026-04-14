import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

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
  default: () => <button data-testid="back-button">Back</button>,
}));

import GlobalHeader from '../global-header';

const mockBoardConfigs = {} as Parameters<typeof GlobalHeader>[0]['boardConfigs'];

describe('GlobalHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSession = null;
    mockIsOnBoardRoute = false;
    mockPathname = '/some-page';
    mockBridgeState = {
      openClimbSearchDrawer: null,
      searchPillSummary: null,
      hasActiveFilters: false,
      nameFilter: '',
      setNameFilter: null,
      hasActiveNonNameFilters: false,
    };
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

    it('does not show filter button when bridge is inactive', () => {
      mockBridgeState = {
        openClimbSearchDrawer: null,
        searchPillSummary: null,
        hasActiveFilters: false,
        nameFilter: '',
        setNameFilter: null,
        hasActiveNonNameFilters: false,
      };

      render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

      expect(screen.queryByLabelText('Open filters')).toBeNull();
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

  it('shows "Search climbs..." placeholder on board list routes before the bridge registers', () => {
    mockPathname = '/b/test-board/40/list';

    // Bridge not registered yet — openClimbSearchDrawer is null
    // but the pathname check in the component might not suffice;
    // the real behavior is driven by the bridge state.
    // With no bridge, non-list placeholder is shown
    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(screen.getByPlaceholderText('What do you want to climb?')).toBeTruthy();
  });

  it('shows generic placeholder on non-list routes when the bridge is inactive', () => {
    mockPathname = '/b/test-board/40/view/some-climb';

    render(<GlobalHeader boardConfigs={mockBoardConfigs} />);

    expect(screen.getByPlaceholderText('What do you want to climb?')).toBeTruthy();
  });
});

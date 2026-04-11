import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Capture the props passed to the underlying SwipeableDrawer so we can assert on them.
const swipeableDrawerProps: Array<Record<string, unknown>> = [];

vi.mock('@/app/components/swipeable-drawer/swipeable-drawer', () => ({
  default: (props: Record<string, unknown>) => {
    swipeableDrawerProps.push(props);
    const { open, children, footer } = props as {
      open: boolean;
      children: React.ReactNode;
      footer?: React.ReactNode;
    };
    if (!open) return null;
    return (
      <div data-testid="swipeable-drawer">
        {children}
        {footer ? <div data-testid="drawer-footer">{footer}</div> : null}
      </div>
    );
  },
}));

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => ({ token: null }),
}));

// Track mount counts so we can assert that a category's result component was
// never transiently rendered (the zero-flash guarantee).
const renderCounts = {
  users: 0,
  boards: 0,
  playlists: 0,
  gyms: 0,
};

vi.mock('@/app/components/social/user-search-results', () => ({
  default: () => {
    renderCounts.users += 1;
    return <div data-testid="user-search-results" />;
  },
}));

vi.mock('@/app/components/social/board-search-results', () => ({
  default: () => {
    renderCounts.boards += 1;
    return <div data-testid="board-search-results" />;
  },
}));

vi.mock('@/app/components/social/playlist-search-results', () => ({
  default: () => {
    renderCounts.playlists += 1;
    return <div data-testid="playlist-search-results" />;
  },
}));

vi.mock('@/app/components/social/gym-search-results', () => ({
  default: () => {
    renderCounts.gyms += 1;
    return <div data-testid="gym-search-results" />;
  },
}));

import UnifiedSearchDrawer from '../unified-search-drawer';
import type { BoardDetails } from '@/app/lib/types';

const mockBoardDetails = {
  board_name: 'kilter',
  layout_id: 1,
  size_id: 10,
  set_ids: [1, 2],
} as unknown as BoardDetails;

describe('UnifiedSearchDrawer', () => {
  beforeEach(() => {
    swipeableDrawerProps.length = 0;
    renderCounts.users = 0;
    renderCounts.boards = 0;
    renderCounts.playlists = 0;
    renderCounts.gyms = 0;
    vi.clearAllMocks();
  });

  it('renders all default category chips when no allow-list is provided', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        boardDetails={mockBoardDetails}
        renderClimbSearch={() => <div data-testid="climb-search" />}
      />,
    );

    // With boardDetails + default allow-list, all 5 categories render.
    expect(screen.getByText('Climbs')).toBeTruthy();
    expect(screen.getByText('Boards')).toBeTruthy();
    expect(screen.getByText('Gyms')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('Playlists')).toBeTruthy();
  });

  it('hides the category pill row entirely when allowedCategories narrows to a single category', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="climbs"
        allowedCategories={['climbs']}
        boardDetails={mockBoardDetails}
        renderClimbSearch={() => <div data-testid="climb-search" />}
      />,
    );

    // No other category labels should appear — the pill row shouldn't render at all.
    expect(screen.queryByText('Boards')).toBeNull();
    expect(screen.queryByText('Gyms')).toBeNull();
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Playlists')).toBeNull();
    // And the climb render prop is still invoked.
    expect(screen.getByTestId('climb-search')).toBeTruthy();
  });

  it('falls back to the first allowed category when defaultCategory is not in the allow-list', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="boards"
        allowedCategories={['users']}
      />,
    );

    // The users search placeholder is shown, confirming the category fell back.
    expect(screen.getByPlaceholderText('Search climbers...')).toBeTruthy();
    expect(screen.getByTestId('user-search-results')).toBeTruthy();
  });

  it('never transiently mounts the wrong category results on first render (no flash)', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="boards"
        allowedCategories={['users']}
      />,
    );

    // If the fallback ran as a post-render effect, BoardSearchResults would
    // mount once before unmounting in favor of UserSearchResults. Deriving the
    // effective category during render avoids that mount entirely.
    expect(renderCounts.boards).toBe(0);
    expect(renderCounts.users).toBeGreaterThan(0);
  });

  it('forwards showCloseButton and showCloseButtonOnMobile to SwipeableDrawer', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="climbs"
        allowedCategories={['climbs']}
        boardDetails={mockBoardDetails}
        renderClimbSearch={() => <div data-testid="climb-search" />}
        showCloseButton
        showCloseButtonOnMobile
      />,
    );

    const last = swipeableDrawerProps[swipeableDrawerProps.length - 1];
    expect(last.showCloseButton).toBe(true);
    expect(last.showCloseButtonOnMobile).toBe(true);
    expect(last.placement).toBe('top');
  });

  it('defaults showCloseButton and showCloseButtonOnMobile to false when not provided', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="boards"
      />,
    );

    const last = swipeableDrawerProps[swipeableDrawerProps.length - 1];
    expect(last.showCloseButton).toBe(false);
    expect(last.showCloseButtonOnMobile).toBe(false);
  });

  it('still shows the climbs category when boardDetails is provided without an allow-list', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        boardDetails={mockBoardDetails}
        renderClimbSearch={() => <div data-testid="climb-search" />}
      />,
    );

    expect(screen.getByText('Climbs')).toBeTruthy();
  });

  it('hides the climbs category when boardDetails is not provided', () => {
    render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="boards"
      />,
    );

    expect(screen.queryByText('Climbs')).toBeNull();
  });

  it('keeps the selected category stable across re-renders with fresh allowedCategories arrays', () => {
    // Simulates the common pattern `allowedCategories={['users', 'boards']}`,
    // where parents pass a new array identity every render. The category
    // state must not glitch and the visibleCategories memo key should stay
    // stable across renders with identical contents.
    const { rerender } = render(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="boards"
        allowedCategories={['users', 'boards']}
      />,
    );

    expect(screen.getByPlaceholderText('Search boards...')).toBeTruthy();

    // Re-render with a fresh array literal of the same contents.
    rerender(
      <UnifiedSearchDrawer
        open={true}
        onClose={vi.fn()}
        defaultCategory="boards"
        allowedCategories={['users', 'boards']}
      />,
    );

    // Category is still 'boards', not reset to the allow-list's first entry.
    expect(screen.getByPlaceholderText('Search boards...')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Search climbers...')).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vite-plus/test';
import { render } from '@testing-library/react';
import React from 'react';
import FindNearbyCard from '../find-nearby-card';

// Mock BoardRenderer
vi.mock('../../board-renderer/board-renderer', () => ({
  default: () => <div data-testid="board-renderer" />,
}));

// Mock getBoardDetails
vi.mock('@/app/lib/board-constants', () => ({
  getBoardDetails: vi.fn(() => ({
    board_name: 'kilter',
    layout_id: 1,
    size_id: 10,
    set_ids: [1, 20],
    images_to_holds: { 'test.png': [] },
    holdsData: [],
    edge_left: 0,
    edge_right: 144,
    edge_bottom: 0,
    edge_top: 156,
    boardWidth: 1080,
    boardHeight: 1920,
    supportsMirroring: false,
  })),
}));

// Mock CSS modules
vi.mock('../board-scroll.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}));

describe('FindNearbyCard', () => {
  it('renders idle state with "Find nearby" text and location icon', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} />);

    expect(getByText('Find nearby')).toBeDefined();
    expect(container.querySelector('[data-testid="LocationOnOutlinedIcon"]')).toBeDefined();
  });

  it('renders loading state with "Finding boards…" text and spinner', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} status="loading" />);

    expect(getByText('Finding boards…')).toBeDefined();
    expect(container.querySelector('[role="progressbar"]')).toBeDefined();
  });

  it('renders geo-denied state with "Location unavailable" and location-off icon', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} status="geo-denied" />);

    const label = getByText('Location unavailable');
    expect(label).toBeDefined();
    expect(label.className).toContain('cardNameError');
    expect(container.querySelector('[data-testid="LocationOffOutlinedIcon"]')).toBeDefined();
  });

  it('renders error state with "Failed to load nearby boards" and error icon', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} status="error" />);

    const label = getByText('Failed to load nearby boards');
    expect(label).toBeDefined();
    expect(label.className).toContain('cardNameError');
    expect(container.querySelector('[data-testid="ErrorOutlineOutlinedIcon"]')).toBeDefined();
  });

  it('renders no-results state with "No nearby boards found" and search-off icon', () => {
    const onClick = vi.fn();
    const { getByText, container } = render(<FindNearbyCard onClick={onClick} status="no-results" />);

    const label = getByText('No nearby boards found');
    expect(label).toBeDefined();
    expect(label.className).toContain('cardNameDisabled');
    expect(container.querySelector('[data-testid="SearchOffOutlinedIcon"]')).toBeDefined();
  });

  it('applies disabled styling to card square for all error/no-results states', () => {
    const onClick = vi.fn();

    for (const status of ['geo-denied', 'error', 'no-results'] as const) {
      const { container, unmount } = render(<FindNearbyCard onClick={onClick} status={status} />);
      expect(container.querySelector('.cardSquareDisabled')).not.toBeNull();
      unmount();
    }
  });

  it('does not apply disabled styling in idle and loading states', () => {
    const onClick = vi.fn();

    for (const status of ['idle', 'loading'] as const) {
      const { container, unmount } = render(<FindNearbyCard onClick={onClick} status={status} />);
      expect(container.querySelector('.cardSquareDisabled')).toBeNull();
      unmount();
    }
  });

  it('calls onClick in idle state', () => {
    const onClick = vi.fn();
    const { getByText } = render(<FindNearbyCard onClick={onClick} />);

    getByText('Find nearby').parentElement!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick in geo-denied, error, or no-results states', () => {
    const onClick = vi.fn();

    for (const status of ['geo-denied', 'error', 'no-results'] as const) {
      const { getByText, unmount } = render(<FindNearbyCard onClick={onClick} status={status} />);
      getByText(getByText(/.+/).textContent).parentElement!.click();
      unmount();
    }

    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders BoardRenderer for greyed-out board preview', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<FindNearbyCard onClick={onClick} />);

    expect(getByTestId('board-renderer')).toBeDefined();
  });

  it('small size variant applies correct class', () => {
    const onClick = vi.fn();
    const { getByText } = render(<FindNearbyCard onClick={onClick} size="small" />);

    const cardRoot = getByText('Find nearby').parentElement!;
    expect(cardRoot.className).toContain('cardScrollSmall');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import type { UserBoard } from '@boardsesh/shared-schema';

// ---------- mocks ----------

// Mock useNearbyBoards hook
const mockRequestPermission = vi.fn();

interface UseNearbyBoardsReturn {
  boards: UserBoard[];
  isLoading: boolean;
  permissionState: PermissionState | null;
  requestPermission: () => Promise<void>;
  error: string | null;
}

const mockUseNearbyBoards = vi.fn<
  (opts: { enabled: boolean; radiusKm: number; limit: number }) => UseNearbyBoardsReturn
>();

vi.mock('@/app/hooks/use-nearby-boards', () => ({
  useNearbyBoards: (opts: { enabled: boolean; radiusKm: number; limit: number }) =>
    mockUseNearbyBoards(opts),
}));

// Mock BoardScrollSection to expose its props for assertion
vi.mock('../../board-scroll/board-scroll-section', () => ({
  default: ({
    title,
    loading,
    children,
  }: {
    title?: string;
    loading?: boolean;
    children?: React.ReactNode;
  }) => (
    <div data-testid="board-scroll-section" data-title={title} data-loading={loading ? 'true' : undefined}>
      {loading ? <div data-testid="loading-indicator">Loading...</div> : children}
    </div>
  ),
}));

// Mock BoardScrollCard to expose its props for assertion
vi.mock('../../board-scroll/board-scroll-card', () => ({
  default: ({
    userBoard,
    distanceMeters,
    onClick,
  }: {
    userBoard: UserBoard;
    distanceMeters?: number | null;
    onClick: () => void;
  }) => (
    <button
      data-testid={`board-card-${userBoard.uuid}`}
      data-distance={distanceMeters}
      onClick={onClick}
    >
      {userBoard.name}
    </button>
  ),
}));

// Mock CSS modules
vi.mock('../../board-scroll/board-scroll.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}));

// Mock theme tokens
vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    neutral: { 400: '#9e9e9e' },
  },
}));

import NearbyBoardsSection from '../nearby-boards-section';

// ---------- helpers ----------

function makeUserBoard(overrides?: Partial<UserBoard>): UserBoard {
  return {
    uuid: 'board-1',
    slug: 'my-kilter',
    ownerId: 'user-1',
    boardType: 'kilter',
    layoutId: 8,
    sizeId: 25,
    setIds: '26,27',
    angle: 40,
    name: 'My Kilter Board',
    locationName: 'The Gym',
    isPublic: true,
    isUnlisted: false,
    hideLocation: false,
    isOwned: true,
    isAngleAdjustable: false,
    createdAt: '2024-01-01T00:00:00Z',
    totalAscents: 0,
    uniqueClimbers: 0,
    followerCount: 0,
    commentCount: 0,
    isFollowedByMe: false,
    ...overrides,
  };
}

function defaultHookReturn() {
  return {
    boards: [] as UserBoard[],
    isLoading: false,
    permissionState: null as PermissionState | null,
    requestPermission: mockRequestPermission,
    error: null as string | null,
  };
}

// ---------- tests ----------

describe('NearbyBoardsSection', () => {
  const onBoardSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when permission is granted and data is loading', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'granted',
      isLoading: true,
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    const section = screen.getByTestId('board-scroll-section');
    expect(section).toHaveAttribute('data-title', 'Found Nearby');
    expect(section).toHaveAttribute('data-loading', 'true');
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders permission prompt when permissionState is null (iOS Safari)', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: null,
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Enable location to find boards nearby')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
  });

  it('renders permission prompt when permissionState is "prompt"', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'prompt',
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Enable location to find boards nearby')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
  });

  it('renders permission prompt when permissionState is "denied"', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'denied',
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Enable location to find boards nearby')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
  });

  it('calls requestPermission when Enable Location button is clicked', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'prompt',
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    const button = screen.getByRole('button', { name: /enable location/i });
    fireEvent.click(button);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('renders error message and "Try Again" button when there is an error', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'denied',
      error: 'Geolocation is not supported',
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Geolocation is not supported')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls requestPermission when "Try Again" button is clicked', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'denied',
      error: 'Geolocation is not supported',
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    const button = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(button);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('renders boards when data is available', () => {
    const boards = [
      makeUserBoard({ uuid: 'board-1', name: 'Board One', distanceMeters: 500 }),
      makeUserBoard({ uuid: 'board-2', name: 'Board Two', distanceMeters: 1500 }),
    ];

    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'granted',
      boards,
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByTestId('board-card-board-1')).toBeInTheDocument();
    expect(screen.getByText('Board One')).toBeInTheDocument();
    expect(screen.getByTestId('board-card-board-2')).toBeInTheDocument();
    expect(screen.getByText('Board Two')).toBeInTheDocument();
  });

  it('passes distanceMeters to BoardScrollCard', () => {
    const boards = [
      makeUserBoard({ uuid: 'board-1', name: 'Board One', distanceMeters: 750 }),
    ];

    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'granted',
      boards,
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByTestId('board-card-board-1')).toHaveAttribute('data-distance', '750');
  });

  it('calls onBoardSelect when a board card is clicked', () => {
    const board = makeUserBoard({ uuid: 'board-1', name: 'Board One' });

    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'granted',
      boards: [board],
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    fireEvent.click(screen.getByTestId('board-card-board-1'));

    expect(onBoardSelect).toHaveBeenCalledTimes(1);
    expect(onBoardSelect).toHaveBeenCalledWith(board);
  });

  it('returns null when there are no boards and permission is granted (empty results)', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'granted',
      boards: [],
      isLoading: false,
    });

    const { container } = render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders generic loading state when isLoading is true but permission is not granted', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'prompt',
      isLoading: true,
      boards: [],
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    // When permissionState !== 'granted' and no boards, should show permission prompt
    // (the first branch only catches granted + loading)
    expect(screen.getByText('Enable location to find boards nearby')).toBeInTheDocument();
  });

  it('passes open and configuration to useNearbyBoards', () => {
    mockUseNearbyBoards.mockReturnValue(defaultHookReturn());

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(mockUseNearbyBoards).toHaveBeenCalledWith({
      enabled: true,
      radiusKm: 50,
      limit: 10,
    });
  });

  it('passes open=false as enabled=false to useNearbyBoards', () => {
    mockUseNearbyBoards.mockReturnValue(defaultHookReturn());

    render(<NearbyBoardsSection open={false} onBoardSelect={onBoardSelect} />);

    expect(mockUseNearbyBoards).toHaveBeenCalledWith({
      enabled: false,
      radiusKm: 50,
      limit: 10,
    });
  });

  it('uses "Found Nearby" as the section title', () => {
    const boards = [makeUserBoard()];

    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: 'granted',
      boards,
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    const section = screen.getByTestId('board-scroll-section');
    expect(section).toHaveAttribute('data-title', 'Found Nearby');
  });

  it('shows error text over default text when error is set', () => {
    mockUseNearbyBoards.mockReturnValue({
      ...defaultHookReturn(),
      permissionState: null,
      error: 'Location services are disabled',
    });

    render(<NearbyBoardsSection open onBoardSelect={onBoardSelect} />);

    expect(screen.getByText('Location services are disabled')).toBeInTheDocument();
    expect(screen.queryByText('Enable location to find boards nearby')).not.toBeInTheDocument();
  });
});

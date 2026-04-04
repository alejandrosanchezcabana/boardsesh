import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock data
let mockBoards: Array<Record<string, unknown>> = [];
let mockIsLoading = false;

vi.mock('@/app/hooks/use-my-boards', () => ({
  useMyBoards: () => ({
    boards: mockBoards,
    isLoading: mockIsLoading,
    error: null,
  }),
}));

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => ({ token: 'test-token', isAuthenticated: true }),
}));

vi.mock('../../swipeable-drawer/swipeable-drawer', () => ({
  default: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
    onClose: () => void;
  }) => (open ? <div data-testid={`drawer-${title}`}>{children}</div> : null),
}));

vi.mock('../../board-entity/edit-board-form', () => ({
  default: ({
    board,
    onCancel,
  }: {
    board: Record<string, unknown>;
    onSuccess: (b: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="edit-board-form">
      <span>Editing: {board.name as string}</span>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../my-boards-drawer.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}));

import MyBoardsDrawer from '../my-boards-drawer';

function makeBoard(overrides?: Record<string, unknown>) {
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
    locationName: 'Home Gym',
    isPublic: true,
    isOwned: true,
    isAngleAdjustable: true,
    createdAt: '2024-01-01T00:00:00Z',
    totalAscents: 0,
    uniqueClimbers: 0,
    followerCount: 0,
    commentCount: 0,
    isFollowedByMe: false,
    ...overrides,
  };
}

describe('MyBoardsDrawer', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockBoards = [];
    mockIsLoading = false;
  });

  it('does not render when closed', () => {
    render(<MyBoardsDrawer open={false} onClose={mockOnClose} />);
    expect(screen.queryByTestId('drawer-My Boards')).toBeNull();
  });

  it('renders loading state', () => {
    mockIsLoading = true;
    render(<MyBoardsDrawer open={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('my-boards-loading')).toBeDefined();
  });

  it('renders empty state when no boards', () => {
    mockBoards = [];
    mockIsLoading = false;
    render(<MyBoardsDrawer open={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('my-boards-empty')).toBeDefined();
    expect(screen.getByText(/No boards yet/)).toBeDefined();
  });

  it('renders board list with boards', () => {
    mockBoards = [
      makeBoard(),
      makeBoard({ uuid: 'board-2', name: 'My Tension', boardType: 'tension', locationName: null }),
    ];
    render(<MyBoardsDrawer open={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('my-boards-list')).toBeDefined();
    expect(screen.getByText('My Kilter Board')).toBeDefined();
    expect(screen.getByText('My Tension')).toBeDefined();
  });

  it('shows board metadata with type, location, and angle', () => {
    mockBoards = [makeBoard()];
    render(<MyBoardsDrawer open={true} onClose={mockOnClose} />);
    expect(screen.getByText('Kilter \u00B7 Home Gym \u00B7 40\u00B0')).toBeDefined();
  });

  it('opens edit drawer when clicking a board', () => {
    mockBoards = [makeBoard()];
    render(<MyBoardsDrawer open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByTestId('board-item-board-1'));

    expect(screen.getByTestId('drawer-Edit Board')).toBeDefined();
    expect(screen.getByTestId('edit-board-form')).toBeDefined();
    expect(screen.getByText('Editing: My Kilter Board')).toBeDefined();
  });

  it('closes edit drawer when cancel is clicked', () => {
    mockBoards = [makeBoard()];
    render(<MyBoardsDrawer open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByTestId('board-item-board-1'));
    expect(screen.getByTestId('drawer-Edit Board')).toBeDefined();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('drawer-Edit Board')).toBeNull();
  });
});

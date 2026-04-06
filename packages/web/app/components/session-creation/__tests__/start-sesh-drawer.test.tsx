import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockSetInitialQueueForSession = vi.fn();
let mockLocalQueue: unknown[] = [];
let mockLocalCurrentClimbQueueItem: unknown = null;
let mockLocalBoardPath: string | null = null;

vi.mock('@/app/components/persistent-session/persistent-session-context', () => ({
  usePersistentSession: () => ({
    setInitialQueueForSession: mockSetInitialQueueForSession,
    localQueue: mockLocalQueue,
    localCurrentClimbQueueItem: mockLocalCurrentClimbQueueItem,
    localBoardPath: mockLocalBoardPath,
  }),
  usePersistentSessionState: () => ({
    localQueue: mockLocalQueue,
    localCurrentClimbQueueItem: mockLocalCurrentClimbQueueItem,
    localBoardPath: mockLocalBoardPath,
  }),
  usePersistentSessionActions: () => ({
    setInitialQueueForSession: mockSetInitialQueueForSession,
  }),
}));

const mockCreateSession = vi.fn();
vi.mock('@/app/hooks/use-create-session', () => ({
  useCreateSession: () => ({
    createSession: mockCreateSession,
    isCreating: false,
  }),
}));

const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}));

vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: vi.fn() }),
}));

vi.mock('@/app/components/providers/auth-modal-provider', () => ({
  useAuthModal: () => ({ openAuthModal: vi.fn() }),
}));

vi.mock('@/app/lib/climb-session-cookie', () => ({
  setClimbSessionCookie: vi.fn(),
}));

vi.mock('@/app/hooks/use-my-boards', () => ({
  useMyBoards: () => ({
    boards: [
      { uuid: 'board-1', slug: 'kilter-original-12x12', name: 'Kilter', angle: 40 },
      { uuid: 'board-2', slug: 'tension-board-8x10', name: 'Tension', angle: 30 },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/app/components/swipeable-drawer/swipeable-drawer', () => ({
  default: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="drawer">{children}</div> : null,
}));

vi.mock('@/app/components/board-scroll/board-scroll-section', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/app/components/board-scroll/board-scroll-card', () => ({
  default: ({ onClick, userBoard }: { onClick: () => void; userBoard?: { name: string } }) => (
    <button data-testid={`board-card-${userBoard?.name}`} onClick={onClick}>
      {userBoard?.name}
    </button>
  ),
}));

vi.mock('@/app/components/board-scroll/create-board-card', () => ({
  default: () => <div data-testid="create-board-card" />,
}));

vi.mock('@/app/components/board-selector-drawer/board-selector-drawer', () => ({
  default: () => null,
}));

import StartSeshDrawer from '../start-sesh-drawer';

// --- Helpers ---

function makeQueueItem(uuid: string, climbName: string) {
  return {
    uuid,
    climb: { uuid: `climb-${uuid}`, name: climbName, frames: '', mirrored: false, angle: 40 },
    addedBy: null,
    suggested: false,
  };
}

// --- Tests ---

describe('StartSeshDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalQueue = [];
    mockLocalCurrentClimbQueueItem = null;
    mockLocalBoardPath = null;
    mockCreateSession.mockResolvedValue('new-session-id');
  });

  async function selectBoardAndSubmit(boardName: string) {
    const boardCard = screen.getByTestId(`board-card-${boardName}`);
    fireEvent.click(boardCard);

    const submitButton = screen.getByRole('button', { name: /sesh/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });
  }

  it('transfers local queue when board matches', async () => {
    const item1 = makeQueueItem('q1', 'Boulder 1');
    const item2 = makeQueueItem('q2', 'Boulder 2');
    mockLocalQueue = [item1, item2];
    mockLocalCurrentClimbQueueItem = item1;
    mockLocalBoardPath = '/b/kilter-original-12x12';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockSetInitialQueueForSession).toHaveBeenCalledWith(
        'new-session-id',
        [item1, item2],
        item1,
        undefined,
      );
    });

    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('does not transfer queue when board does not match', async () => {
    const item1 = makeQueueItem('q1', 'Boulder 1');
    mockLocalQueue = [item1];
    mockLocalCurrentClimbQueueItem = item1;
    mockLocalBoardPath = '/b/tension-board-8x10';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    expect(mockSetInitialQueueForSession).not.toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('does not transfer queue when local queue is empty', async () => {
    mockLocalQueue = [];
    mockLocalCurrentClimbQueueItem = null;
    mockLocalBoardPath = '/b/kilter-original-12x12';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    expect(mockSetInitialQueueForSession).not.toHaveBeenCalled();
  });

  it('does not transfer queue when localBoardPath is null', async () => {
    const item1 = makeQueueItem('q1', 'Boulder 1');
    mockLocalQueue = [item1];
    mockLocalCurrentClimbQueueItem = item1;
    mockLocalBoardPath = null;

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    expect(mockSetInitialQueueForSession).not.toHaveBeenCalled();
  });

  it('transfers queue when only currentClimbQueueItem exists (no queue items)', async () => {
    const item1 = makeQueueItem('q1', 'Boulder 1');
    mockLocalQueue = [];
    mockLocalCurrentClimbQueueItem = item1;
    mockLocalBoardPath = '/b/kilter-original-12x12';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockSetInitialQueueForSession).toHaveBeenCalledWith(
        'new-session-id',
        [],
        item1,
        undefined,
      );
    });
  });
});

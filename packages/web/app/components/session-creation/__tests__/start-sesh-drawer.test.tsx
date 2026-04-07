import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockSetInitialQueueForSession = vi.fn();
const mockActivateSession = vi.fn();
let mockLocalQueue: unknown[] = [];
let mockLocalCurrentClimbQueueItem: unknown = null;
let mockLocalBoardPath: string | null = null;
let mockLocalBoardDetails: {
  board_name: string;
  layout_id: number;
  size_id: number;
  set_ids: number[];
  angle?: number;
} | null = null;

vi.mock('@/app/components/persistent-session/persistent-session-context', () => ({
  usePersistentSession: () => ({
    activateSession: mockActivateSession,
    setInitialQueueForSession: mockSetInitialQueueForSession,
    localQueue: mockLocalQueue,
    localCurrentClimbQueueItem: mockLocalCurrentClimbQueueItem,
    localBoardPath: mockLocalBoardPath,
    localBoardDetails: mockLocalBoardDetails,
  }),
  usePersistentSessionState: () => ({
    localQueue: mockLocalQueue,
    localCurrentClimbQueueItem: mockLocalCurrentClimbQueueItem,
    localBoardPath: mockLocalBoardPath,
  }),
  usePersistentSessionActions: () => ({
    activateSession: mockActivateSession,
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
  usePathname: () => null,
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
      { uuid: 'board-1', slug: 'kilter-original-12x12', name: 'Kilter', angle: 40, boardType: 'kilter', layoutId: 1, sizeId: 10, setIds: '1,2' },
      { uuid: 'board-2', slug: 'tension-board-8x10', name: 'Tension', angle: 30, boardType: 'tension', layoutId: 2, sizeId: 20, setIds: '3,4' },
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
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="board-scroll-section">{children}</div>,
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
    mockLocalBoardDetails = null;
    mockCreateSession.mockResolvedValue('new-session-id');
  });

  async function expandBoardSelectorAndSelect(boardName: string) {
    // If the board selector is collapsed (pill shown), expand it first
    const changeButton = screen.queryByText('Change');
    if (changeButton) {
      fireEvent.click(changeButton);
    }

    const boardCard = screen.getByTestId(`board-card-${boardName}`);
    fireEvent.click(boardCard);
  }

  async function submitSesh() {
    const submitButton = screen.getByRole('button', { name: /sesh/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });
  }

  async function selectBoardAndSubmit(boardName: string) {
    await expandBoardSelectorAndSelect(boardName);
    await submitSesh();
  }

  it('auto-selects board from localBoardPath and starts session without manual selection', async () => {
    const item1 = makeQueueItem('q1', 'Boulder 1');
    mockLocalQueue = [item1];
    mockLocalCurrentClimbQueueItem = item1;
    mockLocalBoardPath = '/b/kilter-original-12x12/40/list';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Board should be auto-selected — just press submit
    await submitSesh();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    expect(mockSetInitialQueueForSession).toHaveBeenCalledWith(
      'new-session-id',
      [item1],
      item1,
      undefined,
    );
    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('auto-selects board from localBoardDetails (generic route)', async () => {
    mockLocalBoardPath = '/kilter/original/12x12/screw_bolt/40/list';
    mockLocalBoardDetails = { board_name: 'kilter', layout_id: 1, size_id: 10, set_ids: [1, 2] };

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Board should be auto-selected via strategy 2
    await submitSesh();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('shows collapsed pill when board is auto-selected', async () => {
    mockLocalBoardPath = '/b/kilter-original-12x12/40/list';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Should show the board name in a pill and "Change" link
    expect(screen.getByText('Kilter')).toBeTruthy();
    expect(screen.getByText('Change')).toBeTruthy();

    // Board scroll section should not be visible
    expect(screen.queryByTestId('board-scroll-section')).toBeNull();
  });

  it('expands board selector when Change is clicked', async () => {
    mockLocalBoardPath = '/b/kilter-original-12x12/40/list';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Click Change to expand
    fireEvent.click(screen.getByText('Change'));

    // Board scroll section should now be visible
    expect(screen.getByTestId('board-scroll-section')).toBeTruthy();
  });

  it('transfers local queue when board matches', async () => {
    const item1 = makeQueueItem('q1', 'Boulder 1');
    const item2 = makeQueueItem('q2', 'Boulder 2');
    mockLocalQueue = [item1, item2];
    mockLocalCurrentClimbQueueItem = item1;
    mockLocalBoardPath = '/b/kilter-original-12x12';

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Board is auto-selected, just submit
    await submitSesh();

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

    // Tension is auto-selected, expand and select Kilter instead
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

    await submitSesh();

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

    // No auto-selection, manually select a board
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

    // Board is auto-selected, just submit
    await submitSesh();

    await waitFor(() => {
      expect(mockSetInitialQueueForSession).toHaveBeenCalledWith(
        'new-session-id',
        [],
        item1,
        undefined,
      );
    });
  });

  it('shows full board scroll when no board context is available', async () => {
    mockLocalBoardPath = null;
    mockLocalBoardDetails = null;

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // No auto-selection, full scroll should show
    expect(screen.getByTestId('board-scroll-section')).toBeTruthy();
    expect(screen.queryByText('Change')).toBeNull();
  });

  it('matches board details even when set_ids are in different order', async () => {
    // localBoardDetails has set_ids in reverse order compared to UserBoard.setIds "1,2"
    mockLocalBoardPath = '/kilter/original/12x12/screw_bolt/40/list';
    mockLocalBoardDetails = { board_name: 'kilter', layout_id: 1, size_id: 10, set_ids: [2, 1] };

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Should auto-select Kilter despite reversed set_ids order
    await submitSesh();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('prioritizes slug match over board details match', async () => {
    // localBoardPath matches Kilter by slug, but localBoardDetails matches Tension by IDs
    mockLocalBoardPath = '/b/kilter-original-12x12/40/list';
    mockLocalBoardDetails = { board_name: 'tension', layout_id: 2, size_id: 20, set_ids: [3, 4] };

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Should show Kilter (slug match wins), not Tension
    expect(screen.getByText('Kilter')).toBeTruthy();

    await submitSesh();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.anything(),
        '/b/kilter-original-12x12',
      );
    });
  });

  it('calls activateSession directly when already on the same board route', async () => {
    mockLocalBoardPath = '/b/kilter-original-12x12/40/list';
    mockLocalBoardDetails = { board_name: 'kilter', layout_id: 1, size_id: 10, set_ids: [1, 2] };

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Board is auto-selected (Kilter), just submit
    await submitSesh();

    await waitFor(() => {
      expect(mockActivateSession).toHaveBeenCalledWith({
        sessionId: 'new-session-id',
        sessionName: undefined,
        boardPath: '/b/kilter-original-12x12/40/list',
        boardDetails: mockLocalBoardDetails,
        parsedParams: {
          board_name: 'kilter',
          layout_id: 1,
          size_id: 10,
          set_ids: [1, 2],
          angle: 40,
        },
      });
    });
  });

  it('does not call activateSession when navigating to a different board', async () => {
    mockLocalBoardPath = '/b/tension-board-8x10/30/list';
    mockLocalBoardDetails = { board_name: 'tension', layout_id: 2, size_id: 20, set_ids: [3, 4] };

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    // Tension is auto-selected, expand and select Kilter instead
    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    expect(mockActivateSession).not.toHaveBeenCalled();
  });

  it('does not call activateSession when localBoardPath is null', async () => {
    mockLocalBoardPath = null;
    mockLocalBoardDetails = null;

    render(<StartSeshDrawer open onClose={vi.fn()} />);

    await selectBoardAndSubmit('Kilter');

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    expect(mockActivateSession).not.toHaveBeenCalled();
  });
});

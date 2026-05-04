import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';
import CreatePlaylistDrawer from '../create-playlist-drawer';
import type { Playlist } from '@/app/lib/graphql/operations/playlists';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

const mockShowMessage = vi.fn();
vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: mockShowMessage }),
}));

const mockUseWsAuthToken = vi.fn();
vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => mockUseWsAuthToken(),
}));

const mockExecuteGraphQL = vi.fn();
vi.mock('@/app/lib/graphql/client', () => ({
  executeGraphQL: (...args: unknown[]) => mockExecuteGraphQL(...args),
}));

const mockTrack = vi.fn();
vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

const mockSwipeableDrawer = vi.fn();
vi.mock('@/app/components/swipeable-drawer/swipeable-drawer', () => ({
  default: (props: { open: boolean; extra?: React.ReactNode; children?: React.ReactNode }) => {
    mockSwipeableDrawer(props);
    if (!props.open) return null;
    return (
      <div data-testid="drawer">
        {props.children}
        <div data-testid="drawer-extra">{props.extra}</div>
      </div>
    );
  },
}));

function createPlaylist(overrides?: Partial<Playlist>): Playlist {
  return {
    id: '1',
    uuid: 'pl-uuid-1',
    boardType: 'kilter',
    layoutId: 1,
    name: 'New Playlist',
    description: '',
    isPublic: false,
    color: undefined,
    icon: undefined,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Playlist;
}

const baseProps = {
  open: true,
  onClose: vi.fn(),
  boardName: 'kilter',
  layoutId: 1,
  source: 'test-source',
  onCreated: vi.fn(),
};

describe('CreatePlaylistDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWsAuthToken.mockReturnValue({ token: 'test-token', isAuthenticated: true, isLoading: false });
    baseProps.onClose = vi.fn();
    baseProps.onCreated = vi.fn();
  });

  it('renders the form when open', () => {
    render(<CreatePlaylistDrawer {...baseProps} />);
    expect(screen.getByPlaceholderText('e.g., Hard Crimps')).toBeDefined();
    expect(screen.getByPlaceholderText('Optional description...')).toBeDefined();
  });

  it('does not submit when name is empty and shows a name error', async () => {
    render(<CreatePlaylistDrawer {...baseProps} />);
    const submit = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText(/please enter a playlist name/i)).toBeDefined();
    });
    expect(mockExecuteGraphQL).not.toHaveBeenCalled();
    expect(baseProps.onCreated).not.toHaveBeenCalled();
  });

  it('does not submit when description exceeds 500 chars', async () => {
    render(<CreatePlaylistDrawer {...baseProps} />);
    const nameInput = screen.getByPlaceholderText('e.g., Hard Crimps');
    fireEvent.change(nameInput, { target: { value: 'Valid Name' } });

    const descInput = screen.getByPlaceholderText('Optional description...') as HTMLTextAreaElement;
    // Drop the maxLength prop on the underlying element so we can simulate over-long input.
    descInput.removeAttribute('maxLength');
    fireEvent.change(descInput, { target: { value: 'a'.repeat(501) } });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => {
      expect(screen.getByText(/description too long/i)).toBeDefined();
    });
    expect(mockExecuteGraphQL).not.toHaveBeenCalled();
  });

  it('refuses to submit when no board context is provided', async () => {
    render(<CreatePlaylistDrawer {...baseProps} boardName="" layoutId={0} />);
    fireEvent.change(screen.getByPlaceholderText('e.g., Hard Crimps'), { target: { value: 'Valid' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => {
      expect(mockShowMessage).toHaveBeenCalledWith(expect.stringMatching(/select a board/i), 'error');
    });
    expect(mockExecuteGraphQL).not.toHaveBeenCalled();
  });

  it('submits, calls onCreated, fires analytics, and closes on success', async () => {
    const created = createPlaylist({ uuid: 'pl-new', name: 'My List' });
    mockExecuteGraphQL.mockResolvedValueOnce({ createPlaylist: created });

    render(<CreatePlaylistDrawer {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g., Hard Crimps'), { target: { value: 'My List' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(mockExecuteGraphQL).toHaveBeenCalledTimes(1));

    const [, variables, token] = mockExecuteGraphQL.mock.calls[0];
    expect(variables).toEqual({
      input: { boardType: 'kilter', layoutId: 1, name: 'My List', description: undefined, color: undefined },
    });
    expect(token).toBe('test-token');

    expect(baseProps.onCreated).toHaveBeenCalledWith(created);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(mockShowMessage).toHaveBeenCalledWith(expect.stringMatching(/created playlist "My List"/i), 'success');
    expect(mockTrack).toHaveBeenCalledWith(
      'Create Playlist',
      expect.objectContaining({ boardName: 'kilter', playlistName: 'My List', source: 'test-source' }),
    );
  });

  it('shows an error snackbar and does not close when the mutation fails', async () => {
    mockExecuteGraphQL.mockRejectedValueOnce(new Error('boom'));

    render(<CreatePlaylistDrawer {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g., Hard Crimps'), { target: { value: 'Will fail' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(mockExecuteGraphQL).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(mockShowMessage).toHaveBeenCalledWith(expect.stringMatching(/failed to create playlist/i), 'error');
    });
    expect(baseProps.onCreated).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });
});

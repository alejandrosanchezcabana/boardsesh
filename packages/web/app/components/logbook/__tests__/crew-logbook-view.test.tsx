// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Climb } from '@/app/lib/types';
import { CrewLogbookView } from '../crew-logbook-view';

const mockRequest = vi.fn();
const mockUseWsAuthToken = vi.fn();
const mockUseSession = vi.fn();

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => mockUseWsAuthToken(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

vi.mock('@/app/lib/graphql/client', () => ({
  createGraphQLHttpClient: () => ({ request: mockRequest }),
}));

vi.mock('@/app/components/ui/empty-state', () => ({
  EmptyState: ({ description }: { description: string }) => <div data-testid="empty-state">{description}</div>,
}));

vi.mock('../logbook-entry-card', () => ({
  LogbookEntryCard: ({
    entry,
    user,
    showMirrorTag,
  }: {
    entry: {
      attemptCount: number;
      status?: string | null;
      tickUuid?: string | null;
      upvotes?: number | null;
      downvotes?: number | null;
      commentCount?: number | null;
    };
    user?: { userId: string; displayName?: string | null };
    showMirrorTag: boolean;
  }) => (
    <div
      data-testid="logbook-entry-card"
      data-user-id={user?.userId}
      data-display-name={user?.displayName ?? ''}
      data-status={entry.status ?? ''}
      data-attempts={entry.attemptCount}
      data-mirror-tag={String(showMirrorTag)}
      data-tick-uuid={entry.tickUuid ?? ''}
      data-upvotes={entry.upvotes ?? 0}
      data-downvotes={entry.downvotes ?? 0}
      data-comment-count={entry.commentCount ?? 0}
    />
  ),
}));

const mockVoteSummaryProvider = vi.fn();
vi.mock('@/app/components/social/vote-summary-context', () => ({
  VoteSummaryProvider: ({
    entityType,
    entityIds,
    children,
  }: {
    entityType: string;
    entityIds: string[];
    children: React.ReactNode;
  }) => {
    mockVoteSummaryProvider({ entityType, entityIds });
    return <div data-testid="vote-summary-provider">{children}</div>;
  },
}));

function makeClimb(overrides: Partial<Climb> = {}): Climb {
  return {
    uuid: 'climb-1',
    setter_username: 'setter',
    name: 'Test Climb',
    frames: 'p1r1',
    angle: 40,
    ascensionist_count: 0,
    difficulty: 'V5',
    quality_average: '0',
    stars: 0,
    difficulty_error: '0',
    benchmark_difficulty: null,
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CrewLogbookView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ data: { user: { id: 'viewer-1' } }, status: 'authenticated' });
  });

  it('renders a sign-in prompt when unauthenticated', () => {
    mockUseWsAuthToken.mockReturnValue({ token: null, isAuthenticated: false, isLoading: false });
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    renderWithClient(<CrewLogbookView currentClimb={makeClimb()} boardType="kilter" />);

    expect(screen.getByTestId('empty-state').textContent).toBe("Sign in to see your crew's logbook for this climb");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('renders a spinner while auth is loading and does not hit the server', () => {
    mockUseWsAuthToken.mockReturnValue({ token: null, isAuthenticated: false, isLoading: true });
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    const { container } = renderWithClient(<CrewLogbookView currentClimb={makeClimb()} boardType="kilter" />);

    expect(container.querySelector('.MuiCircularProgress-root')).not.toBeNull();
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect(screen.queryByTestId('logbook-entry-card')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('renders an empty crew message when authenticated but no items returned', async () => {
    mockUseWsAuthToken.mockReturnValue({ token: 'tk', isAuthenticated: true, isLoading: false });
    mockRequest.mockResolvedValueOnce({ followingClimbAscents: { items: [] } });

    renderWithClient(<CrewLogbookView currentClimb={makeClimb()} boardType="kilter" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state').textContent).toBe('None of your crew have logged this climb yet');
    });
  });

  it('renders an error state when the query fails', async () => {
    mockUseWsAuthToken.mockReturnValue({ token: 'tk', isAuthenticated: true, isLoading: false });
    mockRequest.mockRejectedValueOnce(new Error('boom'));

    renderWithClient(<CrewLogbookView currentClimb={makeClimb()} boardType="kilter" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state').textContent).toBe(
        "Couldn't load your crew's logbook. Try again in a bit.",
      );
    });
  });

  it('renders a card per item and passes through status, user, social, and mirror-tag props', async () => {
    mockUseWsAuthToken.mockReturnValue({ token: 'tk', isAuthenticated: true, isLoading: false });
    mockRequest.mockResolvedValueOnce({
      followingClimbAscents: {
        items: [
          {
            uuid: 'tick-1',
            userId: 'user-1',
            userDisplayName: 'Alex',
            userAvatarUrl: null,
            climbUuid: 'climb-1',
            angle: 40,
            isMirror: true,
            status: 'flash',
            attemptCount: 1,
            quality: 5,
            comment: 'Nice',
            climbedAt: '2025-01-01T00:00:00Z',
            upvotes: 4,
            downvotes: 0,
            commentCount: 2,
          },
          {
            uuid: 'tick-2',
            userId: 'user-2',
            userDisplayName: 'Sam',
            userAvatarUrl: null,
            climbUuid: 'climb-1',
            angle: 50,
            isMirror: false,
            status: 'attempt',
            attemptCount: 4,
            quality: null,
            comment: '',
            climbedAt: '2025-01-02T00:00:00Z',
            upvotes: 0,
            downvotes: 1,
            commentCount: 0,
          },
        ],
      },
    });

    renderWithClient(<CrewLogbookView currentClimb={makeClimb()} boardType="tension" />);

    const cards = await screen.findAllByTestId('logbook-entry-card');
    expect(cards).toHaveLength(2);

    expect(cards[0].getAttribute('data-user-id')).toBe('user-1');
    expect(cards[0].getAttribute('data-display-name')).toBe('Alex');
    // Raw status is passed through — normalisation happens inside LogbookEntryCard.
    expect(cards[0].getAttribute('data-status')).toBe('flash');
    expect(cards[0].getAttribute('data-mirror-tag')).toBe('true');
    expect(cards[0].getAttribute('data-tick-uuid')).toBe('tick-1');
    expect(cards[0].getAttribute('data-upvotes')).toBe('4');
    expect(cards[0].getAttribute('data-comment-count')).toBe('2');

    expect(cards[1].getAttribute('data-user-id')).toBe('user-2');
    expect(cards[1].getAttribute('data-status')).toBe('attempt');
    expect(cards[1].getAttribute('data-attempts')).toBe('4');
    expect(cards[1].getAttribute('data-tick-uuid')).toBe('tick-2');

    // Bulk vote-summary provider is wired with every tick UUID exactly once.
    expect(mockVoteSummaryProvider).toHaveBeenCalledWith({
      entityType: 'tick',
      entityIds: ['tick-1', 'tick-2'],
    });
  });

  it('does not show mirror tag for non-tension boards', async () => {
    mockUseWsAuthToken.mockReturnValue({ token: 'tk', isAuthenticated: true, isLoading: false });
    mockRequest.mockResolvedValueOnce({
      followingClimbAscents: {
        items: [
          {
            uuid: 'tick-1',
            userId: 'user-1',
            userDisplayName: 'Alex',
            userAvatarUrl: null,
            climbUuid: 'climb-1',
            angle: 40,
            isMirror: true,
            status: 'send',
            attemptCount: 1,
            quality: 3,
            comment: '',
            climbedAt: '2025-01-01T00:00:00Z',
            upvotes: 0,
            downvotes: 0,
            commentCount: 0,
          },
        ],
      },
    });

    renderWithClient(<CrewLogbookView currentClimb={makeClimb()} boardType="kilter" />);

    const card = await screen.findByTestId('logbook-entry-card');
    expect(card.getAttribute('data-mirror-tag')).toBe('false');
  });
});

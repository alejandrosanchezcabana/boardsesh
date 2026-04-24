// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Climb } from '@/app/lib/types';
import { LogbookView } from '../logbook-view';

const mockUseBoardProvider = vi.fn();

vi.mock('../../board-provider/board-provider-context', () => ({
  useBoardProvider: () => mockUseBoardProvider(),
}));

vi.mock('@/app/components/ascent-status/ascent-status-icon', () => ({
  AscentStatusIcon: ({ status }: { status: string }) => <div data-testid="ascent-status-icon" data-status={status} />,
}));

vi.mock('@mui/material/Rating', () => ({
  default: ({ value }: { value: number }) => <div data-testid="rating">{value}</div>,
}));

vi.mock('@/app/components/ui/empty-state', () => ({
  EmptyState: ({ description }: { description: string }) => <div data-testid="empty-state">{description}</div>,
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
    return children;
  },
}));

vi.mock('@/app/components/social/vote-button', () => ({
  default: ({ entityId }: { entityId: string }) => <div data-testid="vote-button" data-entity-id={entityId} />,
}));

vi.mock('@/app/components/social/feed-comment-button', () => ({
  default: ({ entityId }: { entityId: string }) => <div data-testid="feed-comment-button" data-entity-id={entityId} />,
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

describe('LogbookView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBoardProvider.mockReturnValue({ logbook: [], boardName: 'kilter' });
  });

  it('renders an empty state when no ascents exist for the climb', () => {
    render(<LogbookView currentClimb={makeClimb()} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No ascents logged for this climb')).toBeTruthy();
  });

  it('caps the vote-summary batch at 100 tick UUIDs to match the backend input limit', () => {
    const ascents = Array.from({ length: 105 }, (_, i) => ({
      uuid: `persisted-${String(i).padStart(3, '0')}`,
      climb_uuid: 'climb-1',
      // Later index = more recent climbedAt, so ids sort desc by time.
      climbed_at: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      angle: 40,
      tries: 1,
      is_ascent: true,
      status: 'send' as const,
      is_mirror: false,
      quality: null,
      comment: '',
    }));

    mockUseBoardProvider.mockReturnValue({ boardName: 'kilter', logbook: ascents });

    render(<LogbookView currentClimb={makeClimb()} />);

    expect(mockVoteSummaryProvider).toHaveBeenCalledTimes(1);
    const { entityIds } = mockVoteSummaryProvider.mock.calls[0][0] as { entityIds: string[] };
    expect(entityIds).toHaveLength(100);
    // The 100 ids passed to the provider must be the most recent ascents
    // (newest-first), not an arbitrary slice.
    expect(entityIds[0]).toBe('persisted-104');
    expect(entityIds[99]).toBe('persisted-005');
  });

  it('suppresses the social footer and excludes temp- UUIDs from the vote-summary fetch for optimistic entries', () => {
    mockUseBoardProvider.mockReturnValue({
      boardName: 'kilter',
      logbook: [
        {
          uuid: 'temp-123',
          climb_uuid: 'climb-1',
          climbed_at: '2025-02-02T12:00:00Z',
          angle: 40,
          tries: 1,
          is_ascent: true,
          status: 'flash',
          is_mirror: false,
          quality: null,
          comment: 'optimistic',
        },
        {
          uuid: 'persisted-456',
          climb_uuid: 'climb-1',
          climbed_at: '2025-02-01T12:00:00Z',
          angle: 40,
          tries: 2,
          is_ascent: true,
          status: 'send',
          is_mirror: false,
          quality: 4,
          comment: 'saved',
        },
      ],
    });

    render(<LogbookView currentClimb={makeClimb()} />);

    // Only the persisted tick gets a like + comment footer — the optimistic
    // row must not try to vote on or comment against a tick the server
    // doesn't know about yet.
    const voteButtons = screen.getAllByTestId('vote-button');
    expect(voteButtons).toHaveLength(1);
    expect(voteButtons[0].getAttribute('data-entity-id')).toBe('persisted-456');

    const commentButtons = screen.getAllByTestId('feed-comment-button');
    expect(commentButtons).toHaveLength(1);
    expect(commentButtons[0].getAttribute('data-entity-id')).toBe('persisted-456');

    expect(mockVoteSummaryProvider).toHaveBeenCalledWith({
      entityType: 'tick',
      entityIds: ['persisted-456'],
    });
  });

  it('renders normalized status icons, mirrored tags, and ratings for successful ascents', () => {
    mockUseBoardProvider.mockReturnValue({
      boardName: 'tension',
      logbook: [
        {
          climb_uuid: 'climb-1',
          climbed_at: '2025-01-03T12:00:00Z',
          angle: 50,
          tries: 1,
          is_ascent: true,
          status: 'flash',
          is_mirror: true,
          quality: 3,
          comment: 'Mirrored flash',
        },
        {
          climb_uuid: 'climb-1',
          climbed_at: '2025-01-02T12:00:00Z',
          angle: 60,
          tries: 2,
          is_ascent: false,
          status: 'attempt',
          is_mirror: false,
          quality: null,
          comment: 'Not yet',
        },
      ],
    });

    render(<LogbookView currentClimb={makeClimb()} />);

    const statuses = screen.getAllByTestId('ascent-status-icon').map((node) => node.getAttribute('data-status'));
    expect(statuses).toEqual(['flash', 'attempt']);
    expect(screen.getByText('Mirrored')).toBeTruthy();
    expect(screen.getByText('Attempts: 1')).toBeTruthy();
    expect(screen.getByText('Attempts: 2')).toBeTruthy();
    expect(screen.getAllByTestId('rating')).toHaveLength(1);
    expect(screen.getByText('Mirrored flash')).toBeTruthy();
    expect(screen.getByText('Not yet')).toBeTruthy();
  });
});

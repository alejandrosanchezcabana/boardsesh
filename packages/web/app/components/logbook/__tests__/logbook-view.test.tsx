// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Climb } from '@/app/lib/types';

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

vi.mock('@/app/components/social/vote-summary-context', () => ({
  VoteSummaryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/app/components/social/vote-button', () => ({
  default: () => <div data-testid="vote-button" />,
}));

vi.mock('@/app/components/social/feed-comment-button', () => ({
  default: () => <div data-testid="feed-comment-button" />,
}));

import { LogbookView } from '../logbook-view';

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

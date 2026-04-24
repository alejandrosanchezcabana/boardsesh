// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PlayViewComments from '../play-view-comments';

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

describe('PlayViewComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBoardProvider.mockReturnValue({ logbook: [] });
  });

  it('renders nothing when no climb is selected', () => {
    const { container } = render(<PlayViewComments climbUuid={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders flash, send, and attempt statuses using shared status normalization', () => {
    mockUseBoardProvider.mockReturnValue({
      logbook: [
        {
          climb_uuid: 'climb-1',
          climbed_at: '2025-01-03T12:00:00Z',
          tries: 1,
          is_ascent: true,
          status: 'flash',
          quality: 4,
          comment: 'First go',
        },
        {
          climb_uuid: 'climb-1',
          climbed_at: '2025-01-02T12:00:00Z',
          tries: 3,
          is_ascent: true,
          status: undefined,
          quality: 2,
          comment: 'Worked it out',
        },
        {
          climb_uuid: 'climb-1',
          climbed_at: '2025-01-01T12:00:00Z',
          tries: 2,
          is_ascent: false,
          status: 'attempt',
          quality: null,
          comment: 'Still trying',
        },
      ],
    });

    render(<PlayViewComments climbUuid="climb-1" />);

    expect(screen.getByText('Your Ascents (3)')).toBeTruthy();
    expect(screen.getByText('Flash')).toBeTruthy();
    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText('Attempt')).toBeTruthy();
    expect(screen.getByText('2 tries')).toBeTruthy();
    expect(screen.getByText('3 tries')).toBeTruthy();

    const statuses = screen.getAllByTestId('ascent-status-icon').map((node) => node.getAttribute('data-status'));
    expect(statuses).toEqual(['flash', 'send', 'attempt']);
    expect(screen.getAllByTestId('rating')).toHaveLength(2);
    expect(screen.getByText('Still trying')).toBeTruthy();
  });
});

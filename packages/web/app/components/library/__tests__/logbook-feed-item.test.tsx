import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';

vi.mock('@/app/components/activity-feed/ascent-thumbnail', () => ({
  default: () => <div data-testid="ascent-thumbnail" />,
}));

vi.mock('@mui/material/Menu', () => ({
  default: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
}));

import LogbookFeedItem from '../logbook-feed-item';

function makeItem(overrides: Partial<AscentFeedItem> = {}): AscentFeedItem {
  return {
    uuid: 'tick-1',
    climbUuid: 'climb-1',
    climbName: 'Orbital Drift',
    setterUsername: 'setter',
    boardType: 'kilter',
    layoutId: null,
    angle: 40,
    isMirror: false,
    status: 'send',
    attemptCount: 3,
    quality: 4,
    difficulty: 22,
    difficultyName: '7a/V6',
    consensusDifficulty: 22,
    consensusDifficultyName: '7a/V6',
    isBenchmark: false,
    comment: 'Felt great',
    climbedAt: '2026-04-10T12:00:00.000Z',
    frames: null,
    ...overrides,
  };
}

describe('LogbookFeedItem', () => {
  it('shows edit and delete actions when both callbacks are provided', async () => {
    render(<LogbookFeedItem item={makeItem()} onEdit={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Open tick actions'));

    expect(await screen.findByText('Edit')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('calls onEdit with the selected feed item', async () => {
    const item = makeItem();
    const onEdit = vi.fn();

    render(<LogbookFeedItem item={item} onEdit={onEdit} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Open tick actions'));
    fireEvent.click(await screen.findByText('Edit'));

    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it('calls onDelete with the tick uuid', async () => {
    const onDelete = vi.fn();

    render(<LogbookFeedItem item={makeItem({ uuid: 'tick-123' })} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('Open tick actions'));
    fireEvent.click(await screen.findByText('Delete'));

    expect(onDelete).toHaveBeenCalledWith('tick-123');
  });
});

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LogbookFeedItem from '../logbook-feed-item';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';

vi.mock('@/app/components/activity-feed/ascent-thumbnail', () => ({
  default: () => <div data-testid="ascent-thumbnail" />,
}));

vi.mock('../post-to-instagram-dialog', () => ({
  default: () => null,
}));

vi.mock('@/app/components/beta-videos/attach-beta-link-dialog', () => ({
  default: () => null,
}));

const baseItem: AscentFeedItem = {
  uuid: 'tick-1',
  climbUuid: 'climb-1',
  climbName: 'Texas Sun',
  setterUsername: 'gabe',
  boardType: 'kilter',
  layoutId: 8,
  angle: 35,
  isMirror: false,
  status: 'send',
  attemptCount: 2,
  quality: 3,
  difficulty: 22,
  difficultyName: '7a/V6',
  consensusDifficulty: 22,
  consensusDifficultyName: '7a/V6',
  isBenchmark: false,
  comment: '',
  climbedAt: new Date().toISOString(),
  frames: 'encoded',
};

describe('LogbookFeedItem', () => {
  it('shows Post to Instagram for supported Kilter items when enabled', async () => {
    render(<LogbookFeedItem item={baseItem} allowInstagramPosting />);

    fireEvent.click(screen.getByLabelText('Open climb actions'));

    expect(await screen.findByText('Post to Instagram')).toBeTruthy();
  });

  it('hides the Instagram action for non-Kilter items', () => {
    render(
      <LogbookFeedItem
        item={{ ...baseItem, boardType: 'tension' }}
        allowInstagramPosting
      />,
    );

    expect(screen.queryByLabelText('Open climb actions')).toBeNull();
  });

  it('shows Link Instagram video when linking is enabled without posting', async () => {
    render(<LogbookFeedItem item={baseItem} allowInstagramLinking />);

    fireEvent.click(screen.getByLabelText('Open climb actions'));

    expect(await screen.findByText('Link Instagram video')).toBeTruthy();
    expect(screen.queryByText('Post to Instagram')).toBeNull();
  });

  it('hides all Instagram actions when neither posting nor linking is enabled', () => {
    render(<LogbookFeedItem item={baseItem} allowInstagramPosting={false} allowInstagramLinking={false} />);

    expect(screen.queryByLabelText('Open climb actions')).toBeNull();
  });
});

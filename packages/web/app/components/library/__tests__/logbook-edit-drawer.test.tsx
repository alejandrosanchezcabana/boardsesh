import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';

const mockMutateAsync = vi.fn();

vi.mock('@/app/components/swipeable-drawer/swipeable-drawer', () => ({
  default: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: React.ReactNode;
    children: React.ReactNode;
  }) => (open ? <div data-testid="mock-swipeable-drawer"><div>{title}</div>{children}</div> : null),
}));

vi.mock('@/app/hooks/use-update-tick', () => ({
  useUpdateTick: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/app/hooks/use-grade-format', () => ({
  useGradeFormat: () => ({
    loaded: true,
    formatGrade: (difficulty: string | null | undefined) => difficulty?.split('/')[1] ?? difficulty ?? null,
    getGradeColor: () => undefined,
  }),
}));

vi.mock('@/app/hooks/use-is-dark-mode', () => ({
  useIsDarkMode: () => false,
}));

import LogbookEditDrawer from '../logbook-edit-drawer';

function makeItem(overrides: Partial<AscentFeedItem> = {}): AscentFeedItem {
  return {
    uuid: 'tick-1',
    climbUuid: 'climb-1',
    climbName: 'Orbit',
    setterUsername: 'setter',
    boardType: 'kilter',
    layoutId: 1,
    angle: 40,
    isMirror: false,
    status: 'send',
    attemptCount: 1,
    quality: 4,
    difficulty: 22,
    difficultyName: '7a/V6',
    consensusDifficulty: 22,
    consensusDifficultyName: '7a/V6',
    isBenchmark: false,
    comment: 'Close to perfect',
    climbedAt: '2026-04-10T12:00:00.000Z',
    frames: 'p1r1',
    ...overrides,
  };
}

describe('LogbookEditDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      uuid: 'tick-1',
    });
  });

  it('prefills the compact tick fields from the selected logbook item', async () => {
    render(<LogbookEditDrawer open item={makeItem({ attemptCount: 3, quality: 5, comment: 'Dialled now' })} onClose={vi.fn()} />);

    expect(await screen.findByTestId('logbook-edit-drawer')).toBeDefined();
    expect((screen.getByLabelText('Edit tick comment') as HTMLInputElement).value).toBe('Dialled now');
    expect((await screen.findByTestId('quick-tick-grade')).textContent).toContain('V6');
    expect(screen.getByTestId('quick-tick-rating').textContent).toContain('5');
    expect(screen.getByTestId('quick-tick-attempt').textContent).toContain('3');
  });

  it('preserves an existing one-try send when saving as an ascent', async () => {
    const onClose = vi.fn();

    render(<LogbookEditDrawer open item={makeItem({ status: 'send', attemptCount: 1 })} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Save as ascent'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        uuid: 'tick-1',
        input: {
          status: 'send',
          attemptCount: 1,
          quality: 4,
          difficulty: 22,
          comment: 'Close to perfect',
        },
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('clears quality when saving as an attempt', async () => {
    const onClose = vi.fn();

    render(<LogbookEditDrawer open item={makeItem({ status: 'flash', attemptCount: 1, quality: 5 })} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Save as attempt'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        uuid: 'tick-1',
        input: {
          status: 'attempt',
          attemptCount: 1,
          quality: null,
          difficulty: 22,
          comment: 'Close to perfect',
        },
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the drawer open when the update fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network down'));
    const onClose = vi.fn();

    render(<LogbookEditDrawer open item={makeItem()} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Save as ascent'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('logbook-edit-drawer')).toBeDefined();
  });
});

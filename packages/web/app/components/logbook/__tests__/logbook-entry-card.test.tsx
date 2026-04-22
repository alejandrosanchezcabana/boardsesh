// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LogbookEntryCard } from '../logbook-entry-card';

vi.mock('@/app/components/ascent-status/ascent-status-icon', () => ({
  AscentStatusIcon: ({ status }: { status: string }) => (
    <div data-testid="ascent-status-icon" data-status={status} />
  ),
}));

vi.mock('@mui/material/Rating', () => ({
  default: ({ value }: { value: number }) => <div data-testid="rating">{value}</div>,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const baseEntry = {
  climbedAt: '2025-01-02T12:00:00Z',
  angle: 40,
  isMirror: false,
  status: 'send' as const,
  attemptCount: 3,
  quality: 4,
  comment: 'Nice moves',
};

describe('LogbookEntryCard', () => {
  it('renders entry fields without a user header when user is absent', () => {
    render(<LogbookEntryCard entry={baseEntry} currentClimbAngle={40} showMirrorTag={false} />);

    expect(screen.getByText('Attempts: 3')).toBeTruthy();
    expect(screen.getByText('Nice moves')).toBeTruthy();
    expect(screen.getByTestId('rating').textContent).toBe('4');
    // No user link / avatar without a user prop
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders a profile link and display name when user is provided', () => {
    render(
      <LogbookEntryCard
        entry={baseEntry}
        currentClimbAngle={40}
        showMirrorTag={false}
        user={{ userId: 'user-42', displayName: 'Alex', avatarUrl: 'https://example.test/a.png' }}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/profile/user-42');
    }
    expect(screen.getByText('Alex')).toBeTruthy();
  });

  it('falls back to "Climber" when the user has no display name', () => {
    render(
      <LogbookEntryCard
        entry={baseEntry}
        currentClimbAngle={40}
        showMirrorTag={false}
        user={{ userId: 'user-42', displayName: null, avatarUrl: null }}
      />,
    );

    expect(screen.getByText('Climber')).toBeTruthy();
  });

  it('hides the angle chip and status icon when the entry angle matches the current climb angle', () => {
    render(<LogbookEntryCard entry={baseEntry} currentClimbAngle={40} showMirrorTag={false} />);
    expect(screen.queryByTestId('ascent-status-icon')).toBeNull();
  });

  it('shows the angle chip and status icon when entry angle differs from the current climb angle', () => {
    render(
      <LogbookEntryCard
        entry={{ ...baseEntry, angle: 50 }}
        currentClimbAngle={40}
        showMirrorTag={false}
      />,
    );
    const icon = screen.getByTestId('ascent-status-icon');
    expect(icon.getAttribute('data-status')).toBe('send');
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('shows the Mirrored chip only when showMirrorTag is true and the entry is mirrored', () => {
    const { rerender } = render(
      <LogbookEntryCard
        entry={{ ...baseEntry, isMirror: true }}
        currentClimbAngle={40}
        showMirrorTag={false}
      />,
    );
    expect(screen.queryByText('Mirrored')).toBeNull();

    rerender(
      <LogbookEntryCard
        entry={{ ...baseEntry, isMirror: true }}
        currentClimbAngle={40}
        showMirrorTag={true}
      />,
    );
    expect(screen.getByText('Mirrored')).toBeTruthy();
  });

  it('hides the rating when the entry is an attempt', () => {
    render(
      <LogbookEntryCard
        entry={{ ...baseEntry, status: 'attempt', quality: null }}
        currentClimbAngle={40}
        showMirrorTag={false}
      />,
    );
    expect(screen.queryByTestId('rating')).toBeNull();
  });

  it('falls back to attempt when status is an unknown string', () => {
    render(
      <LogbookEntryCard
        entry={{
          ...baseEntry,
          status: 'weird-string',
          quality: null,
          angle: 50,
        }}
        currentClimbAngle={40}
        showMirrorTag={false}
      />,
    );
    const icon = screen.getByTestId('ascent-status-icon');
    expect(icon.getAttribute('data-status')).toBe('attempt');
    expect(screen.queryByTestId('rating')).toBeNull();
  });
});

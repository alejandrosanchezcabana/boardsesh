import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import React from 'react';

// --- Mocks ---

type GradeFormatMock = {
  gradeFormat: 'v-grade' | 'font';
  formatGrade: (d: string | null | undefined) => string | null;
  getGradeColor: (d?: string | null, dk?: boolean) => string | undefined;
  loaded: boolean;
  setGradeFormat: ReturnType<typeof vi.fn>;
};
const defaultGradeFormat: GradeFormatMock = {
  gradeFormat: 'v-grade',
  formatGrade: (d: string | null | undefined) => {
    if (!d) return null;
    const match = d.match(/V\d+\+?/i);
    return match ? match[0].toUpperCase() : null;
  },
  getGradeColor: () => '#888',
  loaded: true,
  setGradeFormat: vi.fn(),
};
const mockUseGradeFormat = vi.fn<() => GradeFormatMock>(() => defaultGradeFormat);
vi.mock('@/app/hooks/use-grade-format', () => ({
  useGradeFormat: () => mockUseGradeFormat(),
}));

vi.mock('@/app/lib/grade-colors', () => ({
  getGradeColor: (d: string | null | undefined) => (d ? '#vivid' : undefined),
}));

import type { ActivityFeedItem } from '@boardsesh/shared-schema';
import SessionSummaryFeedItem from '../session-summary-feed-item';

// --- Helpers ---

const makeItem = (overrides: Partial<ActivityFeedItem> = {}): ActivityFeedItem =>
  ({
    id: '1',
    type: 'session_summary',
    actorUserId: 'user1',
    actorDisplayName: 'Tester',
    actorAvatarUrl: null,
    metadata: JSON.stringify({
      totalSends: 5,
      totalAttempts: 3,
      gradeDistribution: [{ grade: '6a/V3', count: 3 }],
    }),
    createdAt: new Date().toISOString(),
    ...overrides,
  }) as unknown as ActivityFeedItem;

describe('SessionSummaryFeedItem grade format integration', () => {
  beforeEach(() => {
    mockUseGradeFormat.mockReturnValue({ ...defaultGradeFormat });
  });

  it('renders grade labels with V-grade format', () => {
    render(<SessionSummaryFeedItem item={makeItem()} />);
    expect(screen.getByText('V3')).toBeTruthy();
  });

  it('shows Skeleton for grade labels when loading', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      loaded: false,
    });
    const { container } = render(<SessionSummaryFeedItem item={makeItem()} />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Font grade labels', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      gradeFormat: 'font',
      formatGrade: (d: string | null | undefined) => {
        if (!d) return null;
        const slashIndex = d.indexOf('/');
        if (slashIndex > 0) return d.substring(0, slashIndex).toUpperCase();
        const match = d.match(/\d[abc]\+?/i);
        return match ? match[0].toUpperCase() : null;
      },
    });
    render(<SessionSummaryFeedItem item={makeItem()} />);
    expect(screen.getByText('6A')).toBeTruthy();
  });
});

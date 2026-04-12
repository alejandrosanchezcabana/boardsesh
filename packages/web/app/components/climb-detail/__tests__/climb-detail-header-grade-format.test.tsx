// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/app/hooks/use-is-dark-mode', () => ({ useIsDarkMode: () => false }));

const defaultGradeFormat = {
  gradeFormat: 'v-grade' as const,
  formatGrade: (d: string | null | undefined) => {
    if (!d) return null;
    const match = d.match(/V\d+\+?/i);
    return match ? match[0].toUpperCase() : null;
  },
  getGradeColor: () => '#888',
  loaded: true,
  setGradeFormat: vi.fn(),
};
const mockUseGradeFormat = vi.fn(() => defaultGradeFormat);
vi.mock('@/app/hooks/use-grade-format', () => ({
  useGradeFormat: (...args: unknown[]) => mockUseGradeFormat(...args),
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
    colors: { primary: '#8C4A52' },
    typography: {
      fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 },
      fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
  },
}));

vi.mock('@/app/lib/format-climb-stats', () => ({
  formatSends: (n: number) => `${n} send${n !== 1 ? 's' : ''}`,
}));

// Import component after mocks
import ClimbDetailHeader from '../climb-detail-header';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeClimb = (overrides = {}) =>
  ({
    name: 'Test Climb',
    difficulty: '6a/V3',
    quality_average: '3.5',
    benchmark_difficulty: null,
    setter_username: 'setter',
    ascensionist_count: 10,
    ...overrides,
  }) as unknown as Parameters<typeof ClimbDetailHeader>[0]['climb'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  mockUseGradeFormat.mockReset();
  mockUseGradeFormat.mockReturnValue(defaultGradeFormat);
});

describe('V-grade format (default)', () => {
  it('renders V-grade when loaded', () => {
    render(<ClimbDetailHeader climb={makeClimb()} />);
    expect(screen.getByText('V3')).toBeTruthy();
  });

  it('renders "project" when difficulty is null', () => {
    render(<ClimbDetailHeader climb={makeClimb({ difficulty: null })} />);
    expect(screen.getByText('project')).toBeTruthy();
  });
});

describe('Font grade format', () => {
  it('renders Font grade when format is font', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      gradeFormat: 'font' as const,
      formatGrade: (d: string | null | undefined) => {
        if (!d) return null;
        const before = d.split('/')[0];
        return before ? before.toUpperCase() : null;
      },
    });

    render(<ClimbDetailHeader climb={makeClimb()} />);
    expect(screen.getByText('6A')).toBeTruthy();
  });
});

describe('loading state', () => {
  it('shows Skeleton when loaded=false and difficulty exists', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      loaded: false,
    });

    const { container } = render(<ClimbDetailHeader climb={makeClimb()} />);
    expect(container.querySelector('.MuiSkeleton-root')).toBeTruthy();
    expect(screen.queryByText('V3')).toBeNull();
  });

  it('does not show Skeleton when loaded=false and difficulty is null', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      loaded: false,
    });

    const { container } = render(
      <ClimbDetailHeader climb={makeClimb({ difficulty: null })} />,
    );
    expect(container.querySelector('.MuiSkeleton-root')).toBeNull();
    expect(screen.getByText('project')).toBeTruthy();
  });

  it('shows grade after loading completes', () => {
    // Default mock already has loaded: true
    render(<ClimbDetailHeader climb={makeClimb()} />);
    expect(screen.getByText('V3')).toBeTruthy();
  });
});

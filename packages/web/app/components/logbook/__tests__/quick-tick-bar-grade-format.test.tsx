import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// --- Mocks (must be hoisted before imports of the component under test) ---

vi.mock('@/app/hooks/use-is-dark-mode', () => ({ useIsDarkMode: () => false }));

interface GradeFormatMock {
  gradeFormat: 'v-grade' | 'font';
  formatGrade: (d: string | null | undefined) => string | null;
  getGradeColor: (d?: string | null, dk?: boolean) => string | undefined;
  loaded: boolean;
  setGradeFormat: ReturnType<typeof vi.fn>;
}
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

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
    colors: { primary: '#8C4A52', error: '#f44336', success: '#4caf50', successHover: '#388e3c' },
    opacity: { subtle: 0.6 },
    typography: {
      fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 },
      fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
  },
}));

vi.mock('../../board-provider/board-provider-context', () => ({
  useBoardProvider: () => ({
    saveTick: vi.fn(),
    logbook: [],
  }),
}));

vi.mock('@/app/lib/board-data', () => ({
  TENSION_KILTER_GRADES: [
    { difficulty_id: 16, difficulty_name: '6a/V3', v_grade: 'V3', font_grade: '6a' },
    { difficulty_id: 22, difficulty_name: '7a/V6', v_grade: 'V6', font_grade: '7a' },
  ],
}));

vi.mock('react-swipeable', () => ({
  useSwipeable: () => ({}),
}));

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('../quick-tick-bar.module.css', () => ({
  default: {
    tickBar: 'tickBar',
    controls: 'controls',
    rating: 'rating',
    gradeLabel: 'gradeLabel',
    attemptButton: 'attemptButton',
    attemptNumber: 'attemptNumber',
    attemptLabel: 'attemptLabel',
  },
}));

// Import after mocks.
import { QuickTickBar } from '../quick-tick-bar';

// --- Fixtures ---

const defaultProps = {
  currentClimb: {
    uuid: 'test-uuid',
    name: 'Test Climb',
    difficulty: '6a/V3',
    quality_average: '3.0',
    setter_username: 'tester',
    ascensionist_count: 5,
    benchmark_difficulty: null,
    mirrored: false,
  } as unknown as Parameters<typeof QuickTickBar>[0]['currentClimb'],
  angle: 40 as unknown as Parameters<typeof QuickTickBar>[0]['angle'],
  boardDetails: { layout_id: 1, size_id: 1, set_ids: '1', layout_name: 'Test' } as unknown as Parameters<typeof QuickTickBar>[0]['boardDetails'],
  onSave: vi.fn(),
  comment: '',
  commentSlot: null,
};

describe('QuickTickBar grade format integration', () => {
  afterEach(() => {
    mockUseGradeFormat.mockReturnValue(defaultGradeFormat);
  });

  it('shows Skeleton when grade format not loaded', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      loaded: false,
    });

    const { container } = render(<QuickTickBar {...defaultProps} />);

    // A MUI Skeleton should be rendered in place of the grade label.
    const skeleton = container.querySelector('.MuiSkeleton-root');
    expect(skeleton).not.toBeNull();

    // The grade text element should not be present.
    expect(screen.queryByTestId('quick-tick-grade')).toBeNull();
  });

  it('shows formatted grade when loaded', () => {
    // Default mock has loaded: true and v-grade formatter.
    render(<QuickTickBar {...defaultProps} />);

    const gradeEl = screen.getByTestId('quick-tick-grade');
    expect(gradeEl.textContent).toBe('V3');
  });

  it('shows Font grade when format is font', () => {
    mockUseGradeFormat.mockReturnValue({
      ...defaultGradeFormat,
      gradeFormat: 'font',
      formatGrade: (d: string | null | undefined) => {
        if (!d) return null;
        // Extract the Font portion before the slash and uppercase it.
        const slashIndex = d.indexOf('/');
        if (slashIndex > 0) {
          return d.substring(0, slashIndex).toUpperCase();
        }
        const match = d.match(/\d[abc]\+?/i);
        return match ? match[0].toUpperCase() : null;
      },
    });

    render(<QuickTickBar {...defaultProps} />);

    const gradeEl = screen.getByTestId('quick-tick-grade');
    expect(gradeEl.textContent).toBe('6A');
  });
});

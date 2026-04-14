import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('@/app/components/charts/css-bar-chart', () => ({
  CssBarChart: (props: { ariaLabel?: string }) => (
    <div data-testid="css-bar-chart" aria-label={props.ariaLabel} />
  ),
}));

vi.mock('@/app/components/charts/session-grade-bars', () => ({
  buildSessionGradeBars: () => [],
  SESSION_GRADE_LEGEND: [
    { label: 'Flash', color: '#6B908099' },
    { label: 'Send', color: '#B8524C99' },
    { label: 'Attempt', color: '#D1D5DB99' },
  ],
}));

vi.mock('@/app/hooks/use-grade-format', () => ({
  useGradeFormat: () => ({
    gradeFormat: 'v-grade',
    formatGrade: (g: string | null | undefined) => g ?? null,
    getGradeColor: vi.fn(),
    loaded: true,
    setGradeFormat: vi.fn(),
  }),
}));

import SessionOverviewPanel, { buildSessionSummaryParts } from '../session-overview-panel';

type SessionOverviewPanelProps = React.ComponentProps<typeof SessionOverviewPanel>;

function makeProps(overrides: Partial<SessionOverviewPanelProps> = {}): SessionOverviewPanelProps {
  return {
    totalSends: 5,
    totalFlashes: 2,
    totalAttempts: 3,
    tickCount: 8,
    gradeDistribution: [],
    boardTypes: [],
    hardestGrade: null,
    durationMinutes: null,
    goal: null,
    ...overrides,
  };
}

describe('SessionOverviewPanel', () => {
  it('shows sends/flashes/attempts/tickCount chips (sends excludes flashes)', () => {
    render(<SessionOverviewPanel {...makeProps()} />);

    // totalSends=5 includes 2 flashes, so sends chip shows 5-2=3
    expect(screen.getByText('3 sends')).toBeTruthy();
    expect(screen.getByText('2 flashes')).toBeTruthy();
    expect(screen.getByText('3 attempts')).toBeTruthy();
    expect(screen.getByText('8 climbs')).toBeTruthy();
  });

  it('shows duration chip when durationMinutes provided', () => {
    render(<SessionOverviewPanel {...makeProps({ durationMinutes: 45 })} />);

    expect(screen.getByText('45min')).toBeTruthy();
  });

  it('shows hardest grade chip', () => {
    render(<SessionOverviewPanel {...makeProps({ hardestGrade: 'V5' })} />);

    expect(screen.getByText('Hardest: V5')).toBeTruthy();
  });

  it('shows board type chips', () => {
    render(<SessionOverviewPanel {...makeProps({ boardTypes: ['kilter', 'tension'] })} />);

    expect(screen.getByText('Kilter')).toBeTruthy();
    expect(screen.getByText('Tension')).toBeTruthy();
  });

  it('renders grade distribution chart when gradeDistribution is non-empty', () => {
    const props = makeProps({
      gradeDistribution: [{ grade: 'V5', flash: 2, send: 3, attempt: 1 }],
    });

    render(<SessionOverviewPanel {...props} />);

    expect(screen.getByTestId('css-bar-chart')).toBeTruthy();
    expect(screen.getByText('Grade Distribution')).toBeTruthy();
  });

  it('does not render grade distribution chart when gradeDistribution is empty', () => {
    render(<SessionOverviewPanel {...makeProps({ gradeDistribution: [] })} />);

    expect(screen.queryByTestId('css-bar-chart')).toBeNull();
  });

  it('shows goal text when provided', () => {
    render(<SessionOverviewPanel {...makeProps({ goal: 'Send V7' })} />);

    expect(screen.getByText('Goal: Send V7')).toBeTruthy();
  });

  describe('formatDuration', () => {
    it('shows minutes for durations under 60', () => {
      render(<SessionOverviewPanel {...makeProps({ durationMinutes: 45 })} />);
      expect(screen.getByText('45min')).toBeTruthy();
    });

    it('shows hours and minutes for durations >= 60', () => {
      render(<SessionOverviewPanel {...makeProps({ durationMinutes: 90 })} />);
      expect(screen.getByText('1h 30min')).toBeTruthy();
    });

    it('shows exact hours without minutes remainder', () => {
      render(<SessionOverviewPanel {...makeProps({ durationMinutes: 120 })} />);
      expect(screen.getByText('2h')).toBeTruthy();
    });
  });

  it('uses singular form for 1 send', () => {
    render(<SessionOverviewPanel {...makeProps({ totalSends: 1, totalFlashes: 0 })} />);
    expect(screen.getByText('1 send')).toBeTruthy();
  });

  it('uses singular form for 1 flash', () => {
    render(<SessionOverviewPanel {...makeProps({ totalFlashes: 1 })} />);
    expect(screen.getByText('1 flash')).toBeTruthy();
  });

  it('uses singular form for 1 climb', () => {
    render(<SessionOverviewPanel {...makeProps({ tickCount: 1 })} />);
    expect(screen.getByText('1 climb')).toBeTruthy();
  });

  it('hides flashes chip when totalFlashes is 0', () => {
    render(<SessionOverviewPanel {...makeProps({ totalFlashes: 0 })} />);
    expect(screen.queryByText(/flash/)).toBeNull();
  });

  it('hides attempts chip when totalAttempts is 0', () => {
    render(<SessionOverviewPanel {...makeProps({ totalAttempts: 0 })} />);
    expect(screen.queryByText(/attempt/)).toBeNull();
  });

  it('hides sends chip when all sends are flashes', () => {
    render(<SessionOverviewPanel {...makeProps({ totalSends: 3, totalFlashes: 3 })} />);
    expect(screen.getByText('3 flashes')).toBeTruthy();
    expect(screen.queryByText(/send/)).toBeNull();
  });

  it('handles totalFlashes > totalSends gracefully (no negative sends)', () => {
    // Defensive: should not happen in practice, but guard against it
    render(<SessionOverviewPanel {...makeProps({ totalSends: 1, totalFlashes: 3 })} />);
    expect(screen.getByText('3 flashes')).toBeTruthy();
    expect(screen.queryByText(/send/)).toBeNull();
  });

  it('does not show duration chip when durationMinutes is null', () => {
    render(<SessionOverviewPanel {...makeProps({ durationMinutes: null })} />);
    expect(screen.queryByText(/min/)).toBeNull();
  });
});

describe('buildSessionSummaryParts', () => {
  const base = { totalFlashes: 0, totalSends: 0, totalAttempts: 0, tickCount: 0 };

  it('subtracts flashes from sends', () => {
    const parts = buildSessionSummaryParts({ ...base, totalSends: 5, totalFlashes: 2, tickCount: 5 });
    expect(parts).toContain('2 flashes');
    expect(parts).toContain('3 sends');
  });

  it('omits sends when all sends are flashes', () => {
    const parts = buildSessionSummaryParts({ ...base, totalSends: 3, totalFlashes: 3, tickCount: 3 });
    expect(parts).toContain('3 flashes');
    expect(parts.find((p) => p.includes('send'))).toBeUndefined();
  });

  it('handles totalFlashes > totalSends gracefully', () => {
    const parts = buildSessionSummaryParts({ ...base, totalSends: 1, totalFlashes: 3, tickCount: 3 });
    expect(parts).toContain('3 flashes');
    expect(parts.find((p) => p.includes('send'))).toBeUndefined();
  });

  it('includes hardest grade when provided', () => {
    const parts = buildSessionSummaryParts({ ...base, tickCount: 1, hardestGrade: 'V5' });
    expect(parts).toContain('Hardest: V5');
  });

  it('applies formatGrade to hardest grade', () => {
    const parts = buildSessionSummaryParts({
      ...base, tickCount: 1, hardestGrade: 'V5', formatGrade: () => '5c',
    });
    expect(parts).toContain('Hardest: 5c');
  });
});

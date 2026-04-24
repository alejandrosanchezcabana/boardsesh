// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { CssBarChartBar, GroupedBar } from '@/app/components/charts/css-bar-chart';
import type { LayoutLegendEntry, VPointsTimelineData } from '../../utils/chart-data-builders';
import StatsSummary from '../stats-summary';
import type { StatsSummaryProps } from '../stats-summary';

// Mock dependencies before component import
vi.mock('@/app/components/charts/css-bar-chart', () => ({
  CssBarChart: (props: { ariaLabel?: string }) => <div data-testid="css-bar-chart">{props.ariaLabel}</div>,
  GroupedBarChart: (props: { ariaLabel?: string }) => <div data-testid="grouped-bar-chart">{props.ariaLabel}</div>,
}));

vi.mock('../v-points-chart', () => ({
  default: () => <div data-testid="v-points-chart" />,
}));

vi.mock('@/app/components/ui/empty-state', () => ({
  EmptyState: (props: { description: string }) => <div data-testid="empty-state">{props.description}</div>,
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: {
    colors: { primary: '#8C4A52' },
    transitions: { normal: '200ms ease' },
    shadows: { md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    borderRadius: { md: 8, lg: 12, xl: 16, full: 9999 },
  },
}));

vi.mock('@/app/components/ascent-status/ascent-status-icon', () => ({
  AscentStatusIcon: (props: { status: string; testId?: string }) => (
    <div data-testid={props.testId ?? 'ascent-status-icon'} data-status={props.status} />
  ),
}));

function createDefaultProps(overrides: Partial<StatsSummaryProps> = {}): StatsSummaryProps {
  return {
    statisticsSummary: {
      totalAscents: 42,
      layoutPercentages: [
        {
          layoutKey: 'kilter-1',
          boardType: 'kilter',
          layoutId: 1,
          displayName: 'Kilter Original',
          count: 30,
          percentage: 71,
          color: 'hsla(190, 55%, 52%, 0.7)',
          grades: { V3: 10, V4: 20 },
        },
        {
          layoutKey: 'tension-9',
          boardType: 'tension',
          layoutId: 9,
          displayName: 'Tension Classic',
          count: 12,
          percentage: 29,
          color: 'hsla(350, 50%, 58%, 0.7)',
          grades: { V3: 5, V5: 7 },
        },
      ],
    },
    hardestSend: {
      label: 'V8',
      color: '#123456',
      textColor: '#ffffff',
      status: 'send',
    },
    hardestFlash: {
      label: 'V7',
      color: '#654321',
      textColor: '#ffffff',
      status: 'flash',
    },
    loadingProfileStats: false,
    loadingAggregated: false,
    weeklyBars: null,
    aggregatedStackedBars: {
      bars: [{ label: 'V3', segments: [{ value: 5, color: '#ff0000' }] }] as CssBarChartBar[],
      legendEntries: [{ label: 'Kilter', color: '#ff0000' }] as LayoutLegendEntry[],
    },
    aggregatedFlashRedpointBars: null,
    vPointsTimeline: null,
    ...overrides,
  };
}

describe('StatsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when loadingProfileStats is true', () => {
    const { container } = render(<StatsSummary {...createDefaultProps({ loadingProfileStats: true })} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when totalAscents is 0', () => {
    const { container } = render(
      <StatsSummary
        {...createDefaultProps({
          statisticsSummary: { totalAscents: 0, layoutPercentages: [] },
        })}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders total ascents count', () => {
    render(<StatsSummary {...createDefaultProps()} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('problems')).toBeTruthy();
    expect(screen.queryByText('Problems')).toBeNull();
  });

  it('renders hardest send and flash grades with status badges', () => {
    render(<StatsSummary {...createDefaultProps()} />);

    expect(screen.getByText('V8')).toBeTruthy();
    expect(screen.getByText('V7')).toBeTruthy();
    expect(screen.getByText('send')).toBeTruthy();
    expect(screen.getByText('flash')).toBeTruthy();
    expect(screen.queryByText('Hardest Send')).toBeNull();
    expect(screen.queryByText('Hardest Flash')).toBeNull();
    expect(screen.getByTestId('hardest-send-status').getAttribute('data-status')).toBe('send');
    expect(screen.getByTestId('hardest-flash-status').getAttribute('data-status')).toBe('flash');
  });

  it('renders layout percentage bar when multiple layouts', () => {
    render(<StatsSummary {...createDefaultProps()} />);
    // Inline labels show last word of display name + percentage when >= 15%
    expect(screen.getByText('Original 71%')).toBeTruthy();
    expect(screen.getByText('Classic 29%')).toBeTruthy();
  });

  it('does not render percentage bar with single layout', () => {
    const props = createDefaultProps({
      statisticsSummary: {
        totalAscents: 10,
        layoutPercentages: [
          {
            layoutKey: 'kilter-1',
            boardType: 'kilter',
            layoutId: 1,
            displayName: 'Kilter Original',
            count: 10,
            percentage: 100,
            color: 'hsla(190, 55%, 52%, 0.7)',
            grades: { V3: 10 },
          },
        ],
      },
    });
    render(<StatsSummary {...props} />);
    expect(screen.queryByText(/Kilter Original \(100%\)/)).toBeNull();
  });

  it('renders grade distribution section', () => {
    render(<StatsSummary {...createDefaultProps()} />);
    expect(screen.getByText('Grade Distribution')).toBeTruthy();
    expect(
      screen.getAllByTestId('css-bar-chart').some((chart) => chart.textContent === 'Grade distribution across boards'),
    ).toBe(true);
  });

  it('renders activity before grade distribution when weekly bars are available', () => {
    const weeklyBars: CssBarChartBar[] = [
      {
        key: '2026-W1',
        label: 'W1',
        segments: [
          { value: 2, color: '#ff0000', label: 'V3' },
          { value: 1, color: '#00ff00', label: 'V4' },
        ],
      },
    ];

    render(<StatsSummary {...createDefaultProps({ weeklyBars })} />);

    expect(screen.getByText('Activity')).toBeTruthy();

    const chartLabels = screen.getAllByTestId('css-bar-chart').map((chart) => chart.textContent);
    expect(chartLabels).toEqual(['Weekly attempts by difficulty', 'Grade distribution across boards']);
  });

  it('omits activity when no weekly bars are available', () => {
    render(<StatsSummary {...createDefaultProps({ weeklyBars: null })} />);

    expect(screen.queryByText('Activity')).toBeNull();
    expect(screen.getAllByTestId('css-bar-chart')).toHaveLength(1);
  });

  it('shows loading spinner when loadingAggregated is true', () => {
    render(<StatsSummary {...createDefaultProps({ loadingAggregated: true })} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows empty state when no aggregated bars', () => {
    render(<StatsSummary {...createDefaultProps({ aggregatedStackedBars: null })} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No ascent data for this period')).toBeTruthy();
  });

  it('renders flash vs redpoint chart when data available', () => {
    const flashRedpointBars: GroupedBar[] = [
      {
        key: 'V3',
        label: 'V3',
        values: [
          { value: 3, color: '#00ff00', label: 'Flash' },
          { value: 2, color: '#ff0000', label: 'Redpoint' },
        ],
      },
    ];
    render(<StatsSummary {...createDefaultProps({ aggregatedFlashRedpointBars: flashRedpointBars })} />);
    expect(screen.getByTestId('grouped-bar-chart')).toBeTruthy();
    expect(screen.getByText('Flash vs Redpoint')).toBeTruthy();
  });

  it('renders v-points chart when data available', () => {
    const vPointsTimeline: VPointsTimelineData = {
      weekLabels: ['Jan', 'Feb'],
      series: [{ layoutKey: 'kilter-1', displayName: 'Kilter', color: '#ff0000', data: [10, 20] }],
      totalPoints: 30,
    };
    render(<StatsSummary {...createDefaultProps({ vPointsTimeline })} />);
    expect(screen.getByTestId('v-points-chart')).toBeTruthy();
  });
});

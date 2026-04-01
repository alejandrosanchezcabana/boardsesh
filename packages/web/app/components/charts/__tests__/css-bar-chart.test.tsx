import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children, title }: { children: React.ReactElement; title: string }) => (
    <div data-tooltip={title}>{children}</div>
  ),
}));

vi.mock('../css-bar-chart.module.css', () => ({
  default: new Proxy({}, { get: (_, prop) => prop as string }),
}));

import { CssBarChart, GroupedBarChart } from '../css-bar-chart';
import type { CssBarChartBar, GroupedBar } from '../css-bar-chart';

describe('CssBarChart', () => {
  it('renders bars with correct aria-labels', () => {
    const bars: CssBarChartBar[] = [
      { key: 'a', label: 'A', segments: [{ value: 5, color: 'red' }] },
      { key: 'b', label: 'B', segments: [{ value: 3, color: 'blue' }] },
    ];
    render(<CssBarChart bars={bars} />);
    expect(screen.getByRole('img', { name: 'Bar chart' })).toBeTruthy();
    expect(screen.getByLabelText('A: 5')).toBeTruthy();
    expect(screen.getByLabelText('B: 3')).toBeTruthy();
  });

  it('renders empty container with no bar columns for empty bars', () => {
    const { container } = render(<CssBarChart bars={[]} />);
    expect(container.querySelector('[role="img"]')).toBeTruthy();
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(0);
  });

  it('single segment shows "label: total" tooltip format', () => {
    const bars: CssBarChartBar[] = [
      { key: 'x', label: 'Grade', segments: [{ value: 7, color: '#000' }] },
    ];
    render(<CssBarChart bars={bars} />);
    expect(screen.getByLabelText('Grade: 7')).toBeTruthy();
  });

  it('multi-segment shows "segLabel: value" tooltip, filtering zero segments', () => {
    const bars: CssBarChartBar[] = [
      {
        key: 'x',
        label: 'Grade',
        segments: [
          { value: 3, color: 'red', label: 'Kilter' },
          { value: 0, color: 'blue', label: 'Tension' },
          { value: 2, color: 'green', label: 'Moon' },
        ],
      },
    ];
    render(<CssBarChart bars={bars} />);
    expect(screen.getByLabelText('Kilter: 3, Moon: 2')).toBeTruthy();
  });

  it('all-zero segments still render bar at minimum 8% height', () => {
    const bars: CssBarChartBar[] = [
      { key: 'z', label: 'Zero', segments: [{ value: 0, color: 'grey' }] },
      { key: 'a', label: 'Some', segments: [{ value: 10, color: 'red' }] },
    ];
    const { container } = render(<CssBarChart bars={bars} />);
    const columns = container.querySelectorAll('[tabindex="0"]');
    expect(columns).toHaveLength(2);
    // Zero bar gets 8% minimum height
    expect(columns[0].getAttribute('style')).toContain('8%');
  });

  it('renders legend labels when showLegend is true', () => {
    const bars: CssBarChartBar[] = [
      { key: 'a', label: 'Alpha', segments: [{ value: 1, color: '#000' }] },
      { key: 'b', label: 'Beta', segments: [{ value: 2, color: '#111' }] },
    ];
    render(<CssBarChart bars={bars} showLegend />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('hides legend when showLegend is false', () => {
    const bars: CssBarChartBar[] = [
      { key: 'a', label: 'Alpha', segments: [{ value: 1, color: '#000' }] },
    ];
    render(<CssBarChart bars={bars} showLegend={false} />);
    // Alpha still appears in the bar tooltip, but not in a legend span
    const alphaElements = screen.queryAllByText('Alpha');
    // No legend text should be visible (only tooltip-related text)
    const legendContainer = document.querySelector('[aria-hidden="true"]');
    expect(legendContainer).toBeNull();
  });

  it('applies custom height and gap via CSS variables', () => {
    const bars: CssBarChartBar[] = [
      { key: 'a', label: 'A', segments: [{ value: 1, color: '#000' }] },
    ];
    const { container } = render(<CssBarChart bars={bars} height={200} mobileHeight={150} gap={5} />);
    const barContainer = container.querySelector('[role="img"]') as HTMLElement;
    expect(barContainer.style.getPropertyValue('--chart-height')).toBe('200px');
    expect(barContainer.style.getPropertyValue('--chart-mobile-height')).toBe('150px');
    expect(barContainer.style.gap).toBe('5px');
  });

  it('applies custom aria-label', () => {
    render(<CssBarChart bars={[]} ariaLabel="My custom chart" />);
    expect(screen.getByRole('img', { name: 'My custom chart' })).toBeTruthy();
  });

  describe('maxLabels', () => {
    const makeBars = (count: number): CssBarChartBar[] =>
      Array.from({ length: count }, (_, i) => ({
        key: `k${i}`,
        label: `L${i}`,
        segments: [{ value: i + 1, color: '#000' }],
      }));

    it('shows all labels when bars.length <= maxLabels', () => {
      const { container } = render(<CssBarChart bars={makeBars(5)} maxLabels={10} />);
      const labels = container.querySelectorAll('[aria-hidden="true"] span');
      const hidden = Array.from(labels).filter(
        (el) => (el as HTMLElement).style.visibility === 'hidden',
      );
      expect(hidden).toHaveLength(0);
    });

    it('hides some labels when bars.length > maxLabels', () => {
      const bars = makeBars(20);
      const { container } = render(<CssBarChart bars={bars} maxLabels={5} />);
      const labels = container.querySelectorAll('[aria-hidden="true"] span');
      const visible = Array.from(labels).filter(
        (el) => (el as HTMLElement).style.visibility !== 'hidden',
      );
      expect(visible.length).toBe(5);
    });

    it('always shows first and last labels', () => {
      const bars = makeBars(20);
      const { container } = render(<CssBarChart bars={bars} maxLabels={3} />);
      const labels = container.querySelectorAll('[aria-hidden="true"] span');
      const labelArr = Array.from(labels) as HTMLElement[];
      // First and last should be visible
      expect(labelArr[0].style.visibility).not.toBe('hidden');
      expect(labelArr[labelArr.length - 1].style.visibility).not.toBe('hidden');
    });

    it('shows close to maxLabels even when bars.length is slightly above', () => {
      // 13 bars, maxLabels=12 — old algorithm showed only 7
      const bars = makeBars(13);
      const { container } = render(<CssBarChart bars={bars} maxLabels={12} />);
      const labels = container.querySelectorAll('[aria-hidden="true"] span');
      const visible = Array.from(labels).filter(
        (el) => (el as HTMLElement).style.visibility !== 'hidden',
      );
      expect(visible.length).toBe(12);
    });
  });

  describe('angledLabels', () => {
    it('applies angled CSS class to legend when angledLabels is true', () => {
      const bars: CssBarChartBar[] = [
        { key: 'a', label: 'A', segments: [{ value: 1, color: '#000' }] },
      ];
      const { container } = render(<CssBarChart bars={bars} angledLabels />);
      const legend = container.querySelector('[aria-hidden="true"]');
      expect(legend?.className).toContain('legendAngled');
    });

    it('does not apply angled CSS class when angledLabels is false', () => {
      const bars: CssBarChartBar[] = [
        { key: 'a', label: 'A', segments: [{ value: 1, color: '#000' }] },
      ];
      const { container } = render(<CssBarChart bars={bars} />);
      const legend = container.querySelector('[aria-hidden="true"]');
      expect(legend?.className).not.toContain('legendAngled');
    });
  });
});

describe('GroupedBarChart', () => {
  it('renders bars with correct aria-labels', () => {
    const bars: GroupedBar[] = [
      { key: 'v3', label: 'V3', values: [{ value: 2, color: 'green', label: 'Flash' }] },
    ];
    render(<GroupedBarChart bars={bars} />);
    expect(screen.getByRole('img', { name: 'Grouped bar chart' })).toBeTruthy();
    expect(screen.getByLabelText('V3 — Flash: 2')).toBeTruthy();
  });

  it('renders no bar columns for empty bars', () => {
    const { container } = render(<GroupedBarChart bars={[]} />);
    expect(container.querySelector('[role="img"]')).toBeTruthy();
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(0);
  });

  it('each value gets its own tooltip', () => {
    const bars: GroupedBar[] = [
      {
        key: 'v5',
        label: 'V5',
        values: [
          { value: 3, color: 'green', label: 'Flash' },
          { value: 5, color: 'red', label: 'Redpoint' },
        ],
      },
    ];
    render(<GroupedBarChart bars={bars} />);
    expect(screen.getByLabelText('V5 — Flash: 3')).toBeTruthy();
    expect(screen.getByLabelText('V5 — Redpoint: 5')).toBeTruthy();
  });

  it('zero-value bars get 0% height, non-zero get at least 8%', () => {
    const bars: GroupedBar[] = [
      {
        key: 'v3',
        label: 'V3',
        values: [
          { value: 0, color: 'green', label: 'Flash' },
          { value: 1, color: 'red', label: 'Redpoint' },
        ],
      },
    ];
    const { container } = render(<GroupedBarChart bars={bars} />);
    const singles = container.querySelectorAll('[tabindex="0"]');
    expect(singles).toHaveLength(2);
    // Zero → 0% height
    expect(singles[0].getAttribute('style')).toContain('height: 0%');
    // Non-zero → at least 8%
    const heightMatch = singles[1].getAttribute('style')?.match(/height:\s*(\d+)%/);
    expect(Number(heightMatch?.[1])).toBeGreaterThanOrEqual(8);
  });

  it('shows stacked legend with multiple unique labels', () => {
    const bars: GroupedBar[] = [
      {
        key: 'v3',
        label: 'V3',
        values: [
          { value: 1, color: 'green', label: 'Flash' },
          { value: 2, color: 'red', label: 'Redpoint' },
        ],
      },
    ];
    render(<GroupedBarChart bars={bars} />);
    // Stacked legend should be present with both labels
    const flashElements = screen.getAllByText('Flash');
    const redpointElements = screen.getAllByText('Redpoint');
    expect(flashElements.length).toBeGreaterThanOrEqual(1);
    expect(redpointElements.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show stacked legend with only one unique label', () => {
    const bars: GroupedBar[] = [
      { key: 'v3', label: 'V3', values: [{ value: 5, color: 'green', label: 'Flash' }] },
      { key: 'v4', label: 'V4', values: [{ value: 3, color: 'green', label: 'Flash' }] },
    ];
    const { container } = render(<GroupedBarChart bars={bars} />);
    // stackedLegend should not render when only one unique label
    expect(container.querySelector('.stackedLegend')).toBeNull();
  });

  it('renders grade legend labels', () => {
    const bars: GroupedBar[] = [
      { key: 'v3', label: 'V3', values: [{ value: 1, color: '#000', label: 'Flash' }] },
      { key: 'v4', label: 'V4', values: [{ value: 2, color: '#000', label: 'Flash' }] },
    ];
    render(<GroupedBarChart bars={bars} />);
    expect(screen.getByText('V3')).toBeTruthy();
    expect(screen.getByText('V4')).toBeTruthy();
  });
});

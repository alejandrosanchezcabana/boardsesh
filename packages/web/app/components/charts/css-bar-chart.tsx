'use client';

import React, { useMemo } from 'react';
import MuiTooltip from '@mui/material/Tooltip';
import styles from './css-bar-chart.module.css';

export interface BarSegment {
  value: number;
  color: string;
  label?: string;
}

export interface CssBarChartBar {
  key: string;
  label: string;
  segments: BarSegment[];
}

interface CssBarChartProps {
  bars: CssBarChartBar[];
  height?: number;
  mobileHeight?: number;
  showLegend?: boolean;
  gap?: number;
  ariaLabel?: string;
  /** Max number of x-axis labels to display; surplus labels are hidden. */
  maxLabels?: number;
  /** Render x-axis labels at a -45° angle (useful for dense charts). */
  angledLabels?: boolean;
}

export const CssBarChart = React.memo(function CssBarChart({
  bars,
  height = 48,
  mobileHeight = 36,
  showLegend = true,
  gap = 2,
  ariaLabel = 'Bar chart',
  maxLabels,
  angledLabels = false,
}: CssBarChartProps) {
  const maxTotal = useMemo(
    () => Math.max(...bars.map((b) => b.segments.reduce((sum, s) => sum + s.value, 0)), 1),
    [bars],
  );

  const cssVars = {
    '--chart-height': `${height}px`,
    '--chart-mobile-height': `${mobileHeight}px`,
  } as React.CSSProperties;

  // Pre-compute which label indices are visible when maxLabels is set.
  // Distributes exactly maxLabels labels evenly across the range.
  const visibleLabelIndices = useMemo(() => {
    if (!maxLabels || bars.length <= maxLabels) return null;
    const count = Math.min(maxLabels, bars.length);
    const step = (bars.length - 1) / (count - 1);
    const indices = new Set<number>();
    for (let k = 0; k < count; k++) {
      indices.add(Math.round(k * step));
    }
    return indices;
  }, [bars.length, maxLabels]);

  return (
    <div className={styles.container}>
      <div
        className={styles.barContainer}
        style={{ ...cssVars, gap: `${gap}px` }}
        role="img"
        aria-label={ariaLabel}
      >
        {bars.map((bar) => {
          const total = bar.segments.reduce((sum, s) => sum + s.value, 0);
          const barHeightPct = Math.max((total / maxTotal) * 100, 8);
          const tooltipText = bar.segments.length === 1
            ? `${bar.label}: ${total}`
            : bar.segments
                .filter((s) => s.value > 0)
                .map((s) => `${s.label || bar.label}: ${s.value}`)
                .join(', ');

          return (
            <MuiTooltip key={bar.key} title={tooltipText} placement="top" arrow>
              <div
                className={styles.barColumn}
                style={{ height: `${barHeightPct}%` }}
                tabIndex={0}
                aria-label={tooltipText}
              >
                {bar.segments.map((seg, i) => {
                  const segPct = total > 0 ? (seg.value / total) * 100 : 0;
                  return (
                    <div
                      key={`${i}-${seg.label ?? ''}`}
                      className={styles.barSegment}
                      style={{
                        height: `${segPct}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  );
                })}
              </div>
            </MuiTooltip>
          );
        })}
      </div>
      {showLegend && (
        <div
          className={`${styles.legend} ${angledLabels ? styles.legendAngled : ''}`}
          style={{ gap: `${gap}px` }}
          aria-hidden="true"
        >
          {bars.map((bar, i) => {
            const visible = !visibleLabelIndices || visibleLabelIndices.has(i);
            return (
              <span
                key={bar.key}
                className={styles.legendLabel}
                style={visible ? undefined : { visibility: 'hidden' }}
              >
                {bar.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* Grouped (side-by-side) bar chart for flash vs redpoint */
export interface GroupedBar {
  key: string;
  label: string;
  values: Array<{ value: number; color: string; label: string }>;
}

interface GroupedBarChartProps {
  bars: GroupedBar[];
  height?: number;
  mobileHeight?: number;
  showLegend?: boolean;
  gap?: number;
  ariaLabel?: string;
}

export const GroupedBarChart = React.memo(function GroupedBarChart({
  bars,
  height = 48,
  mobileHeight = 36,
  showLegend = true,
  gap = 2,
  ariaLabel = 'Grouped bar chart',
}: GroupedBarChartProps) {
  const maxValue = useMemo(
    () => Math.max(...bars.flatMap((b) => b.values.map((v) => v.value)), 1),
    [bars],
  );

  const cssVars = {
    '--chart-height': `${height}px`,
    '--chart-mobile-height': `${mobileHeight}px`,
  } as React.CSSProperties;

  // Collect unique legend entries
  const legendEntries = useMemo(() => {
    const seen = new Map<string, string>();
    for (const bar of bars) {
      for (const v of bar.values) {
        if (!seen.has(v.label)) seen.set(v.label, v.color);
      }
    }
    return Array.from(seen.entries()).map(([label, color]) => ({ label, color }));
  }, [bars]);

  return (
    <div className={styles.container}>
      <div
        className={styles.groupedBarContainer}
        style={{ ...cssVars, gap: `${gap}px` }}
        role="img"
        aria-label={ariaLabel}
      >
        {bars.map((bar) => (
          <div key={bar.key} className={styles.groupedBarColumn} aria-label={bar.label}>
            {bar.values.map((v) => {
              const heightPct = Math.max((v.value / maxValue) * 100, v.value > 0 ? 8 : 0);
              const tooltipText = `${bar.label} — ${v.label}: ${v.value}`;
              return (
                <MuiTooltip key={v.label} title={tooltipText} placement="top" arrow>
                  <div
                    className={styles.groupedBarSingle}
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: v.color,
                    }}
                    tabIndex={0}
                    aria-label={tooltipText}
                  />
                </MuiTooltip>
              );
            })}
          </div>
        ))}
      </div>
      {showLegend && (
        <>
          <div className={styles.legend} style={{ gap: `${gap}px` }} aria-hidden="true">
            {bars.map((bar) => (
              <span key={bar.key} className={styles.legendLabel}>
                {bar.label}
              </span>
            ))}
          </div>
          {legendEntries.length > 1 && (
            <div className={styles.stackedLegend}>
              {legendEntries.map((entry) => (
                <div key={entry.label} className={styles.stackedLegendItem}>
                  <div className={styles.stackedLegendColor} style={{ backgroundColor: entry.color }} />
                  <span className={styles.stackedLegendLabel}>{entry.label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

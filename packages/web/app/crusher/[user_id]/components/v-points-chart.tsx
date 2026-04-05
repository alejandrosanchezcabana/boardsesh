'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import type { VPointsTimelineData } from '../utils/chart-data-builders';

interface VPointsChartProps {
  data: VPointsTimelineData;
}

export default function VPointsChart({ data }: VPointsChartProps) {
  const { weekLabels, series, totalPoints } = data;

  // Downsample labels for readability — show at most ~12 labels
  const labelInterval = Math.max(1, Math.floor(weekLabels.length / 12));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" component="span" fontWeight={600} sx={{ fontSize: 13, color: 'var(--neutral-600)' }}>
          V-Points
        </Typography>
        <Typography variant="body2" component="span" color="text.secondary" sx={{ fontSize: 12 }}>
          {totalPoints.toLocaleString()} total
        </Typography>
      </Box>
      <LineChart
        series={series.map((s) => ({
          data: s.data,
          label: s.displayName,
          color: s.color,
          area: true,
          stack: 'vpoints',
          curve: 'linear' as const,
          showMark: false,
        }))}
        xAxis={[{
          data: weekLabels,
          scaleType: 'band' as const,
          tickLabelStyle: { fontSize: 10 },
          tickInterval: (_value: string, index: number) => index % labelInterval === 0,
        }]}
        yAxis={[{
          tickLabelStyle: { fontSize: 10 },
        }]}
        height={200}
        margin={{ top: 10, bottom: 30, left: 35, right: 10 }}
        hideLegend={series.length <= 1}
        slotProps={{
          legend: {
            sx: { fontSize: 11 },
          },
        }}
      />
    </Box>
  );
}

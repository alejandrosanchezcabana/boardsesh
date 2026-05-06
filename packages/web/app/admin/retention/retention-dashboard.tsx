'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import MuiLink from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTranslation } from 'react-i18next';
import LocaleLink from '@/app/components/i18n/locale-link';
import { themeTokens } from '@/app/theme/theme-config';

export type RetentionRow = {
  cohortWeek: string;
  signups: number;
  d1Count: number;
  d3Count: number;
  d7Count: number;
  d30Count: number;
  activatedCount: number;
  d1Pct: number | null;
  d3Pct: number | null;
  d7Pct: number | null;
  d30Pct: number | null;
  activationPct: number | null;
};

type RetentionDashboardProps = {
  rows: RetentionRow[];
};

function formatPct(value: number | null, placeholder: string): string {
  if (value === null) return placeholder;
  return `${value.toFixed(1)}%`;
}

export default function RetentionDashboard({ rows }: RetentionDashboardProps) {
  const { t } = useTranslation('admin');
  const placeholder = t('retention.table.notReady');

  const chartRows = [...rows].reverse().filter((row) => row.d7Pct !== null);
  const chartCategories = chartRows.map((row) => row.cohortWeek);
  const chartValues = chartRows.map((row) => row.d7Pct ?? 0);

  return (
    <Container maxWidth="lg" sx={{ py: 4, pt: 'calc(var(--global-header-height) + 32px)' }}>
      <Box sx={{ mb: 3 }}>
        <MuiLink component={LocaleLink} href="/admin" underline="hover" sx={{ color: themeTokens.colors.primary }}>
          {t('retention.back')}
        </MuiLink>
      </Box>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: themeTokens.neutral[800] }}>
        {t('retention.heading')}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, color: themeTokens.neutral[700] }}>
        {t('retention.subheading')}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 3, color: themeTokens.neutral[600] }}>
        {t('retention.definitions')}
      </Typography>

      {chartRows.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: themeTokens.neutral[800] }}>
            {t('retention.chart.title')}
          </Typography>
          <Box sx={{ height: 240 }}>
            <BarChart
              series={[
                {
                  data: chartValues,
                  label: t('retention.chart.label'),
                  color: themeTokens.colors.primary,
                },
              ]}
              xAxis={[
                {
                  data: chartCategories,
                  scaleType: 'band' as const,
                  tickLabelStyle: { fontSize: 10, angle: -45, textAnchor: 'end' },
                },
              ]}
              yAxis={[{ min: 0, max: 100 }]}
              height={240}
              margin={{ top: 8, bottom: 56, left: 32, right: 8 }}
              hideLegend
              borderRadius={4}
            />
          </Box>
        </Paper>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('retention.table.cohortWeek')}</TableCell>
              <TableCell align="right">{t('retention.table.signups')}</TableCell>
              <TableCell align="right">{t('retention.table.activated')}</TableCell>
              <TableCell align="right">{t('retention.table.d1')}</TableCell>
              <TableCell align="right">{t('retention.table.d3')}</TableCell>
              <TableCell align="right">{t('retention.table.d7')}</TableCell>
              <TableCell align="right">{t('retention.table.d30')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: themeTokens.neutral[600] }}>
                  {t('retention.table.empty')}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.cohortWeek}>
                <TableCell>{row.cohortWeek}</TableCell>
                <TableCell align="right">{row.signups}</TableCell>
                <TableCell align="right">{formatPct(row.activationPct, placeholder)}</TableCell>
                <TableCell align="right">{formatPct(row.d1Pct, placeholder)}</TableCell>
                <TableCell align="right">{formatPct(row.d3Pct, placeholder)}</TableCell>
                <TableCell align="right">{formatPct(row.d7Pct, placeholder)}</TableCell>
                <TableCell align="right">{formatPct(row.d30Pct, placeholder)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

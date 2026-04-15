'use client';

import React from 'react';
import MuiTooltip from '@mui/material/Tooltip';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { CssBarChart, GroupedBarChart } from '@/app/components/charts/css-bar-chart';
import type { CssBarChartBar, GroupedBar } from '@/app/components/charts/css-bar-chart';
import { EmptyState } from '@/app/components/ui/empty-state';
import { themeTokens } from '@/app/theme/theme-config';
import { AscentStatusIcon } from '@/app/components/ascent-status/ascent-status-icon';
import type { LayoutPercentage, LayoutLegendEntry, VPointsTimelineData } from '../utils/chart-data-builders';
import VPointsChart from './v-points-chart';
import styles from '../profile-page.module.css';

interface GradeHighlight {
  label: string;
  color: string;
  textColor: string;
  status: 'send' | 'flash';
}

export interface StatsSummaryProps {
  statisticsSummary: {
    totalAscents: number;
    layoutPercentages: LayoutPercentage[];
  };
  hardestSend?: GradeHighlight | null;
  hardestFlash?: GradeHighlight | null;
  loadingProfileStats: boolean;
  loadingAggregated: boolean;
  weeklyBars: CssBarChartBar[] | null;
  aggregatedStackedBars: { bars: CssBarChartBar[]; legendEntries: LayoutLegendEntry[] } | null;
  aggregatedFlashRedpointBars: GroupedBar[] | null;
  vPointsTimeline: VPointsTimelineData | null;
  percentile?: { totalDistinctClimbs: number; percentile: number; totalActiveUsers: number } | null;
}

export default function StatsSummary({
  statisticsSummary,
  hardestSend,
  hardestFlash,
  loadingProfileStats,
  loadingAggregated,
  weeklyBars,
  aggregatedStackedBars,
  aggregatedFlashRedpointBars,
  vPointsTimeline,
  percentile,
}: StatsSummaryProps) {
  if (loadingProfileStats || statisticsSummary.totalAscents === 0) {
    return null;
  }

  const renderHighlightCard = (statusTestId: string, highlight: GradeHighlight) => (
    <Box sx={{
      flex: 1,
      position: 'relative',
      borderRadius: `${themeTokens.borderRadius.md}px`,
      bgcolor: highlight.color,
      color: highlight.textColor,
      p: 1.5,
      textAlign: 'center',
      overflow: 'hidden',
    }}>
      <Typography variant="h5" component="span" fontWeight={700}>
        {highlight.label}
      </Typography>
      <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', lineHeight: 0 }}>
        <AscentStatusIcon
          status={highlight.status}
          variant="badge"
          fontSize={12}
          badgeSize={20}
          testId={statusTestId}
        />
      </Box>
    </Box>
  );

  return (
    <MuiCard className={styles.statsCard}><CardContent>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Box sx={{
          flex: 1,
          borderRadius: `${themeTokens.borderRadius.md}px`,
          bgcolor: 'var(--neutral-100)',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.125,
          textAlign: 'center',
        }}>
          <Typography variant="h5" component="span" fontWeight={700} sx={{ display: 'block', lineHeight: 1 }}>
            {statisticsSummary.totalAscents}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1, opacity: 0.8 }}>
            problems
          </Typography>
        </Box>
        {hardestSend && renderHighlightCard('hardest-send-status', hardestSend)}
        {hardestFlash && renderHighlightCard('hardest-flash-status', hardestFlash)}
      </Box>

      {percentile && percentile.percentile > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Percentile
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              Top {Math.max(0.1, 100 - percentile.percentile).toFixed(percentile.percentile >= 99 ? 1 : 0)}%
            </Typography>
          </Box>
          <Box sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'var(--neutral-100)',
            overflow: 'hidden',
          }}>
            <Box sx={{
              height: '100%',
              width: `${percentile.percentile}%`,
              borderRadius: 4,
              bgcolor: themeTokens.colors.primary,
              transition: 'width 0.5s ease',
            }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            More problems sent than {percentile.percentile.toFixed(0)}% of climbers
          </Typography>
        </Box>
      )}

      {statisticsSummary.layoutPercentages.length > 1 && (
        <div className={styles.percentageBarContainer}>
          <div className={styles.percentageBar}>
            {statisticsSummary.layoutPercentages.map((layout) => (
              <MuiTooltip
                key={layout.layoutKey}
                title={`${layout.displayName}: ${layout.count} problems (${layout.percentage}%)`}
              >
                <div
                  className={styles.percentageSegment}
                  style={{ width: `${layout.percentage}%`, backgroundColor: layout.color }}
                >
                  {layout.percentage >= 15 && (
                    <span className={styles.percentageLabel}>
                      {layout.displayName.split(' ').slice(-1)[0]} {layout.percentage}%
                    </span>
                  )}
                </div>
              </MuiTooltip>
            ))}
          </div>
        </div>
      )}

      {weeklyBars && (
        <div className={styles.gradeDistributionSection}>
          <Typography variant="body2" component="span" fontWeight={600} className={styles.gradeDistributionTitle}>
            Weekly Attempts
          </Typography>
          <CssBarChart
            bars={weeklyBars}
            height={180}
            mobileHeight={120}
            gap={3}
            ariaLabel="Weekly attempts by difficulty"
            angledLabels
            maxLabels={12}
          />
        </div>
      )}

      <div className={weeklyBars ? styles.flashRedpointSection : styles.gradeDistributionSection}>
        <Typography variant="body2" component="span" fontWeight={600} className={styles.gradeDistributionTitle}>
          Grade Distribution
        </Typography>

        {loadingAggregated ? (
          <div className={styles.loadingStats}>
            <CircularProgress size={24} />
          </div>
        ) : aggregatedStackedBars?.bars ? (
            <CssBarChart
              bars={aggregatedStackedBars.bars}
              height={160}
              mobileHeight={120}
              showLegend={false}
              ariaLabel="Grade distribution across boards"
            />
        ) : (
          <EmptyState description="No ascent data for this period" />
        )}
      </div>

      {aggregatedFlashRedpointBars && !loadingAggregated && (
        <div className={styles.flashRedpointSection}>
          <Typography variant="body2" component="span" fontWeight={600} className={styles.gradeDistributionTitle}>
            Flash vs Redpoint
          </Typography>
          <GroupedBarChart
            bars={aggregatedFlashRedpointBars}
            height={140}
            mobileHeight={100}
            gap={2}
            showLegend={false}
            ariaLabel="Flash vs redpoint by grade"
          />
        </div>
      )}

      {vPointsTimeline && !loadingAggregated && (
        <div className={styles.flashRedpointSection}>
          <VPointsChart data={vPointsTimeline} />
        </div>
      )}
    </CardContent></MuiCard>
  );
}

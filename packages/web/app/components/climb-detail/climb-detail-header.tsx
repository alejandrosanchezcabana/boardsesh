'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CopyrightOutlined from '@mui/icons-material/CopyrightOutlined';
import { themeTokens } from '@/app/theme/theme-config';
import { getSoftVGradeColor, formatVGrade } from '@/app/lib/grade-colors';
import { formatAscents } from '@/app/lib/format-climb-stats';
import { useIsDarkMode } from '@/app/hooks/use-is-dark-mode';
import AngleSelector from '../board-page/angle-selector';
import type { Climb, BoardDetails } from '@/app/lib/types';

interface ClimbDetailHeaderProps {
  climb: Climb;
  boardDetails: BoardDetails;
  angle: number;
  isAngleAdjustable?: boolean;
  /** Community-voted grade override, fetched separately from climb_community_status table */
  communityGrade?: string | null;
}

/**
 * Header component for climb detail view.
 * Layout: Grade (left) | Name + details (center) | Angle Selector (right)
 */
export default function ClimbDetailHeader({
  climb,
  boardDetails,
  angle,
  isAngleAdjustable = true,
  communityGrade,
}: ClimbDetailHeaderProps) {
  const isDark = useIsDarkMode();

  // Use community grade when available, otherwise fall back to original difficulty
  const displayDifficulty = communityGrade || climb.difficulty;
  const vGrade = formatVGrade(displayDifficulty);
  const gradeColor = vGrade ? getSoftVGradeColor(vGrade, isDark) : undefined;

  // Check if climb is a benchmark/classic
  const benchmarkValue = climb.benchmark_difficulty != null ? Number(climb.benchmark_difficulty) : null;
  const isBenchmark = benchmarkValue !== null && benchmarkValue > 0 && !Number.isNaN(benchmarkValue);

  const hasQuality = climb.quality_average && climb.quality_average !== '0';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: `${themeTokens.spacing[3]}px ${themeTokens.spacing[4]}px`,
        gap: `${themeTokens.spacing[3]}px`,
        minHeight: 56,
      }}
    >
      {/* Left: Grade */}
      <Box sx={{ flexShrink: 0, minWidth: 48 }}>
        {vGrade ? (
          <Typography
            variant="h5"
            component="span"
            sx={{
              fontSize: themeTokens.typography.fontSize['2xl'],
              fontWeight: themeTokens.typography.fontWeight.bold,
              lineHeight: 1,
              color: gradeColor ?? 'text.primary',
            }}
          >
            {vGrade}
          </Typography>
        ) : displayDifficulty ? (
          <Typography
            variant="h5"
            component="span"
            sx={{
              fontSize: themeTokens.typography.fontSize.xl,
              fontWeight: themeTokens.typography.fontWeight.semibold,
              lineHeight: 1,
              color: 'text.secondary',
            }}
          >
            {displayDifficulty}
          </Typography>
        ) : (
          <Typography
            variant="body2"
            component="span"
            sx={{ fontStyle: 'italic', color: 'text.secondary' }}
          >
            project
          </Typography>
        )}
      </Box>

      {/* Center: Name + details */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        {/* Name row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '100%' }}>
          <Typography
            variant="body1"
            component="span"
            sx={{
              fontSize: themeTokens.typography.fontSize.lg,
              fontWeight: themeTokens.typography.fontWeight.bold,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {climb.name}
          </Typography>
          {isBenchmark && (
            <CopyrightOutlined
              sx={{
                fontSize: themeTokens.typography.fontSize.xs,
                color: themeTokens.colors.primary,
                flexShrink: 0,
              }}
            />
          )}
        </Box>

        {/* Details row: quality + setter */}
        <Typography
          variant="body2"
          component="span"
          color="text.secondary"
          sx={{
            fontSize: themeTokens.typography.fontSize.xs,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {[
            hasQuality ? `${climb.quality_average}★` : null,
            climb.ascensionist_count ? formatAscents(climb.ascensionist_count) : null,
            climb.setter_username,
          ]
            .filter(Boolean)
            .join(' · ') || 'Unknown setter'}
        </Typography>
      </Box>

      {/* Right: Angle Selector */}
      <Box sx={{ flexShrink: 0 }}>
        <AngleSelector
          boardName={boardDetails.board_name}
          boardDetails={boardDetails}
          currentAngle={angle}
          currentClimb={climb}
          isAngleAdjustable={isAngleAdjustable}
        />
      </Box>
    </Box>
  );
}

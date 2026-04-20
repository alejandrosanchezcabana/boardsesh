'use client';

import React from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import type { SessionSummary } from '@boardsesh/shared-schema';
import { useHealthKitSync } from '@/app/hooks/use-healthkit-sync';

interface SaveToHealthKitButtonProps {
  summary: SessionSummary | null;
  boardType?: string;
  existingWorkoutId?: string | null;
  size?: 'small' | 'medium' | 'large';
}

/**
 * iOS-only button that saves a climbing session to Apple Health.
 * Renders nothing on non-iOS platforms or when HealthKit is unavailable.
 */
export default function SaveToHealthKitButton({
  summary,
  boardType = '',
  existingWorkoutId,
  size = 'small',
}: SaveToHealthKitButtonProps) {
  const { available, state, save } = useHealthKitSync({ summary, boardType, existingWorkoutId });

  if (!available || !summary) return null;

  const label = state === 'saving'
    ? 'Saving to Apple Health…'
    : state === 'saved'
      ? 'Saved to Apple Health'
      : state === 'error'
        ? 'Save to Apple Health (retry)'
        : state === 'auth_denied'
          ? 'Apple Health access denied'
          : 'Save to Apple Health';

  return (
    <Box>
      <Button
        onClick={() => void save()}
        variant="outlined"
        size={size}
        startIcon={<FavoriteOutlined />}
        disabled={state === 'saving' || state === 'saved' || state === 'auth_denied'}
      >
        {label}
      </Button>
      {state === 'auth_denied' && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 12 }}>
          Allow Boardsesh in Settings &gt; Health &gt; Data Access &amp; Devices.
        </Typography>
      )}
    </Box>
  );
}

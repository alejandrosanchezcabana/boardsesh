'use client';

import React from 'react';
import Button from '@mui/material/Button';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import type { SessionSummary } from '@boardsesh/shared-schema';
import { useHealthKitSync } from '@/app/hooks/use-healthkit-sync';

type SaveToHealthKitButtonProps = {
  summary: SessionSummary | null;
  boardType?: string;
  existingWorkoutId?: string | null;
  size?: 'small' | 'medium' | 'large';
};

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

  let label = 'Save to Apple Health';
  if (state === 'saving') {
    label = 'Saving to Apple Health…';
  } else if (state === 'saved') {
    label = 'Saved to Apple Health';
  } else if (state === 'error') {
    label = 'Save to Apple Health (retry)';
  }

  return (
    <Button
      onClick={() => void save()}
      variant="outlined"
      size={size}
      startIcon={<FavoriteOutlined />}
      disabled={state === 'saving' || state === 'saved'}
    >
      {label}
    </Button>
  );
}

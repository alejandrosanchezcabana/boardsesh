'use client';

import React from 'react';
import Button from '@mui/material/Button';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('settings');
  const { available, state, save } = useHealthKitSync({ summary, boardType, existingWorkoutId });

  if (!available || !summary) return null;

  let label = t('healthkit.save');
  if (state === 'saving') {
    label = t('healthkit.saving');
  } else if (state === 'saved') {
    label = t('healthkit.saved');
  } else if (state === 'error') {
    label = t('healthkit.retry');
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

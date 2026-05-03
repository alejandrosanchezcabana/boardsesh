'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import LockIcon from '@mui/icons-material/Lock';

type FreezeIndicatorProps = {
  reason?: string | null;
};

export default function FreezeIndicator({ reason }: FreezeIndicatorProps) {
  const { t } = useTranslation('feed');
  return (
    <Alert severity="warning" icon={<LockIcon fontSize="small" />} sx={{ mb: 2, fontSize: 13 }}>
      {t('freezeIndicator.frozen')}
      {reason && ` ${t('freezeIndicator.reasonPrefix', { reason })}`}
    </Alert>
  );
}

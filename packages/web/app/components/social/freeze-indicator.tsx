'use client';

import React from 'react';
import Alert from '@mui/material/Alert';
import LockIcon from '@mui/icons-material/Lock';

type FreezeIndicatorProps = {
  reason?: string | null;
};

export default function FreezeIndicator({ reason }: FreezeIndicatorProps) {
  return (
    <Alert severity="warning" icon={<LockIcon fontSize="small" />} sx={{ mb: 2, fontSize: 13 }}>
      {/* i18n-ignore-next-line */}
      This climb is frozen from receiving new proposals.
      {reason && ` Reason: ${reason}`}
    </Alert>
  );
}

'use client';

import React from 'react';
import Button from '@mui/material/Button';
import ClearOutlined from '@mui/icons-material/ClearOutlined';
import { useTranslation } from 'react-i18next';
import { useUISearchParams } from '@/app/components/queue-control/ui-searchparams-provider';

const ClearButton = () => {
  const { t } = useTranslation('climbs');
  const { clearClimbSearchParams } = useUISearchParams();

  return (
    <Button variant="text" startIcon={<ClearOutlined />} onClick={clearClimbSearchParams}>
      {t('search.actions.clearAll')}
    </Button>
  );
};

export default ClearButton;

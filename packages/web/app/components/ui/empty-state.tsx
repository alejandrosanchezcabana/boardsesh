'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { toSxArray } from './sx-utils';

type EmptyStateProps = {
  icon?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  sx?: SxProps<Theme>;
};

export function EmptyState({ icon, description, children, sx }: EmptyStateProps) {
  const { t } = useTranslation('common');
  const resolvedDescription = description ?? t('emptyState.default');
  return (
    <Box
      sx={[
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          color: 'text.secondary',
        },
        ...toSxArray(sx),
      ]}
    >
      <Box sx={{ fontSize: 48, mb: 1, opacity: 0.4 }}>{icon || <InboxOutlined fontSize="inherit" />}</Box>
      {typeof resolvedDescription === 'string' ? (
        <Typography variant="body2" color="text.secondary">
          {resolvedDescription}
        </Typography>
      ) : (
        resolvedDescription
      )}
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}

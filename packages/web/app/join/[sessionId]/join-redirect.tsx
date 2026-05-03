'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export default function JoinRedirect({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation('session');

  useEffect(() => {
    window.location.href = `/api/internal/join/${encodeURIComponent(sessionId)}`;
  }, [sessionId]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary">
        {t('join.joining')}
      </Typography>
    </Box>
  );
}

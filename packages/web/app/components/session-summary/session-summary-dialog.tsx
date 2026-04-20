'use client';

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import type { SessionSummary } from '@boardsesh/shared-schema';
import SessionSummaryView from './session-summary-view';
import { useHealthKitSync } from '@/app/hooks/use-healthkit-sync';

interface SessionSummaryDialogProps {
  summary: SessionSummary | null;
  onDismiss: () => void;
  boardType?: string;
  existingWorkoutId?: string | null;
}

export default function SessionSummaryDialog({
  summary,
  onDismiss,
  boardType = '',
  existingWorkoutId,
}: SessionSummaryDialogProps) {
  const { available, state, save } = useHealthKitSync({
    summary,
    boardType,
    existingWorkoutId,
  });

  const buttonLabel = state === 'saving'
    ? 'Saving to Apple Health…'
    : state === 'saved'
      ? 'Saved to Apple Health'
      : state === 'error'
        ? 'Save to Apple Health (retry)'
        : state === 'auth_denied'
          ? 'Apple Health access denied'
          : 'Save to Apple Health';

  return (
    <Dialog open={summary !== null} onClose={onDismiss} maxWidth="sm" fullWidth>
      <DialogTitle>Session Summary</DialogTitle>
      <DialogContent>
        {summary && <SessionSummaryView summary={summary} />}
      </DialogContent>
      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 3, pb: 2 }}>
        {available && state === 'auth_denied' && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontSize: 12 }}>
            Allow Boardsesh to save workouts in Settings &gt; Health &gt; Data Access &amp; Devices.
          </Typography>
        )}
        {available && (
          <Button
            onClick={() => void save()}
            variant="outlined"
            startIcon={<FavoriteOutlined />}
            disabled={state === 'saving' || state === 'saved' || state === 'auth_denied'}
          >
            {buttonLabel}
          </Button>
        )}
        <Button onClick={onDismiss} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

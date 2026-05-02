'use client';

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { useTranslation } from 'react-i18next';
import SessionCreationForm, { type SessionCreationFormData } from './session-creation-form';

export type { SessionCreationFormData };

type SessionCreationDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SessionCreationFormData) => void;
  isGymAdmin?: boolean;
  isSubmitting?: boolean;
};

export default function SessionCreationDialog({
  open,
  onClose,
  onSubmit,
  isGymAdmin = false,
  isSubmitting = false,
}: SessionCreationDialogProps) {
  const { t } = useTranslation('session');
  const handleSubmit = (data: SessionCreationFormData) => {
    onSubmit(data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('creation.dialogTitle')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <SessionCreationForm
          onSubmit={handleSubmit}
          isGymAdmin={isGymAdmin}
          isSubmitting={isSubmitting}
          submitLabel={t('creation.dialogSubmit')}
        />
      </DialogContent>
    </Dialog>
  );
}

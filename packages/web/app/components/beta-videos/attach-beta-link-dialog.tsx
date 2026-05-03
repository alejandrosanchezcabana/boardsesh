'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import AttachBetaLinkForm from './attach-beta-link-form';

type AttachBetaLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  boardType: string;
  climbUuid: string;
  climbName?: string;
  angle?: number | null;
};

const AttachBetaLinkDialog: React.FC<AttachBetaLinkDialogProps> = ({
  open,
  onClose,
  boardType,
  climbUuid,
  climbName,
  angle,
}) => {
  const { t } = useTranslation('feed');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {climbName ? t('betaVideos.shareBetaFor', { name: climbName }) : t('betaVideos.shareBetaVideo')}
      </DialogTitle>
      <DialogContent>
        <AttachBetaLinkForm
          boardType={boardType}
          climbUuid={climbUuid}
          climbName={climbName}
          angle={angle}
          resetTrigger={open}
          submitLabel={t('betaVideos.shareBeta')}
          helperText={t('betaVideos.dialogHelper')}
          onSuccess={onClose}
          onCancel={onClose}
          showCancel
          autoFocus
          compact
        />
      </DialogContent>
    </Dialog>
  );
};

export default AttachBetaLinkDialog;

'use client';

import React from 'react';
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
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{climbName ? `Share beta for ${climbName}` : 'Share beta video'}</DialogTitle>
      <DialogContent>
        <AttachBetaLinkForm
          boardType={boardType}
          climbUuid={climbUuid}
          climbName={climbName}
          angle={angle}
          resetTrigger={open}
          submitLabel="Share beta"
          // i18n-ignore-next-line
          helperText="Paste a reel or post link so others can see your beta."
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

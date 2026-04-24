'use client';

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { FeedbackForm } from './feedback-form';
import { useSubmitAppFeedback } from '@/app/hooks/use-submit-app-feedback';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { setFeedbackStatus } from '@/app/lib/feedback-prompt-db';
import type { AppFeedbackSource } from '@boardsesh/shared-schema';
import styles from './feedback-dialog.module.css';

export type FeedbackDialogMode = 'rating' | 'bug';

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  source: AppFeedbackSource;
  title?: string;
  mode?: FeedbackDialogMode;
}

const FeedbackDialogBody: React.FC<Omit<FeedbackDialogProps, 'open'>> = ({
  onClose,
  source,
  title,
  mode = 'rating',
}) => {
  const { mutate } = useSubmitAppFeedback();
  const { showMessage } = useSnackbar();
  const isBug = mode === 'bug';
  const resolvedTitle = title ?? (isBug ? 'Report a bug' : 'Send feedback');

  const handleSubmit = (values: { rating: number | null; comment: string | null }) => {
    if (isBug) {
      // Bug-mode form guarantees comment length via canSubmit.
      if (!values.comment) {
        onClose();
        return;
      }
    } else {
      // Rating-mode form disables Send until a rating is picked.
      if (values.rating === null) {
        onClose();
        return;
      }
      // Suppress the automatic banner for users who manually engaged.
      void setFeedbackStatus('submitted');
    }

    mutate(
      {
        rating: isBug ? null : values.rating,
        comment: values.comment,
        source,
      },
      {
        onSuccess: () => showMessage(isBug ? 'Bug logged — thanks.' : 'Thanks — logged.', 'success'),
        onError: () => showMessage("Couldn't send — we'll keep your feedback.", 'warning'),
      },
    );
    onClose();
  };

  return (
    <div className={styles.dialogBody}>
      <IconButton aria-label="Close" onClick={onClose} className={styles.closeButton} size="small">
        <CloseOutlined fontSize="small" />
      </IconButton>
      <DialogContent>
        <FeedbackForm
          mode={isBug ? 'bug' : 'drawer-feedback'}
          title={resolvedTitle}
          submitLabel={isBug ? 'Send bug report' : 'Send'}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </div>
  );
};

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onClose, source, title, mode }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {open && <FeedbackDialogBody onClose={onClose} source={source} title={title} mode={mode} />}
    </Dialog>
  );
};

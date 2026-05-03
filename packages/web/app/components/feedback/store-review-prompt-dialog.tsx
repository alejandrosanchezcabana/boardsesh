'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { requestInAppReview } from '@/app/lib/in-app-review';

type StoreReviewPromptDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Chained follow-up after an in-app star rating. Asks the user if they'd also
 * leave a review on the App Store / Play Store (or open the web store listing
 * on browsers). Shown only for high ratings so we don't steer unhappy users
 * to publicly 1-star the app — gating lives in the caller.
 */
export const StoreReviewPromptDialog: React.FC<StoreReviewPromptDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const handleReview = () => {
    void requestInAppReview();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('storeReview.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('storeReview.body')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('storeReview.notNow')}</Button>
        <Button variant="contained" onClick={handleReview}>
          {t('storeReview.leaveReview')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

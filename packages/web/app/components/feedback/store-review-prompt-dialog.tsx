'use client';

import React from 'react';
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
  const handleReview = () => {
    void requestInAppReview();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {/* i18n-ignore-next-line */}
      <DialogTitle>Help others find Boardsesh</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {/* i18n-ignore-next-line */}
          Thanks for the rating. Would you also leave a quick review on your app store? It&apos;s the single best thing
          you can do to help other climbers find us.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {/* i18n-ignore-next-line */}
        <Button onClick={onClose}>Not now</Button>
        <Button variant="contained" onClick={handleReview}>
          {/* i18n-ignore-next-line */}
          Leave a review
        </Button>
      </DialogActions>
    </Dialog>
  );
};

'use client';

import React from 'react';
import type { AppFeedbackSource } from '@boardsesh/shared-schema';
import { FeedbackDialog } from './feedback-dialog';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 'shake-bug' for the motion trigger, 'drawer-bug' for the drawer button. */
  source: Extract<AppFeedbackSource, 'shake-bug' | 'drawer-bug'>;
}

export const BugReportDialog: React.FC<BugReportDialogProps> = ({ open, onClose, source }) => {
  return <FeedbackDialog open={open} onClose={onClose} source={source} mode="bug" />;
};

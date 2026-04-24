'use client';

import React, { useCallback, useState } from 'react';
import { useShakeDetector } from '@/app/hooks/use-shake-detector';
import { BugReportDialog } from './bug-report-dialog';

/**
 * Mounts an accelerometer listener at app root and opens the bug-report
 * dialog on a strong shake. Listener is paused while the dialog is open so
 * a continuous shake doesn't re-trigger.
 */
export const ShakeToReportProvider: React.FC = () => {
  const [open, setOpen] = useState(false);
  const handleShake = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useShakeDetector(handleShake, { enabled: !open });

  return <BugReportDialog open={open} onClose={handleClose} source="shake-bug" />;
};

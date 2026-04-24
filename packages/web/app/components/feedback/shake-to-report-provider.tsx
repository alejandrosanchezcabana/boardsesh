'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useShakeDetector } from '@/app/hooks/use-shake-detector';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { getShakeToReportDismissed, setShakeToReportDismissed } from '@/app/lib/user-preferences-db';
import { BugReportDialog } from './bug-report-dialog';

/**
 * Mounts an accelerometer listener at app root and opens the bug-report
 * dialog on a strong shake. Listener is paused while the dialog is open so
 * a continuous shake doesn't re-trigger.
 *
 * The dialog exposes a "Don't show this again" escape hatch — if the user
 * picks it we persist the choice to IndexedDB and detach the detector for
 * good. The manual drawer entry is unaffected.
 */
export const ShakeToReportProvider: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const { showMessage } = useSnackbar();

  useEffect(() => {
    let cancelled = false;
    void getShakeToReportDismissed().then((value) => {
      if (!cancelled) setDismissed(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleShake = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const handleDontShowAgain = useCallback(() => {
    setDismissed(true);
    setOpen(false);
    void setShakeToReportDismissed(true);
    showMessage('Shake to report off. Tap your avatar up top to send feedback.', 'info', undefined, 6000);
  }, [showMessage]);

  useShakeDetector(handleShake, { enabled: !open && !dismissed });

  return (
    <BugReportDialog
      open={open}
      onClose={handleClose}
      source="shake-bug"
      secondaryAction={{ label: "Don't show this again", onClick: handleDontShowAgain }}
    />
  );
};

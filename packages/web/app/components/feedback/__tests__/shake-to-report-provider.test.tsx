import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { openDB } from 'idb';

// Capture the most recent callback and options passed to useShakeDetector
// so tests can deterministically "simulate" a shake and read the enabled flag.
type ShakeHookArgs = { onShake: () => void; enabled: boolean };
const lastShakeHookCall: { current: ShakeHookArgs | null } = { current: null };

vi.mock('@/app/hooks/use-shake-detector', () => ({
  useShakeDetector: (onShake: () => void, options: { enabled: boolean }) => {
    lastShakeHookCall.current = { onShake, enabled: options.enabled };
  },
}));

const showMessage = vi.fn();
vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage }),
}));

// BugReportDialog pulls in React Query / form children we don't care about
// here — stub it down to its props so the test can drive the dismiss flow.
type CapturedDialogProps = {
  open: boolean;
  onClose: () => void;
  secondaryAction?: { label: string; onClick: () => void };
};
const lastDialogProps: { current: CapturedDialogProps | null } = { current: null };

vi.mock('../bug-report-dialog', () => ({
  BugReportDialog: (props: CapturedDialogProps) => {
    lastDialogProps.current = props;
    return props.open ? <div data-testid="bug-report-dialog">open</div> : null;
  },
}));

import { ShakeToReportProvider } from '../shake-to-report-provider';
import { setPreference } from '@/app/lib/user-preferences-db';

const DB_NAME = 'boardsesh-user-preferences';
const STORE_NAME = 'preferences';

beforeEach(async () => {
  lastShakeHookCall.current = null;
  lastDialogProps.current = null;
  showMessage.mockClear();
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
  await db.clear(STORE_NAME);
  db.close();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ShakeToReportProvider', () => {
  it('keeps the shake detector disabled until the dismissed preference hydrates', async () => {
    render(<ShakeToReportProvider />);
    // First render — hydration has not resolved yet.
    expect(lastShakeHookCall.current?.enabled).toBe(false);
    // Once resolution completes, detector enables for a first-time user.
    await waitFor(() => {
      expect(lastShakeHookCall.current?.enabled).toBe(true);
    });
  });

  it('leaves the shake detector disabled for a user who previously opted out', async () => {
    await setPreference('shakeToReport:dismissed', true);
    render(<ShakeToReportProvider />);
    // Wait long enough for hydration to complete, then confirm it stays off.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lastShakeHookCall.current?.enabled).toBe(false);
  });

  it('opens the dialog when the detector fires', async () => {
    render(<ShakeToReportProvider />);
    await waitFor(() => expect(lastShakeHookCall.current?.enabled).toBe(true));
    act(() => {
      lastShakeHookCall.current?.onShake();
    });
    expect(lastDialogProps.current?.open).toBe(true);
    // Detector pauses while the dialog is open so a continuous shake can't re-trigger.
    expect(lastShakeHookCall.current?.enabled).toBe(false);
  });

  it('persists the opt-out, silences the detector, and fires the fallback snackbar', async () => {
    render(<ShakeToReportProvider />);
    await waitFor(() => expect(lastShakeHookCall.current?.enabled).toBe(true));
    act(() => {
      lastShakeHookCall.current?.onShake();
    });
    const action = lastDialogProps.current?.secondaryAction;
    expect(action?.label).toBe("Don't show this again");

    act(() => {
      action?.onClick();
    });

    // Dialog closes, detector is now permanently off for this session.
    expect(lastDialogProps.current?.open).toBe(false);
    expect(lastShakeHookCall.current?.enabled).toBe(false);

    // Snackbar points the user at the manual fallback path.
    expect(showMessage).toHaveBeenCalledWith(
      'Shake to report off. Tap your avatar up top to send feedback.',
      'info',
      undefined,
      6000,
    );

    // And the preference survived into IndexedDB.
    await waitFor(async () => {
      const db = await openDB(DB_NAME, 1);
      const value = await db.get(STORE_NAME, 'shakeToReport:dismissed');
      db.close();
      expect(value).toBe(true);
    });
  });
});

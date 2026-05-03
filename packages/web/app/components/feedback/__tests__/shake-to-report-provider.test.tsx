import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { ShakeToReportProvider } from '../shake-to-report-provider';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

type DismissedResolver = {
  resolve: (value: boolean) => void;
  reject: (error: unknown) => void;
};

// vi.mock factories are hoisted above module-level code, so any refs they
// need must be created via vi.hoisted. Capturing the dismissed-preference
// resolver here gives every test deterministic control over hydration
// (success, opt-out, and rejection paths alike) without hitting IndexedDB.
const { pendingGetRef, setDismissedMock, showMessageMock, shakeHookRef } = vi.hoisted(() => ({
  pendingGetRef: { current: null as DismissedResolver | null },
  setDismissedMock: vi.fn(),
  showMessageMock: vi.fn(),
  shakeHookRef: { current: null as { onShake: () => void; enabled: boolean } | null },
}));

vi.mock('@/app/hooks/use-shake-detector', () => ({
  useShakeDetector: (onShake: () => void, options: { enabled: boolean }) => {
    shakeHookRef.current = { onShake, enabled: options.enabled };
  },
}));

vi.mock('@/app/components/providers/snackbar-provider', () => ({
  useSnackbar: () => ({ showMessage: showMessageMock }),
}));

vi.mock('@/app/lib/user-preferences-db', () => ({
  getShakeToReportDismissed: () =>
    new Promise<boolean>((resolve, reject) => {
      pendingGetRef.current = { resolve, reject };
    }),
  setShakeToReportDismissed: setDismissedMock,
}));

// BugReportDialog pulls in React Query / form children we don't care about
// here — stub it down to its props so the test can drive the dismiss flow.
type CapturedDialogProps = {
  open: boolean;
  onClose: () => void;
  secondaryAction?: { label: string; onClick: () => void };
};
const { dialogPropsRef } = vi.hoisted(() => ({
  dialogPropsRef: { current: null as CapturedDialogProps | null },
}));

vi.mock('../bug-report-dialog', () => ({
  BugReportDialog: (props: CapturedDialogProps) => {
    dialogPropsRef.current = props;
    return props.open ? <div data-testid="bug-report-dialog">open</div> : null;
  },
}));

async function resolveHydration(value: boolean) {
  await waitFor(() => expect(pendingGetRef.current).not.toBeNull());
  await act(async () => {
    pendingGetRef.current!.resolve(value);
    await Promise.resolve();
  });
}

async function rejectHydration(error: unknown) {
  await waitFor(() => expect(pendingGetRef.current).not.toBeNull());
  await act(async () => {
    pendingGetRef.current!.reject(error);
    await Promise.resolve();
  });
}

beforeEach(() => {
  shakeHookRef.current = null;
  dialogPropsRef.current = null;
  pendingGetRef.current = null;
  showMessageMock.mockClear();
  setDismissedMock.mockReset();
  setDismissedMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ShakeToReportProvider', () => {
  it('keeps the shake detector disabled until the dismissed preference hydrates', async () => {
    render(<ShakeToReportProvider />);
    // First render — hydration has not resolved yet.
    expect(shakeHookRef.current?.enabled).toBe(false);

    await resolveHydration(false);

    // Once resolution completes, detector enables for a first-time user.
    expect(shakeHookRef.current?.enabled).toBe(true);
  });

  it('leaves the shake detector disabled for a user who previously opted out', async () => {
    render(<ShakeToReportProvider />);
    await resolveHydration(true);
    expect(shakeHookRef.current?.enabled).toBe(false);
  });

  it('falls back to detector-on when the preference read rejects', async () => {
    render(<ShakeToReportProvider />);
    await rejectHydration(new Error('IndexedDB unavailable'));
    // A failed preference lookup must not leave the detector permanently off;
    // the user shouldn't lose the feature because storage is broken.
    expect(shakeHookRef.current?.enabled).toBe(true);
  });

  it('opens the dialog when the detector fires', async () => {
    render(<ShakeToReportProvider />);
    await resolveHydration(false);
    act(() => {
      shakeHookRef.current?.onShake();
    });
    expect(dialogPropsRef.current?.open).toBe(true);
    // Detector pauses while the dialog is open so a continuous shake can't re-trigger.
    expect(shakeHookRef.current?.enabled).toBe(false);
  });

  it('persists the opt-out, silences the detector, and fires the fallback snackbar', async () => {
    render(<ShakeToReportProvider />);
    await resolveHydration(false);
    act(() => {
      shakeHookRef.current?.onShake();
    });

    const action = dialogPropsRef.current?.secondaryAction;
    expect(action?.label).toBe("Don't show this again");

    act(() => {
      action?.onClick();
    });

    // Dialog closes, detector is now permanently off for this session.
    expect(dialogPropsRef.current?.open).toBe(false);
    expect(shakeHookRef.current?.enabled).toBe(false);

    // Preference write fired with true.
    expect(setDismissedMock).toHaveBeenCalledWith(true);

    // Snackbar points the user at the manual fallback path.
    expect(showMessageMock).toHaveBeenCalledWith(
      'Shake to report off. Tap your avatar up top to send feedback.',
      'info',
      undefined,
      6000,
    );
  });
});

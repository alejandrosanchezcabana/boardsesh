'use client';

import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';

import { clearDevUrl, getDevUrlState, setDevUrl, type DevUrlState } from '@/app/lib/dev-url';

type DevUrlDialogProps = {
  open: boolean;
  onClose: () => void;
};

// If the native side fails to tear the process down within this window, re-enable
// the UI so the dialog doesn't stay wedged (e.g. in a web browser preview, or if
// the plugin call silently no-ops in a release build).
const RESTART_TIMEOUT_MS = 1500;

function validateUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Enter a URL';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'URL must start with http:// or https://';
    }
    return null;
  } catch {
    return 'Not a valid URL';
  }
}

export default function DevUrlDialog({ open, onClose }: DevUrlDialogProps) {
  const [state, setState] = useState<DevUrlState | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const next = await getDevUrlState();
      if (cancelled) return;
      setState(next);
      setInput(next?.currentUrl ?? '');
      setError(null);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(
    () => () => {
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
      }
    },
    [],
  );

  const runWithRestartFallback = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    let succeeded = false;
    try {
      await action();
      succeeded = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (succeeded) {
        // Plugin resolved — native side should now kill the process. If it
        // doesn't within the timeout (release no-op, web-browser preview),
        // unlock the dialog so the user can try again.
        restartTimerRef.current = window.setTimeout(() => setBusy(false), RESTART_TIMEOUT_MS);
      } else {
        setBusy(false);
      }
    }
  };

  const save = () => {
    const validationError = validateUrl(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    void runWithRestartFallback(() => setDevUrl(input.trim()));
  };

  const clear = () => {
    void runWithRestartFallback(() => clearDevUrl());
  };

  const useDefault = () => {
    setInput(state?.defaultUrl ?? 'https://www.boardsesh.com');
    setError(null);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      {/* i18n-ignore-next-line */}
      <DialogTitle>Dev URL</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {/* i18n-ignore-next-line */}
            Point the WebView at a different origin. The app will restart after saving.
          </Typography>
          <TextField
            // i18n-ignore-next-line
            label="Server URL"
            placeholder={state?.defaultUrl ?? 'https://www.boardsesh.com'}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            error={Boolean(error)}
            helperText={error ?? ' '}
            disabled={busy}
            fullWidth
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <Button size="small" variant="outlined" onClick={useDefault} disabled={busy}>
            {/* i18n-ignore-next-line */}
            Use production
          </Button>
          {state?.currentUrl && (
            <Typography variant="caption" color="text.secondary">
              {/* i18n-ignore-next-line */}
              Currently overriding to: {state.currentUrl}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {/* i18n-ignore-next-line */}
          Cancel
        </Button>
        <Button onClick={clear} disabled={busy || !state?.currentUrl} color="warning">
          {/* i18n-ignore-next-line */}
          Clear override
        </Button>
        <Button
          onClick={save}
          disabled={busy || !input.trim()}
          variant="contained"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {busy ? 'Restarting…' : 'Save & restart'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

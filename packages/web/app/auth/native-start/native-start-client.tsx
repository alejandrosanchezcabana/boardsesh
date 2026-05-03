'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCsrfToken } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

const ALLOWED_PROVIDERS = new Set(['google', 'apple', 'facebook']);

function NativeStartInner() {
  const { t } = useTranslation('auth');
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const provider = params.get('provider');
  const callbackUrl = params.get('callbackUrl') ?? '/';

  useEffect(() => {
    if (submitted.current) return;
    if (!provider || !ALLOWED_PROVIDERS.has(provider)) return;

    void getCsrfToken().then((csrfToken: string | undefined) => {
      if (!csrfToken || !formRef.current || submitted.current) return;
      submitted.current = true;

      const input = formRef.current.querySelector<HTMLInputElement>('input[name="csrfToken"]');
      if (input) input.value = csrfToken;
      formRef.current.submit();
    });
  }, [provider, callbackUrl]);

  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Typography>{t('nativeStart.invalidProvider')}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography>{t('nativeStart.signingIn')}</Typography>
      <form
        ref={formRef}
        method="POST"
        action={`/api/auth/signin/${encodeURIComponent(provider)}`}
        style={{ display: 'none' }}
      >
        <input type="hidden" name="csrfToken" value="" />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      </form>
    </Box>
  );
}

export default function NativeStartClient() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <NativeStartInner />
    </Suspense>
  );
}

'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import LockOutlined from '@mui/icons-material/LockOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';

type SetPasswordSectionProps = {
  hasPassword: boolean;
  userEmail: string;
  linkedProviders: string[];
  onPasswordSet: () => void;
};

function formatProviderName(provider: string): string {
  const names: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    facebook: 'Facebook',
  };
  return names[provider] || provider;
}

export default function SetPasswordSection({
  hasPassword,
  userEmail,
  linkedProviders,
  onPasswordSet,
}: SetPasswordSectionProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [saving, setSaving] = useState(false);
  const { showMessage } = useSnackbar();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    let hasError = false;

    if (!password) {
      setPasswordError('Please enter a password');
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      hasError = true;
    } else if (password.length > 128) {
      setPasswordError('Password must be less than 128 characters');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password');
      hasError = true;
    } else if (confirmPassword !== password) {
      setConfirmError('Passwords do not match');
      hasError = true;
    } else {
      setConfirmError('');
    }

    if (hasError) return;

    try {
      setSaving(true);
      const response = await fetch('/api/internal/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.error || 'Failed to set password', 'error');
        return;
      }

      showMessage('Password set! You can now log in with your email and password.', 'success');
      setPassword('');
      setConfirmPassword('');
      onPasswordSet();
    } catch (error) {
      console.error('Set password error:', error);
      showMessage('Failed to set password. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (hasPassword) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlined color="success" />
            <Typography variant="h5">Email & Password Login</Typography>
          </Box>
          <Typography variant="body2" component="span" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Password login is enabled for {userEmail}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const providerNames = linkedProviders.map(formatProviderName);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5">Email & Password Login</Typography>
        <Typography variant="body2" component="span" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Set a password to log in with your email address. This is useful for browsers that don&apos;t support Google
          sign-in (e.g., the Boardsesh iOS app).
        </Typography>

        {providerNames.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You&apos;re currently signed in with {providerNames.join(', ')}. Setting a password will not affect your{' '}
            {providerNames.length === 1 ? providerNames[0] : 'social'} login.
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Password (min 8 characters)"
            variant="outlined"
            size="small"
            fullWidth
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError('');
            }}
            error={!!passwordError}
            helperText={passwordError}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            variant="outlined"
            size="small"
            fullWidth
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmError) setConfirmError('');
            }}
            error={!!confirmError}
            helperText={confirmError}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            variant="contained"
            type="submit"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <LockOutlined />}
            fullWidth
          >
            Set Password
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

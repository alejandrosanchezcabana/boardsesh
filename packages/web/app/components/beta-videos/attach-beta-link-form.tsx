'use client';

import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import {
  ATTACH_BETA_LINK,
  type AttachBetaLinkMutationVariables,
  type AttachBetaLinkMutationResponse,
} from '@/app/lib/graphql/operations';
import { isBetaVideoUrl, BETA_VIDEO_URL_VALIDATION_MESSAGE } from '@/app/lib/beta-video-url';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';

type AttachBetaLinkFormProps = {
  boardType: string;
  climbUuid: string;
  climbName?: string;
  angle?: number | null;
  resetTrigger?: unknown;
  submitLabel?: string;
  helperText?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
};

const AttachBetaLinkForm: React.FC<AttachBetaLinkFormProps> = ({
  boardType,
  climbUuid,
  climbName,
  angle,
  resetTrigger,
  submitLabel = 'Share beta',
  helperText = 'Paste an Instagram or TikTok link so others can see your beta.',
  onSuccess,
  onCancel,
  showCancel = false,
  autoFocus = false,
  compact = false,
}) => {
  const [url, setUrl] = useState('');
  const { token } = useWsAuthToken();
  const queryClient = useQueryClient();
  const { showMessage } = useSnackbar();

  useEffect(() => {
    setUrl('');
  }, [resetTrigger]);

  const trimmed = url.trim();
  const validationError = trimmed && !isBetaVideoUrl(trimmed) ? BETA_VIDEO_URL_VALIDATION_MESSAGE : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Auth token not available');
      const client = createGraphQLHttpClient(token);
      const variables: AttachBetaLinkMutationVariables = {
        input: {
          boardType,
          climbUuid,
          link: trimmed,
          angle: angle ?? undefined,
        },
      };
      await client.request<AttachBetaLinkMutationResponse>(ATTACH_BETA_LINK, variables);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['betaLinks', boardType, climbUuid] });
      showMessage('Video added to beta', 'success');
      setUrl('');
      onSuccess?.();
    },
    onError: () => {
      showMessage('Couldn’t add video. Try again.', 'error');
    },
  });

  const canSubmit = !!trimmed && !validationError && !mutation.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 1.25 : 1.5 }}>
      <TextField
        autoFocus={autoFocus}
        fullWidth
        placeholder="Instagram or TikTok URL"
        label={climbName ? `Beta video URL for ${climbName}` : 'Beta video URL'}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        error={!!validationError}
        helperText={validationError ?? helperText}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) {
            e.preventDefault();
            mutation.mutate();
          }
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        {showCancel && onCancel && (
          <Button onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          startIcon={mutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
};

export default AttachBetaLinkForm;

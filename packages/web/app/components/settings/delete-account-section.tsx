'use client';

import React, { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { signOut } from 'next-auth/react';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';

export default function DeleteAccountSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { showMessage } = useSnackbar();

  const isConfirmed = confirmText === 'DELETE';

  const handleOpen = () => {
    setDialogOpen(true);
    setConfirmText('');
  };

  const handleClose = () => {
    if (deleting) return;
    setDialogOpen(false);
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (!isConfirmed) return;

    try {
      setDeleting(true);
      const response = await fetch('/api/internal/delete-account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data: { error?: string } = await response.json();
        showMessage(data.error || 'Failed to delete account', 'error');
        return;
      }

      // Account deleted - sign out and redirect to home
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Delete account error:', error);
      showMessage('Failed to delete account. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Delete Account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </Typography>
          <Button variant="outlined" color="error" onClick={handleOpen}>
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This is permanent. Your profile, saved climbs, logbook entries, and
            all other data will be deleted and cannot be recovered.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Type <strong>DELETE</strong> to confirm.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}
          >
            Delete My Account
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

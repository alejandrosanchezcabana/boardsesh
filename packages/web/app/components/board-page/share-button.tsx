'use client';

import React, { useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import Lightbulb from '@mui/icons-material/Lightbulb';
import AppleOutlined from '@mui/icons-material/Apple';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useCurrentClimb, useSessionData } from '../graphql-queue';
import { useBluetoothContext } from '../board-bluetooth-control/bluetooth-context';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { themeTokens } from '@/app/theme/theme-config';
import { isCapacitor } from '@/app/lib/ble/capacitor-utils';

export const ShareBoardButton = () => {
  const { showMessage } = useSnackbar();
  const {
    hasConnected,
    isSessionActive,
    sessionId,
  } = useSessionData();
  const {
    isConnected: isBoardConnected,
    connect: btConnect,
    disconnect: btDisconnect,
    loading: btLoading,
    isBluetoothSupported,
    isIOS,
  } = useBluetoothContext();
  const { currentClimbQueueItem } = useCurrentClimb();
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);

  const isConnecting = !!(sessionId && !hasConnected);

  const handleLightbulbClick = async () => {
    // Allow connection in Capacitor apps even if the async isBluetoothSupported
    // state hasn't resolved yet — the native bridge is available by click time.
    if (!isBluetoothSupported && !isCapacitor()) {
      setUnsupportedOpen(true);
      return;
    }
    if (isBoardConnected) {
      btDisconnect();
      return;
    }
    let success: boolean;
    if (currentClimbQueueItem) {
      success = await btConnect(
        currentClimbQueueItem.climb.frames,
        !!currentClimbQueueItem.climb.mirrored,
      );
    } else {
      success = await btConnect();
    }
    if (!success) {
      showMessage('Could not connect to board. Make sure Bluetooth is on and the board is nearby.', 'error');
    }
  };

  return (
    <>
      <IconButton
        aria-label={isBoardConnected ? 'Disconnect from board' : 'Connect to board'}
        onClick={handleLightbulbClick}
        color={isSessionActive ? 'primary' : 'default'}
      >
        {isConnecting || btLoading ? (
          <CircularProgress size={16} />
        ) : isBoardConnected ? (
          <Lightbulb sx={{
            color: themeTokens.colors.warning,
            '@keyframes connectedGlow': {
              '0%': { filter: `drop-shadow(0 0 2px ${themeTokens.colors.warning}99)` },
              '100%': { filter: `drop-shadow(0 0 6px ${themeTokens.colors.warning})` },
            },
            animation: 'connectedGlow 1.5s ease-in-out infinite alternate',
          }} />
        ) : (
          <LightbulbOutlined />
        )}
      </IconButton>

      <Dialog open={unsupportedOpen} onClose={() => setUnsupportedOpen(false)}>
        <DialogTitle>Board lighting unavailable</DialogTitle>
        <DialogContent>
          {isIOS ? (
            <Typography variant="body2">
              Safari doesn&apos;t support Bluetooth. Use the Boardsesh app to light up holds on your board.
            </Typography>
          ) : (
            <Typography variant="body2">
              This browser doesn&apos;t support Bluetooth. Switch to Chrome to light up holds on your board.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnsupportedOpen(false)}>Dismiss</Button>
          {isIOS && (
            <Button
              variant="contained"
              startIcon={<AppleOutlined />}
              href="https://apps.apple.com/app/boardsesh/id6761350784"
              target="_blank"
              onClick={() => setUnsupportedOpen(false)}
            >
              Get the app
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

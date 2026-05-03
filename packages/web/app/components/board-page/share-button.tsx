'use client';

import React, { useCallback, useState } from 'react';
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
import { useLongPress } from '@/app/lib/hooks/use-long-press';
import { LightControlDrawer } from './light-control-drawer';
import { useTranslation } from 'react-i18next';

export const ShareBoardButton = () => {
  const { t } = useTranslation('climbs');
  const { showMessage } = useSnackbar();
  const { hasConnected, isSessionActive, sessionId } = useSessionData();
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
  const [lightDrawerOpen, setLightDrawerOpen] = useState(false);
  // Defer mounting the drawer until the user actually long-presses. Keeps it
  // out of the initial board-page render path (the glyph-snap useMemo and
  // related effects only run for users who opt into the feature).
  const [hasOpenedDrawer, setHasOpenedDrawer] = useState(false);

  const isConnecting = !!(sessionId && !hasConnected);

  // Long-press is only meaningful while connected — opening the light drawer
  // when there's no board to control would dead-end the user.
  const handleLongPress = useCallback(() => {
    if (!isBoardConnected) return;
    setHasOpenedDrawer(true);
    setLightDrawerOpen(true);
  }, [isBoardConnected]);

  const { ref: longPressRef, consumeLongPress } = useLongPress<HTMLButtonElement>(handleLongPress);

  const handleLightbulbClick = async () => {
    // Suppress the click that follows a long-press so opening the drawer
    // doesn't also disconnect the board.
    if (consumeLongPress()) return;
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
      success = await btConnect(currentClimbQueueItem.climb.frames, !!currentClimbQueueItem.climb.mirrored);
    } else {
      success = await btConnect();
    }
    if (!success) {
      showMessage(t('board.connectError'), 'error');
    }
  };

  let lightbulbIcon: React.ReactNode;
  if (isConnecting || btLoading) {
    lightbulbIcon = <CircularProgress size={16} />;
  } else if (isBoardConnected) {
    lightbulbIcon = (
      <Lightbulb
        sx={{
          color: themeTokens.colors.warning,
          '@keyframes connectedGlow': {
            '0%': { filter: `drop-shadow(0 0 2px ${themeTokens.colors.warning}99)` },
            '100%': { filter: `drop-shadow(0 0 6px ${themeTokens.colors.warning})` },
          },
          animation: 'connectedGlow 1.5s ease-in-out infinite alternate',
        }}
      />
    );
  } else {
    lightbulbIcon = <LightbulbOutlined />;
  }

  return (
    <>
      <IconButton
        ref={longPressRef}
        aria-label={isBoardConnected ? t('board.disconnect') : t('board.connect')}
        onClick={handleLightbulbClick}
        color={isSessionActive ? 'primary' : 'default'}
      >
        {lightbulbIcon}
      </IconButton>

      {hasOpenedDrawer && <LightControlDrawer open={lightDrawerOpen} onClose={() => setLightDrawerOpen(false)} />}

      <Dialog open={unsupportedOpen} onClose={() => setUnsupportedOpen(false)}>
        <DialogTitle>{t('board.lightingUnavailable')}</DialogTitle>
        <DialogContent>
          {isIOS ? (
            <Typography variant="body2">{t('board.lightingUnavailableIos')}</Typography>
          ) : (
            <Typography variant="body2">{t('board.lightingUnavailableBrowser')}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnsupportedOpen(false)}>{t('board.dismiss')}</Button>
          {isIOS && (
            <Button
              variant="contained"
              startIcon={<AppleOutlined />}
              href="https://apps.apple.com/app/boardsesh/id6761350784"
              target="_blank"
              onClick={() => setUnsupportedOpen(false)}
            >
              {t('board.getApp')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

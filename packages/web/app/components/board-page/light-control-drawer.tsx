'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import Celebration from '@mui/icons-material/Celebration';
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined';
import SwipeableDrawer from '@/app/components/swipeable-drawer/swipeable-drawer';
import { useBluetoothContext } from '../board-bluetooth-control/bluetooth-context';
import { STATE_TO_PRIMARY_CODE } from '../board-renderer/types';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { GLYPHS, PARTY_LETTERS, buildPartyFrames, mapGlyphToHolds } from './party-glyphs';

const PARTY_TICK_MS = 600;

type LightControlDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export const LightControlDrawer: React.FC<LightControlDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation('common');
  const { showMessage } = useSnackbar();
  const { isConnected, sendFramesToBoard, clearBoard, boardDetails, partyActive, setPartyActive } =
    useBluetoothContext();

  const isMoonboard = boardDetails.board_name === 'moonboard';

  // Pre-snap each unique letter's bitmap to hold IDs once per board config —
  // the snap is deterministic so we don't need to re-run it every tick.
  const lettersToHoldIds = useMemo(() => {
    if (isMoonboard) return new Map<string, number[]>();
    const map = new Map<string, number[]>();
    for (const letter of new Set(PARTY_LETTERS)) {
      const glyph = GLYPHS[letter];
      if (!glyph) continue;
      map.set(letter, mapGlyphToHolds(glyph, boardDetails));
    }
    return map;
  }, [boardDetails, isMoonboard]);

  // Cycle through the letters of "BOARDSESH", rotating through the board's
  // available role colours so each letter is visually distinct.
  useEffect(() => {
    if (!partyActive || !isConnected || isMoonboard) return;

    const stateCodes = Object.values(STATE_TO_PRIMARY_CODE[boardDetails.board_name] ?? {}).filter(
      (code): code is number => typeof code === 'number',
    );
    if (stateCodes.length === 0) return;

    let letterIndex = 0;
    const sendCurrentLetter = () => {
      const letter = PARTY_LETTERS[letterIndex % PARTY_LETTERS.length];
      const holdIds = lettersToHoldIds.get(letter) ?? [];
      const stateCode = stateCodes[letterIndex % stateCodes.length];
      void sendFramesToBoard(buildPartyFrames(holdIds, stateCode));
      letterIndex++;
    };
    sendCurrentLetter();
    const intervalId = window.setInterval(sendCurrentLetter, PARTY_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [partyActive, isConnected, isMoonboard, boardDetails.board_name, lettersToHoldIds, sendFramesToBoard]);

  // When the user stops party mode, the wall would otherwise stay frozen on
  // the last letter — clear it once so the board returns to a blank state.
  const wasPartyActiveRef = useRef(partyActive);
  useEffect(() => {
    if (wasPartyActiveRef.current && !partyActive && isConnected) {
      void clearBoard();
    }
    wasPartyActiveRef.current = partyActive;
  }, [partyActive, isConnected, clearBoard]);

  const handleClearAll = async () => {
    // When party is active, the stop-party effect already issues a
    // clearBoard() once partyActive flips false — calling clearBoard()
    // here too would double up the BLE write for one tap.
    if (partyActive) {
      setPartyActive(false);
      return;
    }
    const result = await clearBoard();
    if (result === false) {
      showMessage(t('lightControl.clearFailed'), 'error');
    }
  };

  const handlePartyToggle = () => {
    if (isMoonboard) {
      showMessage(t('lightControl.partyUnsupported'), 'info');
      return;
    }
    setPartyActive(!partyActive);
  };

  return (
    <SwipeableDrawer placement="bottom" open={open} onClose={onClose} title={t('lightControl.title')} height="auto">
      <List disablePadding>
        <ListItemButton onClick={handleClearAll} disabled={!isConnected}>
          <ListItemIcon>
            <LightbulbOutlined />
          </ListItemIcon>
          <ListItemText primary={t('lightControl.turnOffAll')} />
        </ListItemButton>
        <ListItemButton onClick={handlePartyToggle} disabled={!isConnected || isMoonboard}>
          <ListItemIcon>{partyActive ? <StopCircleOutlined /> : <Celebration />}</ListItemIcon>
          <ListItemText
            primary={partyActive ? t('lightControl.stopParty') : t('lightControl.partyMode')}
            secondary={isMoonboard ? t('lightControl.partyUnsupported') : undefined}
          />
        </ListItemButton>
      </List>
    </SwipeableDrawer>
  );
};

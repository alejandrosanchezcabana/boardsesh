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
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import SwipeableDrawer from '@/app/components/swipeable-drawer/swipeable-drawer';
import { useBluetoothContext } from '../board-bluetooth-control/bluetooth-context';
import { useCurrentClimb } from '../graphql-queue';
import { STATE_TO_PRIMARY_CODE } from '../board-renderer/types';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { GLYPHS, PARTY_LETTERS, buildPartyFrames, mapGlyphToHolds } from './party-glyphs';

const PARTY_TICK_MS = 600;
const DISCO_TICK_MS = 450;

type LightControlDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Pull just the placement IDs out of a frame string like "p123r42p55r43".
 * Empty / malformed frames return [], so the disco effect no-ops gracefully
 * when the climb has no lit holds.
 */
function extractPlacementIds(frames: string): number[] {
  if (!frames) return [];
  const ids: number[] = [];
  for (const segment of frames.split('p')) {
    if (!segment) continue;
    const placementStr = segment.split('r')[0];
    const placementId = Number(placementStr);
    if (Number.isFinite(placementId)) ids.push(placementId);
  }
  return ids;
}

export const LightControlDrawer: React.FC<LightControlDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation('common');
  const { showMessage } = useSnackbar();
  const { isConnected, sendFramesToBoard, clearBoard, boardDetails, partyMode, setPartyMode } = useBluetoothContext();
  const { currentClimbQueueItem } = useCurrentClimb();

  const isMoonboard = boardDetails.board_name === 'moonboard';
  const climbFrames = currentClimbQueueItem?.climb.frames ?? '';
  const climbMirrored = !!currentClimbQueueItem?.climb.mirrored;
  const hasClimbLoaded = climbFrames.length > 0;

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
    if (partyMode !== 'glyphs' || !isConnected || isMoonboard) return;

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
  }, [partyMode, isConnected, isMoonboard, boardDetails.board_name, lettersToHoldIds, sendFramesToBoard]);

  // Disco mode: keep the current climb's lit holds, but reroll each hold's
  // colour every tick. The placement IDs come straight from the climb's
  // frames string so swapping climbs while the disco is running picks up
  // the new holds on the next tick.
  useEffect(() => {
    if (partyMode !== 'disco' || !isConnected) return;

    const stateCodes = Object.values(STATE_TO_PRIMARY_CODE[boardDetails.board_name] ?? {}).filter(
      (code): code is number => typeof code === 'number',
    );
    if (stateCodes.length === 0) return;

    const placementIds = extractPlacementIds(climbFrames);
    if (placementIds.length === 0) return;

    const sendDiscoFrame = () => {
      const frames = placementIds
        .map((id) => `p${id}r${stateCodes[Math.floor(Math.random() * stateCodes.length)]}`)
        .join('');
      void sendFramesToBoard(frames, climbMirrored);
    };
    sendDiscoFrame();
    const intervalId = window.setInterval(sendDiscoFrame, DISCO_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [partyMode, isConnected, boardDetails.board_name, climbFrames, climbMirrored, sendFramesToBoard]);

  // When any light show stops, the wall would otherwise stay frozen on the
  // last frame — clear it once so the board returns to a blank state. The
  // queue auto-sender resumes on the next render and repaints the climb.
  const lastPartyModeRef = useRef(partyMode);
  useEffect(() => {
    if (lastPartyModeRef.current !== 'off' && partyMode === 'off' && isConnected) {
      void clearBoard();
    }
    lastPartyModeRef.current = partyMode;
  }, [partyMode, isConnected, clearBoard]);

  const handleClearAll = async () => {
    // When a light show is active, the stop effect already issues a
    // clearBoard() once partyMode flips off — calling clearBoard()
    // here too would double up the BLE write for one tap.
    if (partyMode !== 'off') {
      setPartyMode('off');
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
    setPartyMode(partyMode === 'glyphs' ? 'off' : 'glyphs');
  };

  const handleDiscoToggle = () => {
    if (!hasClimbLoaded) {
      showMessage(t('lightControl.discoNeedsClimb'), 'info');
      return;
    }
    setPartyMode(partyMode === 'disco' ? 'off' : 'disco');
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
        <ListItemButton onClick={handleDiscoToggle} disabled={!isConnected || !hasClimbLoaded}>
          <ListItemIcon>{partyMode === 'disco' ? <StopCircleOutlined /> : <AutoAwesome />}</ListItemIcon>
          <ListItemText
            primary={partyMode === 'disco' ? t('lightControl.stopDisco') : t('lightControl.discoMode')}
            secondary={!hasClimbLoaded ? t('lightControl.discoNeedsClimb') : undefined}
          />
        </ListItemButton>
        <ListItemButton onClick={handlePartyToggle} disabled={!isConnected || isMoonboard}>
          <ListItemIcon>{partyMode === 'glyphs' ? <StopCircleOutlined /> : <Celebration />}</ListItemIcon>
          <ListItemText
            primary={partyMode === 'glyphs' ? t('lightControl.stopParty') : t('lightControl.partyMode')}
            secondary={isMoonboard ? t('lightControl.partyUnsupported') : undefined}
          />
        </ListItemButton>
      </List>
    </SwipeableDrawer>
  );
};

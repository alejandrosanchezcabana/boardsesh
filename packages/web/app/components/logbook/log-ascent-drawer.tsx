'use client';

import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogAscentForm } from './logascent-form';
import type { BoardDetails, Climb } from '@/app/lib/types';

type LogAscentDrawerProps = {
  open: boolean;
  onClose: () => void;
  currentClimb: Climb | null;
  boardDetails: BoardDetails;
};

export const LogAscentDrawer: React.FC<LogAscentDrawerProps> = ({ open, onClose, currentClimb, boardDetails }) => {
  const { t } = useTranslation('climbs');
  return (
    <SwipeableDrawer
      title={t('actions.tick.drawer.logAscent')}
      placement="bottom"
      onClose={onClose}
      open={open}
      fullHeight
      styles={{ wrapper: { height: '100%' } }}
    >
      {currentClimb && <LogAscentForm currentClimb={currentClimb} boardDetails={boardDetails} onClose={onClose} />}
    </SwipeableDrawer>
  );
};

'use client';

import React, { useMemo } from 'react';
import BluetoothOutlined from '@mui/icons-material/BluetoothOutlined';
import BluetoothSearching from '@mui/icons-material/BluetoothSearching';
import BluetoothDisabled from '@mui/icons-material/BluetoothDisabled';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { getBoardDetails, FALLBACK_BOARD_PREVIEW_CONFIGS } from '@/app/lib/board-constants';
import BoardRenderer from '../board-renderer/board-renderer';
import styles from './board-scroll.module.css';

export type BluetoothQuickStartStatus = 'idle' | 'scanning' | 'done' | 'unavailable';

type BluetoothQuickStartCardProps = {
  onClick?: () => void;
  status?: BluetoothQuickStartStatus;
  hasResults?: boolean;
  size?: 'default' | 'small';
};

export default function BluetoothQuickStartCard({
  onClick,
  status = 'idle',
  hasResults = false,
  size = 'default',
}: BluetoothQuickStartCardProps) {
  const { t } = useTranslation('boards');
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 36;

  const boardDetails = useMemo(
    () =>
      getBoardDetails({
        board_name: 'kilter',
        ...FALLBACK_BOARD_PREVIEW_CONFIGS.kilter,
      }),
    [],
  );

  const isDisabled = status === 'unavailable';
  const isError = status === 'done' && !hasResults;

  let icon: React.ReactNode;
  let label: string;
  switch (status) {
    case 'scanning':
      icon = <CircularProgress size={iconSize} className={styles.findNearbyIconPrimary} />;
      label = t('discovery.bluetooth.scanning');
      break;
    case 'done':
      if (hasResults) {
        icon = <BluetoothSearching className={styles.findNearbyIconPrimary} />;
        label = t('discovery.bluetooth.boardsFound');
      } else {
        icon = <SearchOffOutlined className={styles.findNearbyIconMuted} />;
        label = t('discovery.bluetooth.noBoardsFound');
      }
      break;
    case 'unavailable':
      icon = <BluetoothDisabled sx={{ fontSize: iconSize, color: 'var(--neutral-500)' }} />;
      label = t('discovery.bluetooth.unavailable');
      break;
    default:
      icon = <BluetoothOutlined className={styles.findNearbyIconPrimary} />;
      label = t('discovery.bluetooth.idle');
      break;
  }

  const handleClick = () => {
    if (isDisabled || status === 'scanning') return;
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isDisabled || status === 'scanning') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  const isClickable = !isDisabled && status !== 'scanning';

  return (
    <div
      className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''} ${!isClickable ? styles.cardScrollDisabled : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      aria-label={label}
      aria-disabled={!isClickable || undefined}
    >
      <div className={`${styles.cardSquare} ${isDisabled || isError ? styles.cardSquareDisabled : ''}`}>
        <div className={styles.findNearbyBoard}>
          <BoardRenderer mirrored={false} boardDetails={boardDetails} thumbnail fillHeight />
        </div>
        <div className={styles.findNearbyOverlay}>{icon}</div>
      </div>
      <div
        className={`${styles.cardName} ${isDisabled ? styles.cardNameDisabled : ''} ${isError ? styles.cardNameDisabled : ''}`}
      >
        {label}
      </div>
    </div>
  );
}

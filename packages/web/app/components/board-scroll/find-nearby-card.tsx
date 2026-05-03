'use client';

import React, { useMemo } from 'react';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import LocationOffOutlined from '@mui/icons-material/LocationOffOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { getBoardDetails } from '@/app/lib/board-constants';
import BoardRenderer from '../board-renderer/board-renderer';
import styles from './board-scroll.module.css';

export type FindNearbyStatus = 'idle' | 'loading' | 'geo-denied' | 'error' | 'no-results';

type FindNearbyCardProps = {
  onClick: () => void;
  status?: FindNearbyStatus;
  size?: 'default' | 'small';
};

export default function FindNearbyCard({ onClick, status = 'idle', size = 'default' }: FindNearbyCardProps) {
  const { t } = useTranslation('boards');
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 36;

  const boardDetails = useMemo(
    () =>
      getBoardDetails({
        board_name: 'kilter',
        layout_id: 1,
        size_id: 10,
        set_ids: [1, 20],
      }),
    [],
  );

  const isError = status === 'geo-denied' || status === 'error' || status === 'no-results';

  let icon: React.ReactNode;
  let label: string;
  switch (status) {
    case 'loading':
      icon = <CircularProgress size={iconSize} className={styles.findNearbyIconPrimary} />;
      label = t('discovery.findNearby.loading');
      break;
    case 'geo-denied':
      icon = <LocationOffOutlined className={styles.findNearbyIconError} />;
      label = t('discovery.findNearby.geoDenied');
      break;
    case 'error':
      icon = <ErrorOutlineOutlined className={styles.findNearbyIconError} />;
      label = t('discovery.findNearby.error');
      break;
    case 'no-results':
      icon = <SearchOffOutlined className={styles.findNearbyIconMuted} />;
      label = t('discovery.findNearby.noResults');
      break;
    default:
      icon = <LocationOnOutlined className={styles.findNearbyIconPrimary} />;
      label = t('discovery.findNearby.idle');
      break;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isError) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`}
      onClick={isError ? undefined : onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isError ? -1 : 0}
      aria-label={label}
      aria-disabled={isError || undefined}
    >
      <div className={`${styles.cardSquare} ${isError ? styles.cardSquareDisabled : ''}`}>
        <div className={styles.findNearbyBoard}>
          <BoardRenderer mirrored={false} boardDetails={boardDetails} thumbnail fillHeight />
        </div>
        <div className={styles.findNearbyOverlay}>{icon}</div>
      </div>
      <div
        className={`${styles.cardName} ${status === 'geo-denied' || status === 'error' ? styles.cardNameError : ''} ${status === 'no-results' ? styles.cardNameDisabled : ''}`}
      >
        {label}
      </div>
    </div>
  );
}

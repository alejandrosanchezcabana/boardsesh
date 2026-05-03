'use client';

import React from 'react';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { useTranslation } from 'react-i18next';
import BoardThumbnailGrid from './board-thumbnail-grid';
import styles from './board-scroll.module.css';

type SearchBoardsCardProps = {
  onClick: () => void;
  size?: 'default' | 'small';
};

export default function SearchBoardsCard({ onClick, size = 'default' }: SearchBoardsCardProps) {
  const { t } = useTranslation('boards');
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 36;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={t('discovery.search.ariaLabel')}
    >
      <div className={styles.cardSquare}>
        <BoardThumbnailGrid />
        <div className={styles.findNearbyOverlay}>
          <SearchOutlined sx={{ fontSize: iconSize, color: 'var(--color-primary)' }} />
        </div>
      </div>
      <div className={styles.cardName}>{t('discovery.search.label')}</div>
    </div>
  );
}

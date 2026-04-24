'use client';

import React from 'react';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import BoardThumbnailGrid from './board-thumbnail-grid';
import styles from './board-scroll.module.css';

type SearchBoardsCardProps = {
  onClick: () => void;
  size?: 'default' | 'small';
};

export default function SearchBoardsCard({ onClick, size = 'default' }: SearchBoardsCardProps) {
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
      aria-label="Search for a board"
    >
      <div className={styles.cardSquare}>
        <BoardThumbnailGrid />
        <div className={styles.findNearbyOverlay}>
          <SearchOutlined sx={{ fontSize: iconSize, color: 'var(--color-primary)' }} />
        </div>
      </div>
      <div className={styles.cardName}>Search</div>
    </div>
  );
}

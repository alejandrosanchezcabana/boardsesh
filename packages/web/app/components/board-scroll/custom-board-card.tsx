'use client';

import React from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import BoardThumbnailGrid from './board-thumbnail-grid';
import styles from './board-scroll.module.css';

type CustomBoardCardProps = {
  onClick: () => void;
  size?: 'default' | 'small';
};

export default function CustomBoardCard({ onClick, size = 'default' }: CustomBoardCardProps) {
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
      aria-label="Build a custom board"
    >
      <div className={styles.cardSquare}>
        <BoardThumbnailGrid />
        <div className={styles.findNearbyOverlay}>
          <AddOutlined sx={{ fontSize: iconSize, color: 'var(--color-primary)' }} />
        </div>
      </div>
      <div className={styles.cardName}>Custom board</div>
    </div>
  );
}

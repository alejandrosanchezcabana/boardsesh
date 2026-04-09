'use client';

import React, { useMemo } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { getBoardDetails } from '@/app/lib/board-constants';
import BoardRenderer from '../board-renderer/board-renderer';
import styles from './board-scroll.module.css';

const GRID_CONFIGS = [
  { board_name: 'kilter' as const, layout_id: 1, size_id: 10, set_ids: [1, 20] },
  { board_name: 'tension' as const, layout_id: 10, size_id: 6, set_ids: [12, 13] },
  { board_name: 'kilter' as const, layout_id: 8, size_id: 17, set_ids: [26] },
  { board_name: 'tension' as const, layout_id: 9, size_id: 3, set_ids: [8, 9] },
];

interface CustomBoardCardProps {
  onClick: () => void;
  size?: 'default' | 'small';
}

export default function CustomBoardCard({ onClick, size = 'default' }: CustomBoardCardProps) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 36;

  const boardDetailsList = useMemo(
    () => GRID_CONFIGS.map((config) => {
      try {
        return getBoardDetails(config);
      } catch {
        return null;
      }
    }),
    [],
  );

  return (
    <div className={`${styles.cardScroll} ${isSmall ? styles.cardScrollSmall : ''}`} onClick={onClick}>
      <div className={styles.cardSquare}>
        <div className={styles.customBoardGrid}>
          {boardDetailsList.map((details, i) => (
            <div key={i} className={styles.customBoardGridCell}>
              {details && (
                <BoardRenderer
                  mirrored={false}
                  boardDetails={details}
                  thumbnail
                  fillHeight
                />
              )}
            </div>
          ))}
        </div>
        <div className={styles.findNearbyOverlay}>
          <AddOutlined sx={{ fontSize: iconSize, color: 'var(--color-primary)' }} />
        </div>
      </div>
      <div className={styles.cardName}>Custom board</div>
    </div>
  );
}

'use client';

import React from 'react';
import Skeleton from '@mui/material/Skeleton';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import BoardseshBetaCard from './boardsesh-beta-card';
import BoardseshBetaAddPanel from './boardsesh-beta-add-panel';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaSectionProps = {
  boardType: string;
  climbUuid: string;
  angle: number;
  links: BetaLink[];
  isLoading: boolean;
  isAdding: boolean;
  onCancelAdd: () => void;
  onAddSuccess: () => void;
};

const BoardseshBetaSection: React.FC<BoardseshBetaSectionProps> = ({
  boardType,
  climbUuid,
  angle,
  links,
  isLoading,
  isAdding,
  onCancelAdd,
  onAddSuccess,
}) => {
  if (isAdding) {
    return (
      <BoardseshBetaAddPanel
        boardType={boardType}
        climbUuid={climbUuid}
        angle={angle}
        onCancel={onCancelAdd}
        onSuccess={onAddSuccess}
      />
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.scrollContainer}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className={styles.card}>
              <div className={styles.thumbnailWrapper}>
                <Skeleton variant="rectangular" sx={{ width: '100%', height: '100%' }} />
              </div>
            </div>
          ))
        ) : (
          <>
            {links.map((link) => (
              <BoardseshBetaCard key={link.link} link={link} />
            ))}
            {links.length === 0 && <span className={styles.emptyText}>No beta videos yet</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default BoardseshBetaSection;

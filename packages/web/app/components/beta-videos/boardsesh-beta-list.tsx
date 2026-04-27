'use client';

import React from 'react';
import Skeleton from '@mui/material/Skeleton';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import BoardseshBetaCard from './boardsesh-beta-card';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaListProps = {
  links: BetaLink[];
  isLoading: boolean;
};

const BoardseshBetaList: React.FC<BoardseshBetaListProps> = ({ links, isLoading }) => {
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

export default BoardseshBetaList;

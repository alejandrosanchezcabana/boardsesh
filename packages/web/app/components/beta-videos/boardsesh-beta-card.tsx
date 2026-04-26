'use client';

import React, { useState } from 'react';
import Instagram from '@mui/icons-material/Instagram';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import styles from './boardsesh-beta.module.css';

type BoardseshBetaCardProps = {
  link: BetaLink;
};

const BoardseshBetaCard: React.FC<BoardseshBetaCardProps> = ({ link }) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailSrc = !thumbnailFailed ? link.thumbnail : null;

  return (
    <a
      href={link.link}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      aria-label={`Open beta on Instagram${link.foreign_username ? ` by ${link.foreign_username}` : ''}`}
    >
      <div className={styles.thumbnailWrapper}>
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={`Beta by ${link.foreign_username || 'unknown'}`}
            className={styles.thumbnail}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <div className={styles.thumbnailPlaceholder}>
            <Instagram sx={{ fontSize: 28, color: 'var(--neutral-400)' }} />
          </div>
        )}
        <span className={styles.instagramBadge} aria-label="From Instagram">
          <Instagram sx={{ fontSize: 12 }} />
        </span>
        {link.foreign_username && <span className={styles.userChip}>@{link.foreign_username}</span>}
      </div>
    </a>
  );
};

export default BoardseshBetaCard;

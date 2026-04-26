'use client';

import React, { useState } from 'react';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import Instagram from '@mui/icons-material/Instagram';
import CircularProgress from '@mui/material/CircularProgress';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';
import styles from './boardsesh-beta.module.css';

type BetaVideoData = {
  uuid: string;
  userId: string | null;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  boardType: string;
  climbUuid: string;
  angle: number | null;
  bunnyVideoId: string;
  status: string;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  duration: number | null;
  createdAt: string;
};

type BunnyCardProps = {
  source?: 'bunny';
  video: BetaVideoData;
  onClick: () => void;
};

type InstagramCardProps = {
  source: 'instagram';
  link: BetaLink;
  onClick: () => void;
};

type BoardseshBetaCardProps = BunnyCardProps | InstagramCardProps;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const InstagramBetaCard: React.FC<{ link: BetaLink; onClick: () => void }> = ({ link, onClick }) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailSrc = !thumbnailFailed ? link.thumbnail : null;

  return (
    <div
      className={styles.card}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
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
        <div className={styles.playOverlay}>
          <PlayArrowOutlined sx={{ color: 'white', fontSize: 32 }} />
        </div>
        {link.foreign_username && <span className={styles.userChip}>@{link.foreign_username}</span>}
      </div>
    </div>
  );
};

const BoardseshBetaCard: React.FC<BoardseshBetaCardProps> = (props) => {
  if (props.source === 'instagram') {
    return <InstagramBetaCard link={props.link} onClick={props.onClick} />;
  }

  const { video, onClick } = props;
  const isProcessing = video.status !== 'ready';

  return (
    <div
      className={`${styles.card} ${isProcessing ? styles.cardProcessing : ''}`}
      onClick={isProcessing ? undefined : onClick}
      role={isProcessing ? undefined : 'button'}
      tabIndex={isProcessing ? undefined : 0}
      onKeyDown={
        isProcessing
          ? undefined
          : (e) => {
              if (e.key === 'Enter') onClick();
            }
      }
    >
      <div className={styles.thumbnailWrapper}>
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={`Beta by ${video.userDisplayName || 'unknown'}`}
            className={styles.thumbnail}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbnailPlaceholder} />
        )}
        {isProcessing ? (
          <div className={styles.processingOverlay}>
            <CircularProgress size={24} sx={{ color: 'white' }} />
            <span className={styles.processingLabel}>Processing</span>
          </div>
        ) : (
          <div className={styles.playOverlay}>
            <PlayArrowOutlined sx={{ color: 'white', fontSize: 32 }} />
          </div>
        )}
        {!isProcessing && video.duration != null && (
          <span className={styles.durationBadge}>{formatDuration(video.duration)}</span>
        )}
        {video.userDisplayName && <span className={styles.userChip}>@{video.userDisplayName}</span>}
      </div>
    </div>
  );
};

export default BoardseshBetaCard;
export type { BetaVideoData };

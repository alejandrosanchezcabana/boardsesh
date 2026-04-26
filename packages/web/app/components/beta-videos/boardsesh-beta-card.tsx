'use client';

import React from 'react';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import CircularProgress from '@mui/material/CircularProgress';
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

type BoardseshBetaCardProps = {
  video: BetaVideoData;
  onClick: () => void;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const BoardseshBetaCard: React.FC<BoardseshBetaCardProps> = ({ video, onClick }) => {
  const isProcessing = video.status !== 'ready';

  return (
    <div
      className={styles.card}
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
      style={isProcessing ? { cursor: 'default', opacity: 0.7 } : undefined}
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
          <div style={{ width: '100%', height: '100%', background: 'var(--neutral-200)' }} />
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

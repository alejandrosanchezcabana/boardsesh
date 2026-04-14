'use client';

import React, { useMemo } from 'react';
import { LabelOutlined, FavoriteOutlined } from '@mui/icons-material';
import { getBoardDetailsForPlaylist } from '@/app/lib/board-config-for-playlist';
import { themeTokens } from '@/app/theme/theme-config';
import BoardImageLayers from '../board-renderer/board-image-layers';
import styles from './library.module.css';

const PLAYLIST_COLORS = [
  themeTokens.colors.primary,
  themeTokens.colors.logoGreen,
  themeTokens.colors.purple,
  themeTokens.colors.warning,
  themeTokens.colors.pink,
  themeTokens.colors.success,
  themeTokens.colors.logoRose,
  themeTokens.colors.amber,
];

const isValidHexColor = (color: string): boolean => {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
};

/** Convert a hex color like "#FF6600" to "255, 102, 0" for use in rgba(). */
function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export type PlaylistPreviewSquareProps = {
  boardType: string;
  layoutId?: number | null;
  color?: string;
  icon?: string;
  isLikedClimbs?: boolean;
  index?: number;
  className?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
};

export default function PlaylistPreviewSquare({
  boardType,
  layoutId,
  color,
  icon,
  isLikedClimbs,
  index = 0,
  className,
  fetchPriority,
}: PlaylistPreviewSquareProps) {
  const boardDetails = useMemo(
    () => getBoardDetailsForPlaylist(boardType, layoutId),
    [boardType, layoutId],
  );

  const backgroundColor = isLikedClimbs
    ? undefined
    : color && isValidHexColor(color)
      ? color
      : PLAYLIST_COLORS[index % PLAYLIST_COLORS.length];

  const hasBoardPreview = !isLikedClimbs && boardDetails !== null;

  // Liked climbs: use the gradient, no board preview
  if (isLikedClimbs) {
    return (
      <div className={`${styles.previewContainer} ${styles.likedGradient} ${className ?? ''}`}>
        <div className={styles.previewIconLayer}>
          <FavoriteOutlined className={styles.previewIcon} />
        </div>
      </div>
    );
  }

  // No board details available: fall back to solid color gradient
  if (!hasBoardPreview) {
    return (
      <div
        className={`${styles.previewContainer} ${className ?? ''}`}
        style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 100%), ${backgroundColor}` }}
      >
        <div className={styles.previewIconLayer}>
          {icon ? (
            <span className={styles.previewEmoji}>{icon}</span>
          ) : (
            <LabelOutlined className={styles.previewIcon} />
          )}
        </div>
      </div>
    );
  }

  // Board preview with frosted glass overlay
  const rgbColor = backgroundColor ? hexToRgb(backgroundColor) : '0, 0, 0';

  return (
    <div className={`${styles.previewContainer} ${className ?? ''}`}>
      <div className={styles.previewBoardLayer}>
        <BoardImageLayers
          boardDetails={boardDetails}
          mirrored={false}
          thumbnail
          style={{ width: '100%', height: '100%' }}
          fetchPriority={fetchPriority}
        />
      </div>
      <div
        className={styles.previewFrostedOverlay}
        style={{ background: `rgba(${rgbColor}, 0.45)` }}
      />
      <div className={styles.previewIconLayer}>
        {icon ? (
          <span className={styles.previewEmoji}>{icon}</span>
        ) : (
          <LabelOutlined className={styles.previewIcon} />
        )}
      </div>
    </div>
  );
}

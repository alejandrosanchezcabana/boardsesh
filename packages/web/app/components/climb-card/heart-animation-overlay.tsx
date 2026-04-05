'use client';

import React from 'react';
import Favorite from '@mui/icons-material/Favorite';
import styles from './heart-animation-overlay.module.css';

interface HeartAnimationOverlayProps {
  visible: boolean;
  onAnimationEnd: () => void;
  /** Icon size in px. Defaults to 80. */
  size?: number;
}

const HeartAnimationOverlay = React.memo(function HeartAnimationOverlay({
  visible,
  onAnimationEnd,
  size = 80,
}: HeartAnimationOverlayProps) {
  if (!visible) return null;

  return (
    <div className={styles.overlay} data-testid="heart-animation-overlay">
      <Favorite
        className={styles.heart}
        onAnimationEnd={onAnimationEnd}
        sx={{ fontSize: size, color: 'white' }}
      />
    </div>
  );
});

export default HeartAnimationOverlay;

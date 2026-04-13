'use client';

import React, { useMemo } from 'react';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { ClimbUuid } from '@/app/lib/types';
import { useOptionalBoardProvider } from '../board-provider/board-provider-context';
import { themeTokens } from '@/app/theme/theme-config';
import styles from './ascent-status.module.css';

interface AscentStatusProps {
  climbUuid: ClimbUuid;
  fontSize?: number;
  /** Optional className for the outermost wrapper (e.g. positioning on a thumbnail). */
  className?: string;
}

export const AscentStatus = ({ climbUuid, fontSize, className }: AscentStatusProps) => {
  const boardProvider = useOptionalBoardProvider();
  const logbook = boardProvider?.logbook ?? [];
  const boardName = boardProvider?.boardName ?? 'kilter';

  const ascentsForClimb = useMemo(
    () => logbook.filter((ascent) => ascent.climb_uuid === climbUuid),
    [logbook, climbUuid],
  );

  const hasSuccessfulAscent = ascentsForClimb.some(({ is_ascent, is_mirror }) => is_ascent && !is_mirror);
  const hasSuccessfulMirroredAscent = ascentsForClimb.some(({ is_ascent, is_mirror }) => is_ascent && is_mirror);
  const hasAttempts = ascentsForClimb.length > 0;
  const supportsMirroring = boardName === 'tension';

  if (!hasAttempts) return null;

  const successColor = themeTokens.colors.success;
  const attemptColor = themeTokens.colors.error;

  if (supportsMirroring) {
    return (
      <div className={`${styles.ascentStatusContainer} ${className ?? ''}`}>
        {/* Regular ascent icon */}
        {hasSuccessfulAscent ? (
          <div className={styles.ascentIconRegular} style={{ backgroundColor: successColor }}>
            <CheckOutlined style={{ color: 'white', fontSize }} />
          </div>
        ) : null}
        {/* Mirrored ascent icon */}
        {hasSuccessfulMirroredAscent ? (
          <div className={styles.ascentIconMirrored} style={{ backgroundColor: successColor }}>
            <CheckOutlined style={{ color: 'white', fontSize }} />
          </div>
        ) : null}
        {!hasSuccessfulMirroredAscent && !hasSuccessfulAscent ? (
          <div className={styles.ascentIconRegular} style={{ backgroundColor: attemptColor }}>
            <CloseOutlined style={{ color: 'white', fontSize }} />
          </div>
        ) : null}
      </div>
    );
  }

  // Single icon for non-mirroring boards
  const wrapperClass = className ?? '';
  return hasSuccessfulAscent ? (
    <span className={wrapperClass} style={{ backgroundColor: successColor }}>
      <CheckOutlined style={{ color: 'white', fontSize }} />
    </span>
  ) : (
    <span className={wrapperClass} style={{ backgroundColor: attemptColor }}>
      <CloseOutlined style={{ color: 'white', fontSize }} />
    </span>
  );
};

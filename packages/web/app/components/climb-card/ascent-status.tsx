'use client';

import React, { useMemo } from 'react';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { ClimbUuid } from '@/app/lib/types';
import { useOptionalBoardProvider } from '../board-provider/board-provider-context';
import { themeTokens } from '@/app/theme/theme-config';

interface AscentStatusProps {
  climbUuid: ClimbUuid;
  fontSize?: number;
  /** Class for the badge wrapper (e.g. positioning on a thumbnail).
   *  For mirroring boards this is applied to each individual badge. */
  className?: string;
  /** Additional class for the mirrored ascent badge (bottom-left positioning). */
  mirroredClassName?: string;
}

export const AscentStatus = ({ climbUuid, fontSize, className, mirroredClassName }: AscentStatusProps) => {
  const boardProvider = useOptionalBoardProvider();
  const logbook = boardProvider?.logbook ?? [];
  const boardName = boardProvider?.boardName ?? 'kilter';

  const ascentsForClimb = useMemo(
    () => logbook.filter((ascent) => ascent.climb_uuid === climbUuid),
    [logbook, climbUuid],
  );

  const hasSuccessfulAscent = ascentsForClimb.some(({ is_ascent, is_mirror }) => is_ascent && !is_mirror);
  const hasSuccessfulMirroredAscent = ascentsForClimb.some(({ is_ascent, is_mirror }) => is_ascent && is_mirror);
  const hasRegularAttempt = ascentsForClimb.some(({ is_mirror }) => !is_mirror);
  const hasMirroredAttempt = ascentsForClimb.some(({ is_mirror }) => is_mirror);
  const hasAttempts = ascentsForClimb.length > 0;
  const supportsMirroring = boardName === 'tension' || boardName === 'decoy';

  if (!hasAttempts) return null;

  const successColor = themeTokens.colors.success;
  const attemptColor = themeTokens.colors.error;

  if (supportsMirroring) {
    // Regular badge (bottom-right): check if ascent, else attempt X if any regular entries
    const regularBadge = hasSuccessfulAscent
      ? { color: successColor, Icon: CheckOutlined }
      : hasRegularAttempt
        ? { color: attemptColor, Icon: CloseOutlined }
        : null;

    // Mirrored badge (bottom-left): check if mirrored ascent, else attempt X if any mirrored entries
    const mirroredBadge = hasSuccessfulMirroredAscent
      ? { color: successColor, Icon: CheckOutlined }
      : hasMirroredAttempt
        ? { color: attemptColor, Icon: CloseOutlined }
        : null;

    return (
      <>
        {regularBadge && (
          <span className={className ?? ''} style={{ backgroundColor: regularBadge.color }}>
            <regularBadge.Icon style={{ color: 'white', fontSize }} />
          </span>
        )}
        {mirroredBadge && (
          <span className={mirroredClassName ?? className ?? ''} style={{ backgroundColor: mirroredBadge.color }}>
            <mirroredBadge.Icon style={{ color: 'white', fontSize, transform: 'scaleX(-1)' }} />
          </span>
        )}
      </>
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

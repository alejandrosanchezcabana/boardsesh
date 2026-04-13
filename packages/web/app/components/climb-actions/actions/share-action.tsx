'use client';

import React, { useCallback } from 'react';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import { ClimbActionProps, ClimbActionResult } from '../types';
import {
  getContextAwareClimbViewUrl,
} from '@/app/lib/url-utils';
import { buildActionResult, computeActionDisplay } from '../action-view-renderer';
import { shareWithFallback } from '@/app/lib/share-utils';

export function ShareAction({
  climb,
  boardDetails,
  angle,
  currentPathname,
  viewMode,
  size = 'default',
  showLabel,
  disabled,
  className,
  onComplete,
}: ClimbActionProps): ClimbActionResult {
  const { showMessage } = useSnackbar();
  const { iconSize } = computeActionDisplay(viewMode, size, showLabel);

  const viewUrl = getContextAwareClimbViewUrl(
    currentPathname ?? '',
    boardDetails,
    angle,
    climb.uuid,
    climb.name,
  );

  const handleClick = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${viewUrl}`
      : viewUrl;

    const shared = await shareWithFallback({
      url: shareUrl,
      title: climb.name,
      text: `Check out "${climb.name}" (${climb.difficulty}) on Boardsesh`,
      trackingEvent: 'Climb Shared',
      trackingProps: { boardName: boardDetails.board_name, climbUuid: climb.uuid },
      onClipboardSuccess: () => showMessage('Link copied to clipboard!', 'success'),
      onError: () => showMessage('Failed to share', 'error'),
    });
    if (shared) {
      onComplete?.();
    }
  }, [climb, viewUrl, boardDetails.board_name, onComplete, showMessage]);

  const icon = <ShareOutlined sx={{ fontSize: iconSize }} />;

  return buildActionResult({
    key: 'share',
    label: 'Share',
    icon,
    onClick: handleClick,
    viewMode,
    size,
    showLabel,
    disabled,
    className,
  });
}

export default ShareAction;

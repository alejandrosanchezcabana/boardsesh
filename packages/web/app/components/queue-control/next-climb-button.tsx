'use client';

import React from 'react';
import Link from 'next/link';
import { useQueueContext } from '../graphql-queue';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { parseBoardRouteParams, constructPlayUrlWithSlugs, getContextAwareClimbViewUrl, isNumericId } from '@/app/lib/url-utils';
import { BoardRouteParametersWithUuid, BoardDetails, BoardRouteIdentity } from '@/app/lib/types';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import FastForwardOutlined from '@mui/icons-material/FastForwardOutlined';
import { track } from '@vercel/analytics';
import IconButton from '@mui/material/IconButton';
import type { IconButtonProps } from '@mui/material/IconButton';

type NextClimbButtonProps = {
  navigate: boolean;
  boardDetails?: BoardDetails;
};

const NextButton = (props: IconButtonProps) => (
  <IconButton {...props} aria-label="Next climb"><FastForwardOutlined /></IconButton>
);

export default function NextClimbButton({ navigate = false, boardDetails }: NextClimbButtonProps) {
  const { setCurrentClimbQueueItem, getNextClimbQueueItem, viewOnlyMode } = useQueueContext();
  const rawParams = useParams<BoardRouteParametersWithUuid>();
  const { board_name, layout_id, size_id, set_ids, angle } =
    parseBoardRouteParams(rawParams);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPlayPage = pathname.includes('/play/');

  const nextClimb = getNextClimbQueueItem();

  // Prefer the passed boardDetails; only resolve from static data if params are numeric (not slugs)
  let resolvedDetails: BoardRouteIdentity;
  if (boardDetails) {
    resolvedDetails = boardDetails;
  } else if (isNumericId(rawParams.layout_id)) {
    try {
      resolvedDetails = getBoardDetailsForBoard({ board_name, layout_id, size_id, set_ids });
    } catch (error) {
      console.warn('[NextClimbButton] Failed to resolve board details from static data:', error);
      resolvedDetails = { board_name, layout_id, size_id, set_ids };
    }
  } else {
    resolvedDetails = { board_name, layout_id, size_id, set_ids };
  }

  const buildClimbUrl = () => {
    if (!nextClimb) return '';
    let climbUrl = '';

    if (isPlayPage) {
      if (resolvedDetails.layout_name && resolvedDetails.size_name && resolvedDetails.set_names) {
        climbUrl = constructPlayUrlWithSlugs(
          resolvedDetails.board_name,
          resolvedDetails.layout_name,
          resolvedDetails.size_name,
          resolvedDetails.size_description,
          resolvedDetails.set_names,
          angle,
          nextClimb.climb.uuid,
          nextClimb.climb.name,
        );
      } else {
        climbUrl = `/${rawParams.board_name}/${rawParams.layout_id}/${rawParams.size_id}/${rawParams.set_ids}/${rawParams.angle}/play/${nextClimb.climb.uuid}`;
      }

      const queryString = searchParams.toString();
      if (queryString) {
        climbUrl = `${climbUrl}?${queryString}`;
      }
    } else {
      climbUrl = getContextAwareClimbViewUrl(
        pathname,
        resolvedDetails,
        angle,
        nextClimb.climb.uuid,
        nextClimb.climb.name,
      );
    }

    return climbUrl;
  };

  const handleClick = () => {
    if (!nextClimb) return;
    setCurrentClimbQueueItem(nextClimb);
    track('Queue Navigation', {
      direction: 'next',
      boardLayout: boardDetails?.layout_name || '',
    });

    if (navigate && isPlayPage) {
      const url = buildClimbUrl();
      if (url) window.history.pushState(null, '', url);
    }
  };

  if (!viewOnlyMode && navigate && nextClimb) {
    if (isPlayPage) {
      return <NextButton onClick={handleClick} />;
    }

    const climbUrl = buildClimbUrl();
    return (
      <Link href={climbUrl} prefetch={false} onClick={handleClick}>
        <NextButton />
      </Link>
    );
  }
  return <NextButton onClick={handleClick} disabled={!nextClimb || viewOnlyMode} />;
}

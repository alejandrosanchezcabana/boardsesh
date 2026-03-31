'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { BoardDetails, BoardName } from '@/app/lib/types';
import BoardRenderer from '@/app/components/board-renderer/board-renderer';
import BoardImageLayers from '@/app/components/board-renderer/board-image-layers';
import { useFeatureFlag } from '@/app/components/providers/feature-flags-provider';
import { convertLitUpHoldsStringToMap } from '@/app/components/board-renderer/util';
import { getBoardDetailsForBoard } from '@/app/lib/board-utils';
import { getDefaultBoardConfig } from '@/app/lib/default-board-configs';
import { constructClimbViewUrlWithSlugs, constructClimbViewUrl } from '@/app/lib/url-utils';
import type { SetIdList } from '@/app/lib/board-data';
import styles from './ascents-feed.module.css';

interface AscentThumbnailProps {
  boardType: string;
  layoutId: number | null;
  angle: number;
  climbUuid: string;
  climbName: string;
  frames: string | null;
  isMirror: boolean;
}

const AscentThumbnail: React.FC<AscentThumbnailProps> = ({
  boardType,
  layoutId,
  angle,
  climbUuid,
  climbName,
  frames,
  isMirror,
}) => {
  const isRustRendererEnabled = useFeatureFlag('rust-svg-rendering');
  // Memoize board details to avoid recomputing on every render
  const boardDetails = useMemo<BoardDetails | null>(() => {
    if (!layoutId) return null;

    const boardName = boardType as BoardName;
    const config = getDefaultBoardConfig(boardName, layoutId);
    if (!config) return null;

    try {
      return getBoardDetailsForBoard({
        board_name: boardName,
        layout_id: layoutId,
        size_id: config.sizeId,
        set_ids: config.setIds,
      });
    } catch (error) {
      console.error('Failed to get board details for thumbnail:', error);
      return null;
    }
  }, [boardType, layoutId]);

  // Memoize lit up holds map (only needed for legacy SVG renderer)
  const litUpHoldsMap = useMemo(() => {
    if (isRustRendererEnabled) return undefined;
    if (!frames || !boardType) return undefined;
    const framesData = convertLitUpHoldsStringToMap(frames, boardType as BoardName);
    return framesData[0];
  }, [frames, boardType, isRustRendererEnabled]);

  // Reuse the already-memoized boardDetails to build the climb view URL
  const climbViewPath = useMemo(() => {
    if (!boardDetails || !layoutId) return null;

    if (boardDetails.layout_name && boardDetails.size_name && boardDetails.set_names) {
      return constructClimbViewUrlWithSlugs(
        boardDetails.board_name,
        boardDetails.layout_name,
        boardDetails.size_name,
        boardDetails.size_description,
        boardDetails.set_names,
        angle,
        climbUuid,
        climbName,
      );
    }

    const config = getDefaultBoardConfig(boardType as BoardName, layoutId);
    return constructClimbViewUrl(
      {
        board_name: boardType as BoardName,
        layout_id: layoutId,
        size_id: config?.sizeId ?? 1,
        set_ids: (config?.setIds ?? []) as SetIdList,
        angle,
      },
      climbUuid,
      climbName,
    );
  }, [boardDetails, boardType, layoutId, angle, climbUuid, climbName]);

  // If we can't render the thumbnail, don't show anything
  if (!boardDetails || !climbViewPath) {
    return null;
  }
  if (!isRustRendererEnabled && !litUpHoldsMap) {
    return null;
  }

  const thumbnailContent = isRustRendererEnabled && frames ? (
    <BoardImageLayers
      boardDetails={boardDetails}
      frames={frames}
      mirrored={isMirror}
      thumbnail
      style={{
        aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}`,
        width: '100%',
        height: '100%',
      }}
    />
  ) : (
    <BoardRenderer
      boardDetails={boardDetails}
      litUpHoldsMap={litUpHoldsMap}
      mirrored={isMirror}
      thumbnail
    />
  );

  return (
    <Link
      href={climbViewPath}
      className={styles.thumbnailLink}
      title={`View ${climbName}`}
    >
      <div className={styles.thumbnailContainer}>
        {thumbnailContent}
      </div>
    </Link>
  );
};

export default AscentThumbnail;

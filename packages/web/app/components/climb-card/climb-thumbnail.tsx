import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BoardDetails, Climb } from '@/app/lib/types';
import BoardRenderer from '@/app/components/board-renderer/board-renderer';
import BoardImageLayers from '../board-renderer/board-image-layers';
import { useFeatureFlag } from '@/app/components/providers/feature-flags-provider';
import { convertLitUpHoldsStringToMap } from '@/app/components/board-renderer/util';
import { getContextAwareClimbViewUrl } from '@/app/lib/url-utils';

type ClimbThumbnailProps = {
  currentClimb: Climb | null;
  boardDetails: BoardDetails;
  enableNavigation?: boolean;
  onNavigate?: () => void;
  maxHeight?: string;
};

const ClimbThumbnail = ({ boardDetails, currentClimb, enableNavigation = false, onNavigate, maxHeight }: ClimbThumbnailProps) => {
  const pathname = usePathname();
  const isRustRendererEnabled = useFeatureFlag('rust-svg-rendering');
  const litUpHoldsMap = useMemo(
    () => currentClimb && !isRustRendererEnabled ? convertLitUpHoldsStringToMap(currentClimb.frames, boardDetails.board_name)[0] : undefined,
    [currentClimb?.frames, boardDetails.board_name, isRustRendererEnabled],
  );

  const renderContent = isRustRendererEnabled && currentClimb ? (
    <BoardImageLayers
      boardDetails={boardDetails}
      frames={currentClimb.frames}
      mirrored={!!currentClimb.mirrored}
      thumbnail
      style={{
        aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}`,
        maxHeight: maxHeight ?? '10vh',
      }}
    />
  ) : currentClimb ? (
    <BoardRenderer boardDetails={boardDetails} litUpHoldsMap={litUpHoldsMap} mirrored={!!currentClimb.mirrored} />
  ) : null;

  if (enableNavigation && currentClimb) {
    const climbViewUrl = getContextAwareClimbViewUrl(
      pathname,
      boardDetails,
      currentClimb.angle,
      currentClimb.uuid,
      currentClimb.name,
    );

    return (
      <div>
        <Link href={climbViewUrl} prefetch={false} onClick={() => onNavigate?.()} data-testid="climb-thumbnail-link">
          {renderContent}
        </Link>
      </div>
    );
  }

  return <div>{renderContent}</div>;
};

export default ClimbThumbnail;

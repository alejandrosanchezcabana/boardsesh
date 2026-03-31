import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BoardDetails, Climb } from '@/app/lib/types';
import BoardImageLayers from '../board-renderer/board-image-layers';
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

  const renderContent = currentClimb ? (
    <BoardImageLayers
      boardDetails={boardDetails}
      frames={currentClimb.frames}
      mirrored={!!currentClimb.mirrored}
      thumbnail
      style={{
        aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}`,
        maxHeight: maxHeight ?? '10vh',
        width: 'auto',
        height: '100%',
      }}
    />
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

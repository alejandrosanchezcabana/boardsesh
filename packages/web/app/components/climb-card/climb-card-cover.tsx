'use client';
import React, { useMemo } from 'react';
import type { Climb, BoardDetails } from '@/app/lib/types';
import BoardRenderer from '@/app/components/board-renderer/board-renderer';
import BoardImageLayers from '@/app/components/board-renderer/board-image-layers';
import { useDoubleTap } from '@/app/lib/hooks/use-double-tap';
import { useRustRenderer } from '@/app/components/board-renderer/board-renderer-context';
import { convertLitUpHoldsStringToMap } from '@/app/components/board-renderer/util';

type ClimbCardCoverProps = {
  climb?: Climb;
  boardDetails: BoardDetails;
  onClick?: () => void;
  onDoubleClick?: () => void;
};

const ClimbCardCover = ({ climb, boardDetails, onClick, onDoubleClick }: ClimbCardCoverProps) => {
  const { ref, onDoubleClick: handleDoubleClick } = useDoubleTap(onDoubleClick);
  const isRustRendererEnabled = useRustRenderer();
  const litUpHoldsMap = useMemo(
    () => climb && !isRustRendererEnabled ? convertLitUpHoldsStringToMap(climb.frames, boardDetails.board_name)[0] : undefined,
    [climb?.frames, boardDetails.board_name, isRustRendererEnabled],
  );

  const renderContent = isRustRendererEnabled && climb ? (
    <BoardImageLayers
      boardDetails={boardDetails}
      frames={climb.frames}
      mirrored={!!climb.mirrored}
      style={{
        aspectRatio: `${boardDetails.boardWidth} / ${boardDetails.boardHeight}`,
        width: '100%',
      }}
    />
  ) : (
    <BoardRenderer boardDetails={boardDetails} litUpHoldsMap={litUpHoldsMap} mirrored={!!climb?.mirrored} />
  );

  return (
    <div
      ref={ref}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%',
        height: 'auto',
        position: 'relative',
        cursor: onClick || onDoubleClick ? 'pointer' : 'default',
      }}
    >
      {renderContent}
    </div>
  );
};

export default ClimbCardCover;

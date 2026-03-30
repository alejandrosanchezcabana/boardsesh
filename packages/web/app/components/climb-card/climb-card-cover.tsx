'use client';
import React, { useMemo } from 'react';
import { Climb, BoardDetails } from '@/app/lib/types';
import BoardRenderer from '@/app/components/board-renderer/board-renderer';
import { useDoubleTap } from '@/app/lib/hooks/use-double-tap';
import { convertLitUpHoldsStringToMap } from '@/app/components/board-renderer/util';

type ClimbCardCoverProps = {
  climb?: Climb;
  boardDetails: BoardDetails;
  onClick?: () => void;
  onDoubleClick?: () => void;
};

const ClimbCardCover = ({ climb, boardDetails, onClick, onDoubleClick }: ClimbCardCoverProps) => {
  const { ref, onDoubleClick: handleDoubleClick } = useDoubleTap(onDoubleClick);
  const litUpHoldsMap = useMemo(
    () => climb ? convertLitUpHoldsStringToMap(climb.frames, boardDetails.board_name)[0] : undefined,
    [climb?.frames, boardDetails.board_name],
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
      <BoardRenderer boardDetails={boardDetails} litUpHoldsMap={litUpHoldsMap} mirrored={!!climb?.mirrored} />
    </div>
  );
};

export default ClimbCardCover;

'use client';

import React, { useMemo } from 'react';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import { BoardDetails, BoardName } from '@/app/lib/types';
import { getBoardDetails } from '@/app/lib/__generated__/product-sizes-data';
import { getMoonBoardDetails } from '@/app/lib/moonboard-config';
import BoardRenderer from '../board-renderer/board-renderer';
import type { BoardConfigData } from '@/app/lib/server-board-configs';
import type { StoredBoardConfig } from '@/app/lib/saved-boards-db';
import type { UserBoard, PopularBoardConfig } from '@boardsesh/shared-schema';
import styles from './board-scroll.module.css';

interface BoardThumbnailProps {
  userBoard?: UserBoard;
  storedConfig?: StoredBoardConfig;
  popularConfig?: PopularBoardConfig;
  boardConfigs?: BoardConfigData;
  size?: number;
}

export function useBoardDetails(
  userBoard?: UserBoard,
  storedConfig?: StoredBoardConfig,
  popularConfig?: PopularBoardConfig,
): BoardDetails | null {
  return useMemo(() => {
    try {
      if (userBoard) {
        const setIds = userBoard.setIds.split(',').map(Number);
        const boardName = userBoard.boardType as BoardName;
        if (boardName === 'moonboard') {
          return getMoonBoardDetails({ layout_id: userBoard.layoutId, set_ids: setIds }) as BoardDetails;
        }
        return getBoardDetails({ board_name: boardName, layout_id: userBoard.layoutId, size_id: userBoard.sizeId, set_ids: setIds });
      }
      if (storedConfig) {
        if (storedConfig.board === 'moonboard') {
          return getMoonBoardDetails({ layout_id: storedConfig.layoutId, set_ids: storedConfig.setIds }) as BoardDetails;
        }
        return getBoardDetails({ board_name: storedConfig.board, layout_id: storedConfig.layoutId, size_id: storedConfig.sizeId, set_ids: storedConfig.setIds });
      }
      if (popularConfig) {
        const boardName = popularConfig.boardType as BoardName;
        if (boardName === 'moonboard') {
          return getMoonBoardDetails({ layout_id: popularConfig.layoutId, set_ids: popularConfig.setIds }) as BoardDetails;
        }
        return getBoardDetails({ board_name: boardName, layout_id: popularConfig.layoutId, size_id: popularConfig.sizeId, set_ids: popularConfig.setIds });
      }
    } catch {
      // Fall back to null if board details unavailable
    }
    return null;
  }, [userBoard, storedConfig, popularConfig]);
}

export default function BoardThumbnail({ userBoard, storedConfig, popularConfig, size }: BoardThumbnailProps) {
  const boardDetails = useBoardDetails(userBoard, storedConfig, popularConfig);

  return (
    <div
      className={styles.boardThumbnailInline}
      style={size ? { width: size, height: size } : undefined}
    >
      {boardDetails ? (
        <BoardRenderer
          mirrored={false}
          boardDetails={boardDetails}
          thumbnail
          fillHeight
        />
      ) : (
        <div className={styles.cardFallback}>
          <DashboardOutlined sx={{ fontSize: size ? size * 0.5 : 24 }} />
        </div>
      )}
    </div>
  );
}

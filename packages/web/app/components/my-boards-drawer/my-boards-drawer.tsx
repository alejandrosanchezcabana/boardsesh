'use client';

import React, { useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import EditBoardForm from '../board-entity/edit-board-form';
import { useMyBoards } from '@/app/hooks/use-my-boards';
import type { UserBoard } from '@boardsesh/shared-schema';
import styles from './my-boards-drawer.module.css';

interface MyBoardsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function MyBoardsDrawer({ open, onClose }: MyBoardsDrawerProps) {
  const { boards, isLoading } = useMyBoards(open);
  const [editingBoard, setEditingBoard] = useState<UserBoard | null>(null);

  const handleEditSuccess = useCallback(
    (updatedBoard: UserBoard) => {
      setEditingBoard(null);
      // The useMyBoards hook will refetch when the drawer is still open
      // Force a close/reopen cycle isn't needed because boards state updates
      void updatedBoard;
    },
    [],
  );

  const handleEditCancel = useCallback(() => {
    setEditingBoard(null);
  }, []);

  const formatBoardMeta = (board: UserBoard) => {
    const parts: string[] = [];
    parts.push(board.boardType.charAt(0).toUpperCase() + board.boardType.slice(1));
    if (board.locationName) parts.push(board.locationName);
    if (board.angle != null) parts.push(`${board.angle}\u00B0`);
    return parts.join(' \u00B7 ');
  };

  return (
    <>
      <SwipeableDrawer
        title="My Boards"
        placement="bottom"
        open={open}
        onClose={onClose}
        height="85dvh"
      >
        {isLoading && boards.length === 0 ? (
          <div className={styles.loadingState} data-testid="my-boards-loading">
            <CircularProgress size={32} />
          </div>
        ) : boards.length === 0 ? (
          <div className={styles.emptyState} data-testid="my-boards-empty">
            <DashboardOutlined sx={{ fontSize: 48, color: 'var(--neutral-300)' }} />
            <Typography variant="body2" color="text.secondary">
              No boards yet. Create one from the board selector to get started.
            </Typography>
          </div>
        ) : (
          <div className={styles.boardList} data-testid="my-boards-list">
            {boards.map((board) => (
              <button
                type="button"
                key={board.uuid}
                className={styles.boardItem}
                onClick={() => setEditingBoard(board)}
                data-testid={`board-item-${board.uuid}`}
              >
                <div className={styles.boardItemIcon}>
                  <DashboardOutlined />
                </div>
                <div className={styles.boardItemInfo}>
                  <div className={styles.boardItemName}>{board.name}</div>
                  <div className={styles.boardItemMeta}>
                    {formatBoardMeta(board)}
                  </div>
                </div>
                <ChevronRightOutlined className={styles.boardItemAction} />
              </button>
            ))}
          </div>
        )}
      </SwipeableDrawer>

      <SwipeableDrawer
        title="Edit Board"
        placement="bottom"
        open={editingBoard !== null}
        onClose={handleEditCancel}
        height="85dvh"
      >
        {editingBoard && (
          <div className={styles.editFormContainer}>
            <EditBoardForm
              board={editingBoard}
              onSuccess={handleEditSuccess}
              onCancel={handleEditCancel}
            />
          </div>
        )}
      </SwipeableDrawer>
    </>
  );
}

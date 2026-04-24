'use client';

import React, { useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import { BoardDetailContent } from '../board-entity/board-detail';
import BoardSearchResults from '../social/board-search-results';
import { useMyBoards } from '@/app/hooks/use-my-boards';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import type { UserBoard } from '@boardsesh/shared-schema';
import styles from './my-boards-drawer.module.css';

type DrawerView =
  | { type: 'list' }
  | { type: 'search' }
  | { type: 'board-detail'; boardUuid: string; from: 'list' | 'search'; isFollowedByMe?: boolean };

type MyBoardsDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreateBoard?: () => void;
  onTransitionEnd?: (open: boolean) => void;
};

export default function MyBoardsDrawer({ open, onClose, onCreateBoard, onTransitionEnd }: MyBoardsDrawerProps) {
  const { boards, isLoading, error } = useMyBoards(open);
  const { token } = useWsAuthToken();
  const [view, setView] = useState<DrawerView>({ type: 'list' });
  const [searchQuery, setSearchQuery] = useState('');

  const handleBack = useCallback(() => {
    if (view.type === 'board-detail') {
      setView(view.from === 'search' ? { type: 'search' } : { type: 'list' });
    } else if (view.type === 'search') {
      setView({ type: 'list' });
      setSearchQuery('');
    }
  }, [view]);

  const handleClose = useCallback(() => {
    onClose();
    setView({ type: 'list' });
    setSearchQuery('');
  }, [onClose]);

  const handleBoardClick = useCallback((board: UserBoard) => {
    setView({
      type: 'board-detail',
      boardUuid: board.uuid,
      from: 'list',
      isFollowedByMe: board.isFollowedByMe,
    });
  }, []);

  const handleSearchBoardSelect = useCallback((board: UserBoard) => {
    setView({
      type: 'board-detail',
      boardUuid: board.uuid,
      from: 'search',
      isFollowedByMe: board.isFollowedByMe,
    });
  }, []);

  const handleBoardDeleted = useCallback(() => {
    setView({ type: 'list' });
  }, []);

  const formatBoardMeta = (board: UserBoard) => {
    const parts: string[] = [];
    parts.push(board.boardType.charAt(0).toUpperCase() + board.boardType.slice(1));
    if (board.locationName) parts.push(board.locationName);
    if (board.angle != null) parts.push(`${board.angle}\u00B0`);
    return parts.join(' \u00B7 ');
  };

  const drawerTitle =
    view.type === 'list' ? (
      'My Boards'
    ) : (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton size="small" onClick={handleBack} edge="start" aria-label="Back">
          <ArrowBackOutlined fontSize="small" />
        </IconButton>
        {view.type === 'search' ? 'Find a Board' : 'Board'}
      </Box>
    );

  const headerExtra =
    view.type === 'list' ? (
      <>
        <IconButton size="small" onClick={() => setView({ type: 'search' })} aria-label="Find a board">
          <SearchOutlined fontSize="small" />
        </IconButton>
        {onCreateBoard && (
          <IconButton size="small" onClick={onCreateBoard} aria-label="Create a board">
            <AddOutlined fontSize="small" />
          </IconButton>
        )}
      </>
    ) : null;

  return (
    <SwipeableDrawer
      title={drawerTitle}
      placement="bottom"
      open={open}
      onClose={handleClose}
      onTransitionEnd={onTransitionEnd}
      height="100%"
      fullHeight
      extra={headerExtra}
      styles={{ body: { padding: 0 } }}
    >
      {view.type === 'list' &&
        (error && boards.length === 0 ? (
          <div className={styles.emptyState} data-testid="my-boards-error">
            <Alert severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          </div>
        ) : isLoading && boards.length === 0 ? (
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
                onClick={() => handleBoardClick(board)}
                data-testid={`board-item-${board.uuid}`}
              >
                <div className={styles.boardItemIcon}>
                  <DashboardOutlined />
                </div>
                <div className={styles.boardItemInfo}>
                  <div className={styles.boardItemName}>{board.name}</div>
                  <div className={styles.boardItemMeta}>{formatBoardMeta(board)}</div>
                </div>
                <ChevronRightOutlined className={styles.boardItemAction} />
              </button>
            ))}
          </div>
        ))}

      {view.type === 'search' && (
        <>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Search by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ px: 2, pt: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <BoardSearchResults
            query={searchQuery}
            authToken={token}
            showFollowButton
            onBoardSelect={handleSearchBoardSelect}
          />
        </>
      )}

      {view.type === 'board-detail' && (
        <BoardDetailContent
          boardUuid={view.boardUuid}
          initialIsFollowing={view.isFollowedByMe}
          onDeleted={handleBoardDeleted}
        />
      )}
    </SwipeableDrawer>
  );
}

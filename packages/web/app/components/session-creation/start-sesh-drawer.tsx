'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import SessionCreationForm from './session-creation-form';
import type { SessionCreationFormData } from './session-creation-form';
import BoardSelectorDrawer from '@/app/components/board-selector-drawer/board-selector-drawer';
import BoardScrollSection from '@/app/components/board-scroll/board-scroll-section';
import BoardScrollCard from '@/app/components/board-scroll/board-scroll-card';
import CreateBoardCard from '@/app/components/board-scroll/create-board-card';
import { useCreateSession } from '@/app/hooks/use-create-session';
import { useSnackbar } from '@/app/components/providers/snackbar-provider';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { constructBoardSlugListUrl, getBaseBoardPath } from '@/app/lib/url-utils';
import { useAuthModal } from '@/app/components/providers/auth-modal-provider';
import { setClimbSessionCookie } from '@/app/lib/climb-session-cookie';
import { usePersistentSession } from '@/app/components/persistent-session/persistent-session-context';
import { useMyBoards } from '@/app/hooks/use-my-boards';
import { BoardConfigData } from '@/app/lib/server-board-configs';
import type { StoredBoardConfig } from '@/app/lib/saved-boards-db';

interface StartSeshDrawerProps {
  open: boolean;
  onClose: () => void;
  boardConfigs?: BoardConfigData;
}

export default function StartSeshDrawer({ open, onClose, boardConfigs }: StartSeshDrawerProps) {
  const { status } = useSession();
  const router = useRouter();
  const { showMessage } = useSnackbar();
  const { createSession, isCreating } = useCreateSession();
  const {
    activateSession,
    setInitialQueueForSession,
    localQueue,
    localCurrentClimbQueueItem,
    localBoardPath,
    localBoardDetails,
  } = usePersistentSession();
  const { boards, isLoading: isLoadingBoards, error: boardsError } = useMyBoards(open);

  const [selectedBoard, setSelectedBoard] = useState<(typeof boards)[number] | null>(null);
  const [selectedCustomPath, setSelectedCustomPath] = useState<string | null>(null);
  const [selectedCustomConfig, setSelectedCustomConfig] = useState<StoredBoardConfig | null>(null);
  const { openAuthModal } = useAuthModal();
  const [showBoardDrawer, setShowBoardDrawer] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [boardSelectorExpanded, setBoardSelectorExpanded] = useState(false);
  const hasAutoSelectedRef = useRef(false);

  // Reset auto-selection tracking when drawer closes
  useEffect(() => {
    if (!open) {
      hasAutoSelectedRef.current = false;
    }
  }, [open]);

  // Auto-select the current board when the drawer opens
  useEffect(() => {
    if (!open || boards.length === 0 || hasAutoSelectedRef.current) return;

    let match: (typeof boards)[number] | undefined;

    // Strategy 1: Match by slug from /b/{slug} routes
    if (localBoardPath) {
      const basePath = getBaseBoardPath(localBoardPath);
      match = boards.find((b) => `/b/${b.slug}` === basePath);
    }

    // Strategy 2: Match by numeric board identity from localBoardDetails
    // Handles generic routes like /kilter/original/16x12/screw_bolt/40/list
    if (!match && localBoardDetails) {
      const sortedLocalSetIds = [...localBoardDetails.set_ids].sort((a, b) => a - b).join(',');
      match = boards.find(
        (b) =>
          b.boardType === localBoardDetails.board_name &&
          b.layoutId === localBoardDetails.layout_id &&
          b.sizeId === localBoardDetails.size_id &&
          b.setIds.split(',').map(Number).sort((a, b) => a - b).join(',') === sortedLocalSetIds,
      );
    }

    hasAutoSelectedRef.current = true;
    if (match) {
      setSelectedBoard(match);
    }
  }, [open, boards, localBoardPath, localBoardDetails]);

  const isLoggedIn = status === 'authenticated';

  const handleClose = useCallback(() => {
    onClose();
    setSelectedBoard(null);
    setSelectedCustomPath(null);
    setSelectedCustomConfig(null);
    setBoardSelectorExpanded(false);
    setFormKey((k) => k + 1);
  }, [onClose]);

  const handleBoardSelect = (board: (typeof boards)[number]) => {
    setSelectedBoard(board);
    setSelectedCustomPath(null);
    setSelectedCustomConfig(null);
    setBoardSelectorExpanded(false);
  };

  const handleCustomSelect = (url: string, config?: StoredBoardConfig) => {
    setSelectedCustomPath(url);
    setSelectedCustomConfig(config ?? null);
    setSelectedBoard(null);
    setShowBoardDrawer(false);
    setBoardSelectorExpanded(false);
  };

  const handleSubmit = async (formData: SessionCreationFormData) => {
    if (!selectedBoard && !selectedCustomPath) {
      showMessage('Please select a board first', 'warning');
      return;
    }

    try {
      let boardPath: string;
      let navigateUrl: string;

      if (selectedBoard) {
        boardPath = `/b/${selectedBoard.slug}`;
        navigateUrl = constructBoardSlugListUrl(selectedBoard.slug, selectedBoard.angle);
      } else if (selectedCustomPath) {
        boardPath = selectedCustomPath;
        navigateUrl = selectedCustomPath;
      } else {
        return;
      }

      const sessionId = await createSession(formData, boardPath);

      // Transfer existing local queue to the new session when the board matches.
      // Without this, the WebSocket join sends no initial queue and the server
      // returns an empty FullSync that wipes the user's queue.
      if (
        localBoardPath &&
        (localQueue.length > 0 || localCurrentClimbQueueItem) &&
        getBaseBoardPath(localBoardPath) === getBaseBoardPath(boardPath)
      ) {
        setInitialQueueForSession(sessionId, localQueue, localCurrentClimbQueueItem, formData.name);
      }

      setClimbSessionCookie(sessionId);

      // When already on the target board route, router.push to the same URL
      // won't trigger a re-render, so BoardSessionBridge never picks up the
      // new cookie. Activate the session directly to avoid this.
      if (
        localBoardPath &&
        localBoardDetails &&
        getBaseBoardPath(localBoardPath) === getBaseBoardPath(boardPath)
      ) {
        const angle = selectedBoard?.angle ?? selectedCustomConfig?.angle ?? 0;
        activateSession({
          sessionId,
          sessionName: formData.name,
          boardPath: localBoardPath,
          boardDetails: localBoardDetails,
          parsedParams: {
            board_name: localBoardDetails.board_name,
            layout_id: localBoardDetails.layout_id,
            size_id: localBoardDetails.size_id,
            set_ids: localBoardDetails.set_ids,
            angle,
          },
        });
      }

      router.push(navigateUrl);

      handleClose();
      showMessage('Session started!', 'success');
    } catch (error) {
      console.error('Failed to create session:', error);
      showMessage('Failed to start session', 'error');
      throw error;
    }
  };

  const hasSelection = selectedBoard || selectedCustomConfig;
  const selectedName = selectedBoard?.name ?? selectedCustomConfig?.name;

  const boardSelector = (
    <Box>
      {hasSelection && !boardSelectorExpanded ? (
        <ButtonBase
          onClick={() => setBoardSelectorExpanded(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            px: 2,
            py: 1.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            textAlign: 'left',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DashboardOutlined sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body2" fontWeight={600}>
              {selectedName}
            </Typography>
          </Box>
          <Typography variant="body2" color="primary" fontWeight={500}>
            Change
          </Typography>
        </ButtonBase>
      ) : (
        <BoardScrollSection title="Select a board" loading={isLoadingBoards}>
          <CreateBoardCard
            onClick={() => setShowBoardDrawer(true)}
            label="Custom"
          />
          {selectedCustomConfig && (
            <BoardScrollCard
              key={`custom-${selectedCustomConfig.name}`}
              storedConfig={selectedCustomConfig}
              boardConfigs={boardConfigs}
              selected
              onClick={() => setShowBoardDrawer(true)}
            />
          )}
          {boards.map((board) => (
            <BoardScrollCard
              key={board.uuid}
              userBoard={board}
              selected={selectedBoard?.uuid === board.uuid}
              onClick={() => handleBoardSelect(board)}
            />
          ))}
        </BoardScrollSection>
      )}
      {boardsError && (
        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
          {boardsError}
        </Typography>
      )}
    </Box>
  );

  return (
    <>
      <SwipeableDrawer
        title="Sesh"
        placement="top"
        open={open}
        onClose={handleClose}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" component="span">
            {isLoggedIn
              ? 'Track your climbs and invite others to join.'
              : 'Jump in without an account. Sign in later to save your progress.'}
          </Typography>
          <SessionCreationForm
            key={formKey}
            onSubmit={handleSubmit}
            isSubmitting={isCreating}
            submitLabel="Sesh"
            headerContent={boardSelector}
            isAnonymous={!isLoggedIn}
          />
          {!isLoggedIn && (
            <Button
              variant="text"
              size="small"
              startIcon={<LoginOutlined />}
              onClick={() => openAuthModal({ title: 'Sign in to save your session', description: "Your sends won't disappear when you close the tab." })}
              sx={{ alignSelf: 'center' }}
            >
              Sign in for more features
            </Button>
          )}
        </Box>
      </SwipeableDrawer>

      {boardConfigs && (
        <BoardSelectorDrawer
          open={showBoardDrawer}
          onClose={() => setShowBoardDrawer(false)}
          boardConfigs={boardConfigs}
          placement="top"
          onBoardSelected={handleCustomSelect}
        />
      )}

    </>
  );
}

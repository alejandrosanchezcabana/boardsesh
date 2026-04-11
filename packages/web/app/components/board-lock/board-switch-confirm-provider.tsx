'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import type { BoardDetails, BoardRouteIdentity } from '@/app/lib/types';
import type { BoardLockReason } from './use-active-board-lock';

interface ConfirmArgs {
  reason: BoardLockReason;
  lockedBoard: BoardDetails;
  target: BoardRouteIdentity | BoardDetails;
  onConfirmed: () => void;
}

interface BoardSwitchConfirmContextValue {
  confirmBoardSwitch: (args: ConfirmArgs) => void;
}

const BoardSwitchConfirmContext = createContext<BoardSwitchConfirmContextValue | null>(null);

export function useBoardSwitchConfirm(): BoardSwitchConfirmContextValue {
  const ctx = useContext(BoardSwitchConfirmContext);
  if (!ctx) {
    throw new Error('useBoardSwitchConfirm must be used within BoardSwitchConfirmProvider');
  }
  return ctx;
}

function formatBoardLabel(board: BoardDetails | BoardRouteIdentity): string {
  const name = board.board_name.charAt(0).toUpperCase() + board.board_name.slice(1);
  const parts = [name];
  if (board.layout_name) parts.push(board.layout_name);
  if (board.size_name) parts.push(board.size_name);
  return parts.join(' · ');
}

interface DialogState {
  open: boolean;
  reason: BoardLockReason;
  lockedLabel: string;
  targetLabel: string;
  onConfirmed: () => void;
}

export function BoardSwitchConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirmBoardSwitch = useCallback((args: ConfirmArgs) => {
    setState({
      open: true,
      reason: args.reason,
      lockedLabel: formatBoardLabel(args.lockedBoard),
      targetLabel: formatBoardLabel(args.target),
      onConfirmed: args.onConfirmed,
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => (prev ? { ...prev, open: false } : prev));
  }, []);

  const handleConfirm = useCallback(() => {
    const onConfirmed = state?.onConfirmed;
    setState((prev) => (prev ? { ...prev, open: false } : prev));
    onConfirmed?.();
  }, [state]);

  const handleExited = useCallback(() => {
    setState(null);
  }, []);

  const value = useMemo<BoardSwitchConfirmContextValue>(
    () => ({ confirmBoardSwitch }),
    [confirmBoardSwitch],
  );

  const title =
    state?.reason === 'session' ? 'Leave your session?' : 'Disconnect your board?';
  const body =
    state?.reason === 'session'
      ? `You're in a session on ${state?.lockedLabel}. Switching to ${state?.targetLabel} disconnects your board but keeps the session running.`
      : `Your ${state?.lockedLabel} is still connected. Switching to ${state?.targetLabel} disconnects it.`;

  return (
    <BoardSwitchConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={state?.open ?? false}
        onClose={handleCancel}
        TransitionProps={{ onExited: handleExited }}
        maxWidth="xs"
        fullWidth
        aria-labelledby="board-switch-confirm-title"
      >
        <DialogTitle id="board-switch-confirm-title">{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{body}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Stay</Button>
          <Button variant="contained" onClick={handleConfirm} autoFocus>
            Switch boards
          </Button>
        </DialogActions>
      </Dialog>
    </BoardSwitchConfirmContext.Provider>
  );
}

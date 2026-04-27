'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { BoardDetails } from '@/app/lib/types';
import { getBoardDetails } from '@/app/lib/board-constants';
import { parseSetIds, type ResolvedBoardConfig } from '@/app/lib/ble/board-config-match';

type BoardConfigMismatchDialogProps = {
  open: boolean;
  currentBoardDetails: BoardDetails;
  recordedConfig: ResolvedBoardConfig;
  onSwitch: () => void;
  onConnectAnyway: () => void;
  onCancel: () => void;
};

function describeBoardConfig(boardName: string, layoutId: number, sizeId: number, setIds: string | number[]): string {
  try {
    const details = getBoardDetails({
      board_name: boardName as BoardDetails['board_name'],
      layout_id: layoutId,
      size_id: sizeId,
      set_ids: parseSetIds(setIds),
    });
    const parts = [details.layout_name, details.size_name].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(' • ') : `${boardName} ${layoutId}/${sizeId}`;
  } catch {
    return `${boardName} ${layoutId}/${sizeId}`;
  }
}

export function BoardConfigMismatchDialog({
  open,
  currentBoardDetails,
  recordedConfig,
  onSwitch,
  onConnectAnyway,
  onCancel,
}: BoardConfigMismatchDialogProps) {
  const currentLabel = describeBoardConfig(
    currentBoardDetails.board_name,
    currentBoardDetails.layout_id,
    currentBoardDetails.size_id,
    currentBoardDetails.set_ids,
  );
  const recordedLabel = describeBoardConfig(
    recordedConfig.boardName,
    recordedConfig.layoutId,
    recordedConfig.sizeId,
    recordedConfig.setIds,
  );

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Board configuration doesn&apos;t match</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          Our records show this board has a different config than you have configured.
        </DialogContentText>
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>You&apos;re configured for:</strong> {currentLabel}
          </Typography>
          <Typography variant="body2">
            <strong>Recorded for this controller:</strong> {recordedLabel}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConnectAnyway} color="warning">
          Connect anyway
        </Button>
        <Button onClick={onSwitch} variant="contained" autoFocus>
          Switch to correct config
        </Button>
      </DialogActions>
    </Dialog>
  );
}

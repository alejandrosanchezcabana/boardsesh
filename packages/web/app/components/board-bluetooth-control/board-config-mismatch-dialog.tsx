'use client';

import { Trans, useTranslation } from 'react-i18next';
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
import { themeTokens } from '@/app/theme/theme-config';

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
  const { t } = useTranslation('settings');
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
      <DialogTitle>{t('boardConfigMismatch.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{t('boardConfigMismatch.intro')}</DialogContentText>
        <Stack spacing={`${themeTokens.spacing[1]}px`} sx={{ mt: `${themeTokens.spacing[2]}px` }}>
          <Typography variant="body2">
            <Trans i18nKey="boardConfigMismatch.currentLabel" t={t} components={{ strong: <strong /> }} />{' '}
            {currentLabel}
          </Typography>
          <Typography variant="body2">
            <Trans i18nKey="boardConfigMismatch.recordedLabel" t={t} components={{ strong: <strong /> }} />{' '}
            {recordedLabel}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexWrap: 'wrap',
          gap: `${themeTokens.spacing[1]}px`,
          px: `${themeTokens.spacing[3]}px`,
          pb: `${themeTokens.spacing[2]}px`,
        }}
      >
        <Button onClick={onCancel}>{t('boardConfigMismatch.cancel')}</Button>
        <Button onClick={onConnectAnyway} color="warning">
          {t('boardConfigMismatch.connectAnyway')}
        </Button>
        <Button onClick={onSwitch} variant="contained" autoFocus>
          {t('boardConfigMismatch.switchToCorrect')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

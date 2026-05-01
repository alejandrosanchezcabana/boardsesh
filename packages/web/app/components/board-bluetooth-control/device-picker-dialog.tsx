'use client';

import { useMemo } from 'react';
import BluetoothSearching from '@mui/icons-material/BluetoothSearching';
import HelpOutline from '@mui/icons-material/HelpOutline';
import SignalCellularAlt from '@mui/icons-material/SignalCellularAlt';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { DiscoveredDevice } from '@/app/lib/ble/types';
import { AURORA_BOARDS, type AuroraBoardName } from '@boardsesh/shared-schema';
import { parseSerialNumber, parseBoardTypeFromDeviceName } from './bluetooth-aurora';
import BoardRenderer from '../board-renderer/board-renderer';
import { getBoardDetails, FALLBACK_BOARD_PREVIEW_CONFIGS } from '@/app/lib/board-constants';
import BoardThumbnail from '../board-scroll/board-thumbnail';
import { configFromResolvedEntry, parseSetIds, type ResolvedBoardConfig } from '@/app/lib/ble/board-config-match';
import type { ResolvedBoardEntry } from '@/app/lib/ble/resolve-serials';
import { formatRelativeTime } from '@/app/lib/session-history-db';
import styles from './device-picker-dialog.module.css';

type DevicePickerDialogProps = {
  devices: DiscoveredDevice[];
  onSelect: (deviceId: string) => void;
  onCancel: () => void;
  resolvedBoards?: Map<string, ResolvedBoardEntry>;
};

function signalLabel(rssi: number): string {
  if (rssi >= -50) return 'Strong';
  if (rssi >= -70) return 'Good';
  if (rssi >= -85) return 'Weak';
  return 'Very weak';
}

function asAuroraBoardName(value: string): AuroraBoardName | undefined {
  return (AURORA_BOARDS as readonly string[]).includes(value) ? (value as AuroraBoardName) : undefined;
}

function UnknownBoardPreview({ boardType }: { boardType?: AuroraBoardName }) {
  const boardDetails = useMemo(() => {
    const type = boardType || 'kilter';
    const config = FALLBACK_BOARD_PREVIEW_CONFIGS[type] || FALLBACK_BOARD_PREVIEW_CONFIGS.kilter;
    try {
      return getBoardDetails({
        board_name: type,
        layout_id: config.layout_id,
        size_id: config.size_id,
        set_ids: config.set_ids,
      });
    } catch {
      return null;
    }
  }, [boardType]);

  return (
    <>
      <div className={styles.unknownPreview}>
        {boardDetails && <BoardRenderer mirrored={false} boardDetails={boardDetails} thumbnail fillHeight />}
      </div>
      <div className={styles.unknownPreviewOverlay}>
        <HelpOutline sx={{ fontSize: 36, color: 'var(--neutral-400)' }} />
      </div>
    </>
  );
}

function RecordedBoardPreview({ config }: { config: ResolvedBoardConfig }) {
  const inferredType = asAuroraBoardName(config.boardName);
  const boardDetails = useMemo(() => {
    if (!inferredType) return null;
    try {
      return getBoardDetails({
        board_name: inferredType,
        layout_id: config.layoutId,
        size_id: config.sizeId,
        set_ids: parseSetIds(config.setIds),
      });
    } catch {
      return null;
    }
  }, [inferredType, config.layoutId, config.sizeId, config.setIds]);

  if (!boardDetails) {
    return <UnknownBoardPreview boardType={inferredType} />;
  }
  return (
    <div className={styles.unknownPreview}>
      <BoardRenderer mirrored={false} boardDetails={boardDetails} thumbnail fillHeight />
    </div>
  );
}

function SignalBadge({ rssi }: { rssi: number }) {
  return (
    <div className={styles.signalBadge}>
      <SignalCellularAlt sx={{ fontSize: 12 }} />
      {signalLabel(rssi)}
    </div>
  );
}

export function DevicePickerDialog({ devices, onSelect, onCancel, resolvedBoards }: DevicePickerDialogProps) {
  const sorted = [...devices].sort((a, b) => b.rssi - a.rssi);

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <BluetoothSearching />
          <span>Select your board</span>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 160, px: 1 }}>
        {sorted.length === 0 ? (
          <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 4, justifyContent: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Scanning for boards nearby&hellip;
            </Typography>
          </Stack>
        ) : (
          <div className={styles.deviceScroll}>
            {sorted.map((device) => {
              const serial = parseSerialNumber(device.name);
              const entry = serial ? resolvedBoards?.get(serial) : undefined;
              const inferredType = parseBoardTypeFromDeviceName(device.name);

              let preview: React.ReactNode;
              let label: string;
              if (entry?.kind === 'saved') {
                preview = <BoardThumbnail userBoard={entry.board} />;
                label = entry.board.name;
              } else if (entry?.kind === 'recorded') {
                preview = <RecordedBoardPreview config={configFromResolvedEntry(entry)} />;
                label = device.name || 'Last connected board';
              } else {
                preview = <UnknownBoardPreview boardType={inferredType} />;
                label = device.name || 'Unknown device';
              }

              return (
                <div
                  key={device.deviceId}
                  onClick={() => onSelect(device.deviceId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(device.deviceId);
                    }
                  }}
                  className={styles.deviceCard}
                >
                  <div className={styles.deviceCardSquare}>
                    {preview}
                    <SignalBadge rssi={device.rssi} />
                  </div>
                  <div className={styles.deviceCardName}>{label}</div>
                  {entry && device.name && entry.kind === 'saved' && (
                    <div className={styles.deviceCardMeta}>{device.name}</div>
                  )}
                  {entry?.kind === 'recorded' && (
                    <div className={styles.deviceCardMeta}>
                      Last connected {formatRelativeTime(entry.config.updatedAt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

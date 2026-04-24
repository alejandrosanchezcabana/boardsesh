'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import type { BoardName } from '@boardsesh/shared-schema';
import type { BoardDetails } from '@/app/lib/types';
import { parseSerialNumber, parseBoardTypeFromDeviceName } from './bluetooth-aurora';
import BoardRenderer from '../board-renderer/board-renderer';
import { getBoardDetails, FALLBACK_BOARD_PREVIEW_CONFIGS } from '@/app/lib/board-constants';
import BoardThumbnail from '../board-scroll/board-thumbnail';
import { constructBoardSlugListUrl, constructClimbListWithSlugs } from '@/app/lib/url-utils';
import {
  configFromResolvedEntry,
  matchesBoardDetails,
  type ResolvedBoardConfig,
} from '@/app/lib/ble/board-config-match';
import type { ResolvedBoardEntry } from '@/app/lib/ble/resolve-serials';
import { BoardConfigMismatchDialog } from './board-config-mismatch-dialog';
import styles from './device-picker-dialog.module.css';

type DevicePickerDialogProps = {
  devices: DiscoveredDevice[];
  onSelect: (deviceId: string) => void;
  onCancel: () => void;
  resolvedBoards?: Map<string, ResolvedBoardEntry>;
  /** Current route's board details — used to detect connect-time config mismatches. */
  boardDetails?: BoardDetails;
  /** Current route's angle — used to build the switch-URL fallback. */
  angle?: number;
};

function signalLabel(rssi: number): string {
  if (rssi >= -50) return 'Strong';
  if (rssi >= -70) return 'Good';
  if (rssi >= -85) return 'Weak';
  return 'Very weak';
}

function UnknownBoardPreview({ boardType }: { boardType?: BoardName }) {
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

function parseSetIds(setIds: string): number[] {
  return setIds
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function RecordedBoardPreview({ config }: { config: ResolvedBoardConfig }) {
  const boardDetails = useMemo(() => {
    try {
      return getBoardDetails({
        board_name: config.boardName as BoardName,
        layout_id: config.layoutId,
        size_id: config.sizeId,
        set_ids: parseSetIds(config.setIds),
      });
    } catch {
      return null;
    }
  }, [config.boardName, config.layoutId, config.sizeId, config.setIds]);

  if (!boardDetails) {
    return <UnknownBoardPreview boardType={config.boardName as BoardName} />;
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

/**
 * Build the URL the climb-list should switch to for a recorded config.
 * Prefers /b/{slug}/{angle}/list when the recording is linked to a saved board.
 */
function buildSwitchUrl(config: ResolvedBoardConfig, currentAngle: number): string | null {
  const angle = config.angle ?? currentAngle;
  if (config.boardSlug) {
    return constructBoardSlugListUrl(config.boardSlug, angle);
  }
  try {
    const details = getBoardDetails({
      board_name: config.boardName as BoardName,
      layout_id: config.layoutId,
      size_id: config.sizeId,
      set_ids: parseSetIds(config.setIds),
    });
    if (details.layout_name && details.size_name && details.set_names) {
      return constructClimbListWithSlugs(
        details.board_name,
        details.layout_name,
        details.size_name,
        details.size_description,
        details.set_names,
        angle,
      );
    }
  } catch {
    // Fall through.
  }
  return null;
}

export function DevicePickerDialog({
  devices,
  onSelect,
  onCancel,
  resolvedBoards,
  boardDetails,
  angle,
}: DevicePickerDialogProps) {
  const router = useRouter();
  const sorted = [...devices].sort((a, b) => b.rssi - a.rssi);

  const [mismatch, setMismatch] = useState<{ deviceId: string; config: ResolvedBoardConfig } | null>(null);

  const handleSelect = (deviceId: string, entry: ResolvedBoardEntry | undefined) => {
    if (!entry || !boardDetails) {
      onSelect(deviceId);
      return;
    }
    const resolvedConfig = configFromResolvedEntry(entry);
    if (matchesBoardDetails(resolvedConfig, boardDetails)) {
      onSelect(deviceId);
      return;
    }
    setMismatch({ deviceId, config: resolvedConfig });
  };

  const handleConnectAnyway = () => {
    if (mismatch) onSelect(mismatch.deviceId);
    setMismatch(null);
  };

  const handleSwitch = () => {
    if (!mismatch || !boardDetails) {
      setMismatch(null);
      return;
    }
    const target = buildSwitchUrl(mismatch.config, angle ?? 0);
    setMismatch(null);
    onCancel(); // Close the picker; the new route will reset state.
    if (target) router.push(target);
  };

  return (
    <>
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
                    onClick={() => handleSelect(device.deviceId, entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(device.deviceId, entry);
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
                    {entry?.kind === 'recorded' && <div className={styles.deviceCardMeta}>Last connected</div>}
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
      {mismatch && boardDetails && (
        <BoardConfigMismatchDialog
          open
          currentBoardDetails={boardDetails}
          recordedConfig={mismatch.config}
          onSwitch={handleSwitch}
          onConnectAnyway={handleConnectAnyway}
          onCancel={() => setMismatch(null)}
        />
      )}
    </>
  );
}

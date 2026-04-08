import { MOONBOARD_GRID } from '@/app/lib/moonboard-config';
import { UART_SERVICE_UUID } from './bluetooth-shared';

const MOONBOARD_FRAME_PREFIX = 'l#';
const MOONBOARD_FRAME_SUFFIX = '#';
const MOONBOARD_DEVICE_NAME_PREFIXES = ['MoonBoard', 'Moonboard'] as const;

// Boardsesh persists MoonBoard frames with the shared basic role codes only.
// The newer controller firmware can render extra preview-only roles, but the
// web client does not emit them in climb frames.
const MOONBOARD_ROLE_MAP = {
  42: 'S',
  43: 'P',
  44: 'E',
} as const;

export const MOONBOARD_SCAN_SERVICE_UUIDS = [UART_SERVICE_UUID] as const;
export const MOONBOARD_OPTIONAL_SERVICE_UUIDS = [UART_SERVICE_UUID] as const;

export const MOONBOARD_REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [
    { services: [...MOONBOARD_SCAN_SERVICE_UUIDS] },
    ...MOONBOARD_DEVICE_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
  ],
  optionalServices: [...MOONBOARD_OPTIONAL_SERVICE_UUIDS],
};

export function getMoonboardSerialPosition(holdId: number): number {
  const maxHoldId = MOONBOARD_GRID.numColumns * MOONBOARD_GRID.numRows;
  if (!Number.isInteger(holdId) || holdId < 1 || holdId > maxHoldId) {
    throw new Error(`MoonBoard hold id out of range: ${holdId}`);
  }

  const zeroBasedHoldId = holdId - 1;
  const colIndex = zeroBasedHoldId % MOONBOARD_GRID.numColumns;
  const rowIndex = Math.floor(zeroBasedHoldId / MOONBOARD_GRID.numColumns);

  if (colIndex % 2 === 0) {
    return colIndex * MOONBOARD_GRID.numRows + rowIndex;
  }

  return colIndex * MOONBOARD_GRID.numRows + (MOONBOARD_GRID.numRows - 1 - rowIndex);
}

export function getMoonboardBluetoothPacket(frames: string): Uint8Array {
  const holdPayload = frames
    .split('p')
    .filter(Boolean)
    .map((frame) => {
      const [placement, role] = frame.split('r');
      const holdId = Number(placement);
      const holdType = MOONBOARD_ROLE_MAP[Number(role) as keyof typeof MOONBOARD_ROLE_MAP];

      if (!holdType) {
        throw new Error(`Unsupported MoonBoard hold state code: ${role}`);
      }

      return `${holdType}${getMoonboardSerialPosition(holdId)}`;
    })
    .join(',');

  return new TextEncoder().encode(`${MOONBOARD_FRAME_PREFIX}${holdPayload}${MOONBOARD_FRAME_SUFFIX}`);
}

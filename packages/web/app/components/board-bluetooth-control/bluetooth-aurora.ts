import { LedPlacements } from '@/app/lib/types';
import { HOLD_STATE_MAP } from '../board-renderer/types';
import {
  AURORA_ADVERTISED_SERVICE_UUID,
  MESSAGE_BODY_MAX_LENGTH,
  UART_SERVICE_UUID,
} from './bluetooth-shared';

export type AuroraBoardName = 'kilter' | 'tension';

const PACKET_MIDDLE = 81;
const PACKET_FIRST = 82;
const PACKET_LAST = 83;
const PACKET_ONLY = 84;

export const AURORA_SCAN_SERVICE_UUIDS = [AURORA_ADVERTISED_SERVICE_UUID] as const;
export const AURORA_OPTIONAL_SERVICE_UUIDS = [UART_SERVICE_UUID] as const;

export const AURORA_REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [{ services: [...AURORA_SCAN_SERVICE_UUIDS] }],
  optionalServices: [...AURORA_OPTIONAL_SERVICE_UUIDS],
};

const checksum = (data: number[]) => data.reduce((acc, value) => (acc + value) & 255, 0) ^ 255;

const wrapBytes = (data: number[]) =>
  data.length > MESSAGE_BODY_MAX_LENGTH ? [] : [1, data.length, checksum(data), 2, ...data, 3];

const encodePosition = (position: number) => [position & 255, (position >> 8) & 255];

const encodeColor = (color: string) => {
  const parsedColor = [
    Math.floor(parseInt(color.substring(0, 2), 16) / 32) << 5,
    Math.floor(parseInt(color.substring(2, 4), 16) / 32) << 2,
    Math.floor(parseInt(color.substring(4, 6), 16) / 64),
  ].reduce((acc, val) => acc | val);
  return parsedColor;
};

const encodePositionAndColor = (position: number, ledColor: string) => [
  ...encodePosition(position),
  encodeColor(ledColor),
];

export const getAuroraBluetoothPacket = (
  frames: string,
  placementPositions: LedPlacements,
  boardName: AuroraBoardName,
) => {
  const resultArray: number[][] = [];
  let tempArray = [PACKET_MIDDLE];

  let skippedCount = 0;

  frames.split('p').forEach((frame) => {
    if (!frame) return;

    const [placement, role] = frame.split('r');
    const placementId = Number(placement);
    const ledPosition = placementPositions[placementId];

    if (ledPosition === undefined) {
      skippedCount++;
      return;
    }

    const encodedFrame = encodePositionAndColor(
      ledPosition,
      HOLD_STATE_MAP[boardName][Number(role)].color.replace('#', ''),
    );

    if (tempArray.length + encodedFrame.length > MESSAGE_BODY_MAX_LENGTH) {
      resultArray.push(tempArray);
      tempArray = [PACKET_MIDDLE];
    }
    tempArray.push(...encodedFrame);
  });

  if (skippedCount > 0) {
    console.warn(`[BLE] Skipped ${skippedCount} placements with no LED mapping for this board configuration`);
  }

  resultArray.push(tempArray);
  if (resultArray.length === 1) resultArray[0][0] = PACKET_ONLY;
  else {
    resultArray[0][0] = PACKET_FIRST;
    resultArray[resultArray.length - 1][0] = PACKET_LAST;
  }

  return Uint8Array.from(resultArray.flatMap(wrapBytes));
};

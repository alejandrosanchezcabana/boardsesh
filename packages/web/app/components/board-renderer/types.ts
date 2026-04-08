import { BoardName } from '@/app/lib/types';
import { MOONBOARD_ENABLED } from '@/app/lib/moonboard-config';

export type LitUpHolds = string;

export type HoldState = 'OFF' | 'STARTING' | 'FINISH' | 'HAND' | 'FOOT' | 'ANY' | 'NOT' | 'AUX';
export type HoldsArray = Array<HoldRenderData>;

export type HoldColor = string;
export type HoldCode = number;
export type HoldRenderStyle = 'circle' | 'above-marker';
export type HoldRenderData = {
  id: number;
  mirroredHoldId: number | null;
  cx: number;
  cy: number;
  r: number;
};
export type LitupHold = { state: HoldState; color: string; displayColor: string };
export type LitUpHoldsMap = Record<HoldCode, LitupHold>;

export interface HeatmapData {
  holdId: number;
  totalUses: number;
  startingUses: number;
  totalAscents: number;
  handUses: number;
  footUses: number;
  finishUses: number;
  averageDifficulty: number | null;
  userAscents?: number; // Added for user-specific ascent data
  userAttempts?: number; // Added for user-specific attempt data
}

/** Thumbnail render width in pixels. Covers 3x retina at ~64px CSS display. */
export const THUMBNAIL_WIDTH = 200;

// If adding more boards be sure to increment the DB version number for indexeddb
export const supported_boards: BoardName[] = MOONBOARD_ENABLED
  ? ['kilter', 'tension', 'moonboard']
  : ['kilter', 'tension'];

// Mapping object for board-specific hold states
export const HOLD_STATE_MAP: Record<
  BoardName,
  Record<HoldCode, { name: HoldState; color: HoldColor; displayColor?: HoldColor; renderStyle?: HoldRenderStyle }>
> = {
  kilter: {
    42: { name: 'STARTING', color: '#00FF00' },
    43: { name: 'HAND', color: '#00FFFF' },
    44: { name: 'FINISH', color: '#FF00FF' },
    45: { name: 'FOOT', color: '#FFAA00' },
    12: { name: 'STARTING', color: '#00FF00' },
    13: { name: 'HAND', color: '#00FFFF' },
    14: { name: 'FINISH', color: '#FF00FF' },
    15: { name: 'FOOT', color: '#FFAA00' },
  },
  tension: {
    1: { name: 'STARTING', displayColor: '#00DD00', color: '#00FF00' },
    2: { name: 'HAND', displayColor: '#4444FF', color: '#0000FF' },
    3: { name: 'FINISH', displayColor: '#FF0000', color: '#FF0000' },
    4: { name: 'FOOT', displayColor: '#FF00FF', color: '#FF00FF' },
    5: { name: 'STARTING', displayColor: '#00DD00', color: '#00FF00' },
    6: { name: 'HAND', displayColor: '#4444FF', color: '#0000FF' },
    7: { name: 'FINISH', displayColor: '#FF0000', color: '#FF0000' },
    8: { name: 'FOOT', displayColor: '#FF00FF', color: '#FF00FF' },
  },
  // MoonBoard hold states (no foot holds)
  // Values 42-44 are used by saved MoonBoard climbs.
  // Values 45-48 are additional live-BLE preview roles emitted by the ESP32 dev firmware.
  moonboard: {
    42: { name: 'STARTING', color: '#00FF00', displayColor: '#44FF44' }, // start
    43: { name: 'HAND', color: '#0000FF', displayColor: '#4444FF' }, // right/plain hand
    44: { name: 'FINISH', color: '#FF0000', displayColor: '#FF3333' }, // finish
    45: { name: 'FOOT', color: '#00FFFF', displayColor: '#66F0FF' }, // foot
    46: { name: 'AUX', color: '#FFE066', displayColor: '#FFE066', renderStyle: 'above-marker' }, // above-hold marker
    47: { name: 'HAND', color: '#8B5CF6', displayColor: '#C084FC' }, // left hand
    48: { name: 'HAND', color: '#FF4FA3', displayColor: '#FF7DBB' }, // match hand
  },
};

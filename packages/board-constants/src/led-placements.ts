import type { BoardName } from '@boardsesh/shared-schema';
import { LED_PLACEMENTS } from './generated/led-placements-data';
import type { LedPositionWithColor } from './types';

export { LED_PLACEMENTS };
export type { LedPositionWithColor } from './types';

export const getLedPlacements = (
  boardName: BoardName,
  layoutId: number,
  sizeId: number,
): Record<number, number> => {
  const key = `${layoutId}-${sizeId}`;
  const placements = LED_PLACEMENTS[boardName]?.[key];
  if (!placements) {
    console.warn(
      `[LED] No LED placements found for ${boardName} layout=${layoutId} size=${sizeId}. ` +
      `Available keys: ${Object.keys(LED_PLACEMENTS[boardName] || {}).join(', ')}`,
    );
    return {};
  }

  return placements;
};

const reverseLookupCache: Record<string, Record<number, number>> = {};

export const getReverseLedPlacements = (
  boardName: BoardName,
  layoutId: number,
  sizeId: number,
): Record<number, number> => {
  const cacheKey = `${boardName}-${layoutId}-${sizeId}`;

  if (!reverseLookupCache[cacheKey]) {
    const placements = getLedPlacements(boardName, layoutId, sizeId);
    const reverse: Record<number, number> = {};

    for (const [placementId, ledPosition] of Object.entries(placements)) {
      reverse[ledPosition] = parseInt(placementId, 10);
    }

    reverseLookupCache[cacheKey] = reverse;
  }

  return reverseLookupCache[cacheKey];
};

const KILTER_ROLE_CODES = {
  STARTING: 42,
  HAND: 43,
  FINISH: 44,
  FOOT: 45,
} as const;

const TENSION_FAMILY_ROLE_CODES = {
  STARTING: 1,
  HAND: 2,
  FINISH: 3,
  FOOT: 4,
} as const;

const MOONBOARD_ROLE_CODES = {
  STARTING: 42,
  HAND: 43,
  FINISH: 44,
} as const;

export function colorToRoleCode(r: number, g: number, b: number, boardName: BoardName): number {
  const hasRed = r > 127;
  const hasGreen = g > 127;
  const hasBlue = b > 127;

  if (!hasRed && hasGreen && !hasBlue) {
    return boardName === 'kilter' ? KILTER_ROLE_CODES.STARTING : TENSION_FAMILY_ROLE_CODES.STARTING;
  }

  if (!hasRed && !hasGreen && hasBlue) {
    return boardName === 'kilter' ? KILTER_ROLE_CODES.HAND : TENSION_FAMILY_ROLE_CODES.HAND;
  }

  if (hasRed && !hasGreen && !hasBlue) {
    return boardName === 'moonboard'
      ? MOONBOARD_ROLE_CODES.FINISH
      : boardName === 'kilter'
        ? KILTER_ROLE_CODES.FINISH
        : TENSION_FAMILY_ROLE_CODES.FINISH;
  }

  if (hasRed && !hasGreen && hasBlue) {
    return boardName === 'kilter' ? KILTER_ROLE_CODES.FINISH : TENSION_FAMILY_ROLE_CODES.FOOT;
  }

  if (hasRed && hasGreen && !hasBlue) {
    return boardName === 'kilter' ? KILTER_ROLE_CODES.FOOT : TENSION_FAMILY_ROLE_CODES.FOOT;
  }

  if (boardName === 'moonboard') {
    return MOONBOARD_ROLE_CODES.HAND;
  }

  return boardName === 'kilter' ? KILTER_ROLE_CODES.HAND : TENSION_FAMILY_ROLE_CODES.HAND;
}

export function buildFramesString(
  ledPositions: LedPositionWithColor[],
  boardName: BoardName,
  layoutId: number,
  sizeId: number,
): string {
  const reversePlacements = getReverseLedPlacements(boardName, layoutId, sizeId);
  const placementEntries: Array<{ placementId: number; roleCode: number }> = [];

  for (const led of ledPositions) {
    const placementId = reversePlacements[led.position];

    if (!placementId) {
      console.warn(
        `[buildFramesString] Unknown LED position ${led.position} for ${boardName} layout ${layoutId} size ${sizeId}`,
      );
      continue;
    }

    const roleCode = led.role ?? colorToRoleCode(led.r, led.g, led.b, boardName);
    placementEntries.push({ placementId, roleCode });
  }

  placementEntries.sort((a, b) => a.placementId - b.placementId);
  return placementEntries.map((entry) => `p${entry.placementId}r${entry.roleCode}`).join('');
}

import type { MoonBoardHoldsInput } from '@boardsesh/shared-schema';
import type { LitUpHoldsMap } from '@/app/components/board-renderer/types';
import { holdIdToCoordinate, type MoonBoardCoordinate } from './moonboard-config';

export const MOONBOARD_DUPLICATE_ERROR_PREFIX = 'A MoonBoard climb with the same holds already exists';

export function convertLitUpHoldsMapToMoonBoardHolds(litUpHoldsMap: LitUpHoldsMap): MoonBoardHoldsInput {
  const holds: MoonBoardHoldsInput = {
    start: [],
    hand: [],
    finish: [],
  };

  const sortedEntries = Object.entries(litUpHoldsMap).sort(([a], [b]) => Number(a) - Number(b));

  for (const [holdId, hold] of sortedEntries) {
    const coord = holdIdToCoordinate(Number(holdId)) as MoonBoardCoordinate;

    if (hold.state === 'STARTING') {
      holds.start.push(coord);
    } else if (hold.state === 'HAND') {
      holds.hand.push(coord);
    } else if (hold.state === 'FINISH') {
      holds.finish.push(coord);
    }
  }

  return holds;
}

export function isMoonBoardDuplicateError(message: string): boolean {
  return message.includes(MOONBOARD_DUPLICATE_ERROR_PREFIX);
}

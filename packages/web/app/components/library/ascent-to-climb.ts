import type { Climb } from '@/app/lib/types';
import type { AscentFeedItem } from '@/app/lib/graphql/operations/ticks';

/**
 * Maps an AscentFeedItem (logbook tick) to a Climb object. The logbook row
 * has its own layout (LogbookGradeRow) so it doesn't render ClimbTitle —
 * but this Climb is still fed to ClimbActions / setCurrentClimb, meaning
 * the queue bar and play drawer render it via ClimbTitle. Populate
 * difficulty + quality_average from the consensus so those surfaces show
 * the real grade instead of falling back to "project".
 */
export function ascentFeedItemToClimb(item: AscentFeedItem): Climb {
  return {
    uuid: item.climbUuid,
    name: item.climbName,
    setter_username: item.setterUsername ?? '',
    frames: item.frames ?? '',
    angle: item.angle,
    difficulty: item.consensusDifficultyName ?? item.difficultyName ?? '',
    quality_average: item.qualityAverage != null ? String(item.qualityAverage) : '0',
    stars: 0,
    difficulty_error: '0',
    ascensionist_count: 0,
    benchmark_difficulty: item.isBenchmark ? (item.consensusDifficultyName ?? null) : null,
    mirrored: item.isMirror,
    layoutId: item.layoutId,
    boardType: item.boardType,
  };
}

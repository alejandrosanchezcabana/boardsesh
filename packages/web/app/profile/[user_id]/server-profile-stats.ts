import { cachedUserProfileStats, cachedUserTicks } from "@/app/lib/graphql/server-cached-client";
import { SUPPORTED_BOARDS } from "@/app/lib/board-data";
import type { LogbookEntry } from "./utils/profile-constants";
import type { GetUserProfileStatsQueryResponse } from "@/app/lib/graphql/operations/ticks";

export interface ProfileStatsData {
  initialProfileStats: GetUserProfileStatsQueryResponse["userProfileStats"] | null;
  initialAllBoardsTicks: Record<string, LogbookEntry[]>;
  initialLogbook: LogbookEntry[];
}

/**
 * Fetches profile stats and tick data for a user across all boards.
 * Shared between /you, /profile/[user_id], and /profile/[user_id]/statistics pages.
 */
export async function fetchProfileStatsData(userId: string): Promise<ProfileStatsData> {
  const [initialProfileStats, ...ticksResults] = await Promise.all([
    cachedUserProfileStats(userId),
    ...SUPPORTED_BOARDS.map((boardType) => cachedUserTicks(userId, boardType)),
  ]);

  const initialAllBoardsTicks: Record<string, LogbookEntry[]> = {};
  SUPPORTED_BOARDS.forEach((bt, i) => {
    const ticks = ticksResults[i];
    initialAllBoardsTicks[bt] = ticks
      ? ticks.map((tick) => ({
          climbed_at: tick.climbedAt,
          difficulty: tick.difficulty,
          tries: tick.attemptCount,
          angle: tick.angle,
          status: tick.status as LogbookEntry["status"],
          layoutId: tick.layoutId,
          boardType: bt,
          climbUuid: tick.climbUuid,
        }))
      : [];
  });

  const initialLogbook = initialAllBoardsTicks["kilter"] ?? [];

  return { initialProfileStats, initialAllBoardsTicks, initialLogbook };
}

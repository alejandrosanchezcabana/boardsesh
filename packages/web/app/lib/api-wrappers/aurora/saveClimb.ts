import type { BoardName } from '../../types';
import type { SaveClimbOptions } from './types';
import { generateUuid } from './util';
import { dbz } from '@/app/lib/db/db';
import { UNIFIED_TABLES } from '@/app/lib/db/queries/util/table-select';
import { boardClimbStats } from '@boardsesh/db/schema';
import { populateDenormalizedColumns } from '@boardsesh/db/queries';
import dayjs from 'dayjs';

/**
 * Saves a climb to the local database only.
 *
 * Climbs created locally are stored with the NextAuth user ID for attribution.
 * Aurora's setter_id is not used since we don't have Aurora credentials.
 */
export interface SaveClimbResponse {
  uuid: string;
  synced: boolean;
}

export async function saveClimb(board: BoardName, options: SaveClimbOptions): Promise<SaveClimbResponse> {
  const uuid = generateUuid();
  const createdAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const isListed = !options.is_draft;

  const { climbs } = UNIFIED_TABLES;

  await dbz
    .insert(climbs)
    .values({
      boardType: board,
      uuid,
      layoutId: options.layout_id,
      userId: options.user_id, // NextAuth user ID
      setterId: null, // No Aurora user ID
      setterUsername: options.setter_username || null,
      name: options.name,
      description: options.description || '',
      angle: options.angle,
      framesCount: options.frames_count || 1,
      framesPace: options.frames_pace || 0,
      frames: options.frames,
      isDraft: options.is_draft,
      isListed,
      createdAt,
      synced: false,
      syncError: null,
    })
    .onConflictDoUpdate({
      target: climbs.uuid,
      set: {
        layoutId: options.layout_id,
        userId: options.user_id,
        setterId: null,
        setterUsername: options.setter_username || null,
        name: options.name,
        description: options.description || '',
        angle: options.angle,
        framesCount: options.frames_count || 1,
        framesPace: options.frames_pace || 0,
        frames: options.frames,
        isDraft: options.is_draft,
        isListed,
        synced: false,
        syncError: null,
      },
    });

  // Populate denormalized required_set_ids and compatible_size_ids
  await populateDenormalizedColumns(dbz, board, [uuid]);

  // Return response - always success from client perspective
  return {
    uuid,
    synced: false,
  };
}

/**
 * Saves climb stats to the local database.
 * Used for storing grade/difficulty information for locally created climbs.
 */
export interface SaveClimbStatsOptions {
  climbUuid: string;
  angle: number;
  displayDifficulty: number;
  benchmarkDifficulty?: number | null;
}

export async function saveClimbStats(board: BoardName, options: SaveClimbStatsOptions): Promise<void> {
  await dbz
    .insert(boardClimbStats)
    .values({
      boardType: board,
      climbUuid: options.climbUuid,
      angle: options.angle,
      displayDifficulty: options.displayDifficulty,
      benchmarkDifficulty: options.benchmarkDifficulty ?? null,
      ascensionistCount: 0,
      difficultyAverage: options.displayDifficulty,
      qualityAverage: null,
      faUsername: null,
      faAt: null,
    })
    .onConflictDoUpdate({
      target: [boardClimbStats.boardType, boardClimbStats.climbUuid, boardClimbStats.angle],
      set: {
        displayDifficulty: options.displayDifficulty,
        benchmarkDifficulty: options.benchmarkDifficulty ?? null,
        difficultyAverage: options.displayDifficulty,
      },
    });
}

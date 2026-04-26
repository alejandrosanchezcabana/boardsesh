import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import {
  getBunnyThumbnailUrl,
  getBunnyPlaybackUrl,
  getBunnyVideoStatus,
  isBunnyStreamConfigured,
} from '../../../lib/bunny-stream';

type BetaVideoResult = {
  uuid: string;
  userId: string | null;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  boardType: string;
  climbUuid: string;
  angle: number | null;
  bunnyVideoId: string;
  status: string;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  duration: number | null;
  createdAt: string;
};

/**
 * Check Bunny Stream for a video's encoding status and update our DB if it
 * has finished encoding. Bunny status codes:
 *   0 = created, 1 = uploaded, 2 = processing, 3 = transcoding finished,
 *   4 = resolution finished (all done), 5 = error
 *
 * Status 3 and 4 both mean the video is playable.
 */
async function syncProcessingStatus(bunnyVideoId: string): Promise<'ready' | 'processing' | 'failed'> {
  try {
    const bunnyVideo = await getBunnyVideoStatus(bunnyVideoId);
    // Status >= 3 means encoding finished (3 = transcode done, 4 = resolutions done)
    if (bunnyVideo.status >= 3 && bunnyVideo.status <= 4) {
      await db
        .update(dbSchema.boardseshBetaVideos)
        .set({
          status: 'ready',
          thumbnailUrl: getBunnyThumbnailUrl(bunnyVideoId),
          duration: bunnyVideo.length > 0 ? bunnyVideo.length : null,
        })
        .where(eq(dbSchema.boardseshBetaVideos.bunnyVideoId, bunnyVideoId));
      return 'ready';
    }
    if (bunnyVideo.status === 5) {
      await db
        .update(dbSchema.boardseshBetaVideos)
        .set({ status: 'failed' })
        .where(eq(dbSchema.boardseshBetaVideos.bunnyVideoId, bunnyVideoId));
      return 'failed';
    }
    return 'processing';
  } catch {
    return 'processing';
  }
}

export const betaVideoQueries = {
  betaVideos: async (
    _: unknown,
    { boardType, climbUuid }: { boardType: string; climbUuid: string },
  ): Promise<BetaVideoResult[]> => {
    if (!isBunnyStreamConfigured()) return [];

    const rows = await db
      .select({
        uuid: dbSchema.boardseshBetaVideos.uuid,
        userId: dbSchema.boardseshBetaVideos.userId,
        boardType: dbSchema.boardseshBetaVideos.boardType,
        climbUuid: dbSchema.boardseshBetaVideos.climbUuid,
        angle: dbSchema.boardseshBetaVideos.angle,
        bunnyVideoId: dbSchema.boardseshBetaVideos.bunnyVideoId,
        status: dbSchema.boardseshBetaVideos.status,
        thumbnailUrl: dbSchema.boardseshBetaVideos.thumbnailUrl,
        duration: dbSchema.boardseshBetaVideos.duration,
        createdAt: dbSchema.boardseshBetaVideos.createdAt,
        userName: dbSchema.users.name,
        userImage: dbSchema.users.image,
        profileDisplayName: dbSchema.userProfiles.displayName,
        profileAvatarUrl: dbSchema.userProfiles.avatarUrl,
      })
      .from(dbSchema.boardseshBetaVideos)
      .leftJoin(dbSchema.users, eq(dbSchema.boardseshBetaVideos.userId, dbSchema.users.id))
      .leftJoin(dbSchema.userProfiles, eq(dbSchema.boardseshBetaVideos.userId, dbSchema.userProfiles.userId))
      .where(
        and(
          eq(dbSchema.boardseshBetaVideos.boardType, boardType),
          eq(dbSchema.boardseshBetaVideos.climbUuid, climbUuid),
          ne(dbSchema.boardseshBetaVideos.status, 'failed'),
        ),
      );

    // For any videos still 'processing', check Bunny in the background
    const processingRows = rows.filter((r) => r.status === 'processing');
    const statusUpdates = await Promise.all(
      processingRows.map(async (r) => ({
        bunnyVideoId: r.bunnyVideoId,
        newStatus: await syncProcessingStatus(r.bunnyVideoId),
      })),
    );

    return rows
      .map((row) => {
        const update = statusUpdates.find((u) => u.bunnyVideoId === row.bunnyVideoId);
        const effectiveStatus = update?.newStatus ?? row.status;
        if (effectiveStatus === 'failed') return null;

        const isReady = effectiveStatus === 'ready';
        return {
          uuid: row.uuid,
          userId: row.userId,
          userDisplayName: row.profileDisplayName || row.userName || null,
          userAvatarUrl: row.profileAvatarUrl || row.userImage || null,
          boardType: row.boardType,
          climbUuid: row.climbUuid,
          angle: row.angle,
          bunnyVideoId: row.bunnyVideoId,
          status: effectiveStatus,
          thumbnailUrl: isReady ? (row.thumbnailUrl ?? getBunnyThumbnailUrl(row.bunnyVideoId)) : null,
          playbackUrl: isReady ? getBunnyPlaybackUrl(row.bunnyVideoId) : null,
          duration: row.duration,
          createdAt: row.createdAt,
        };
      })
      .filter((r): r is BetaVideoResult => r !== null);
  },

  betaVideo: async (_: unknown, { uuid }: { uuid: string }): Promise<BetaVideoResult | null> => {
    if (!isBunnyStreamConfigured()) return null;

    const [row] = await db
      .select({
        uuid: dbSchema.boardseshBetaVideos.uuid,
        userId: dbSchema.boardseshBetaVideos.userId,
        boardType: dbSchema.boardseshBetaVideos.boardType,
        climbUuid: dbSchema.boardseshBetaVideos.climbUuid,
        angle: dbSchema.boardseshBetaVideos.angle,
        bunnyVideoId: dbSchema.boardseshBetaVideos.bunnyVideoId,
        status: dbSchema.boardseshBetaVideos.status,
        thumbnailUrl: dbSchema.boardseshBetaVideos.thumbnailUrl,
        duration: dbSchema.boardseshBetaVideos.duration,
        createdAt: dbSchema.boardseshBetaVideos.createdAt,
        userName: dbSchema.users.name,
        userImage: dbSchema.users.image,
        profileDisplayName: dbSchema.userProfiles.displayName,
        profileAvatarUrl: dbSchema.userProfiles.avatarUrl,
      })
      .from(dbSchema.boardseshBetaVideos)
      .leftJoin(dbSchema.users, eq(dbSchema.boardseshBetaVideos.userId, dbSchema.users.id))
      .leftJoin(dbSchema.userProfiles, eq(dbSchema.boardseshBetaVideos.userId, dbSchema.userProfiles.userId))
      .where(eq(dbSchema.boardseshBetaVideos.uuid, uuid))
      .limit(1);

    if (!row) return null;

    // If still processing, check Bunny for real status
    let effectiveStatus = row.status;
    if (effectiveStatus === 'processing') {
      effectiveStatus = await syncProcessingStatus(row.bunnyVideoId);
    }

    const isReady = effectiveStatus === 'ready';
    return {
      uuid: row.uuid,
      userId: row.userId,
      userDisplayName: row.profileDisplayName || row.userName || null,
      userAvatarUrl: row.profileAvatarUrl || row.userImage || null,
      boardType: row.boardType,
      climbUuid: row.climbUuid,
      angle: row.angle,
      bunnyVideoId: row.bunnyVideoId,
      status: effectiveStatus,
      thumbnailUrl: isReady ? (row.thumbnailUrl ?? getBunnyThumbnailUrl(row.bunnyVideoId)) : null,
      playbackUrl: isReady ? getBunnyPlaybackUrl(row.bunnyVideoId) : null,
      duration: row.duration,
      createdAt: row.createdAt,
    };
  },
};

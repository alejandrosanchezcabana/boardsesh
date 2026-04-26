import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import {
  getBunnyThumbnailUrl,
  getSignedThumbnailUrl,
  getSignedPlaybackUrl,
  getBunnyVideoStatus,
  deleteBunnyVideo,
  isBunnyStreamConfigured,
} from '../../../lib/bunny-stream';
import { fetchInstagramMeta, getInstagramMediaId, isInstagramUrl } from '../../../lib/instagram-meta';
import {
  cacheInstagramThumbnail,
  getDevProxyThumbnailUrl,
  isOurS3Url,
  isS3Configured,
} from '../../../lib/beta-link-thumbnails';

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

type BetaLinkResult = {
  climbUuid: string;
  link: string;
  foreignUsername: string | null;
  angle: number | null;
  thumbnail: string | null;
  isListed: boolean | null;
  createdAt: string | null;
};

// Simple TTL cache for sync status checks to avoid N+1 external API calls
const statusCheckCache = new Map<string, { status: 'ready' | 'processing' | 'failed'; checkedAt: number }>();
const STATUS_CHECK_TTL_MS = 30_000; // 30 seconds

/**
 * Check Bunny Stream for a video's encoding status and update our DB if it
 * has finished encoding. Bunny status codes:
 *   0 = created, 1 = uploaded, 2 = processing, 3 = transcoding finished,
 *   4 = resolution finished (all done), 5 = error
 *
 * Status 3 and 4 both mean the video is playable.
 *
 * Results are cached for 30 seconds to avoid hammering Bunny's API on
 * repeated GraphQL requests.
 */
async function syncProcessingStatus(bunnyVideoId: string): Promise<'ready' | 'processing' | 'failed'> {
  // Check cache first
  const cached = statusCheckCache.get(bunnyVideoId);
  if (cached && Date.now() - cached.checkedAt < STATUS_CHECK_TTL_MS) {
    return cached.status;
  }

  try {
    const bunnyVideo = await getBunnyVideoStatus(bunnyVideoId);
    let status: 'ready' | 'processing' | 'failed';

    // Status >= 3 means encoding finished (3 = transcode done, 4 = resolutions done)
    if (bunnyVideo.status >= 3 && bunnyVideo.status <= 4) {
      // Reject videos longer than 60 seconds
      if (bunnyVideo.length > 60) {
        await db
          .update(dbSchema.boardseshBetaVideos)
          .set({ status: 'failed' })
          .where(eq(dbSchema.boardseshBetaVideos.bunnyVideoId, bunnyVideoId));
        try {
          await deleteBunnyVideo(bunnyVideoId);
        } catch {
          /* best effort cleanup */
        }
        status = 'failed';
      } else {
        await db
          .update(dbSchema.boardseshBetaVideos)
          .set({
            status: 'ready',
            thumbnailUrl: getBunnyThumbnailUrl(bunnyVideoId),
            duration: bunnyVideo.length > 0 ? bunnyVideo.length : null,
          })
          .where(eq(dbSchema.boardseshBetaVideos.bunnyVideoId, bunnyVideoId));
        status = 'ready';
      }
    } else if (bunnyVideo.status === 5) {
      await db
        .update(dbSchema.boardseshBetaVideos)
        .set({ status: 'failed' })
        .where(eq(dbSchema.boardseshBetaVideos.bunnyVideoId, bunnyVideoId));
      status = 'failed';
    } else {
      status = 'processing';
    }

    statusCheckCache.set(bunnyVideoId, { status, checkedAt: Date.now() });

    // Clean up ready/failed entries from cache after TTL so we don't leak memory
    if (status !== 'processing') {
      setTimeout(() => statusCheckCache.delete(bunnyVideoId), STATUS_CHECK_TTL_MS);
    }

    return status;
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
          thumbnailUrl: isReady ? getSignedThumbnailUrl(row.bunnyVideoId) : null,
          playbackUrl: isReady ? getSignedPlaybackUrl(row.bunnyVideoId) : null,
          duration: row.duration,
          createdAt: row.createdAt,
        };
      })
      .filter((r): r is BetaVideoResult => r !== null);
  },

  betaLinks: async (
    _: unknown,
    { boardType, climbUuid }: { boardType: string; climbUuid: string },
  ): Promise<BetaLinkResult[]> => {
    const rows = await db
      .select()
      .from(dbSchema.boardBetaLinks)
      .where(and(eq(dbSchema.boardBetaLinks.boardType, boardType), eq(dbSchema.boardBetaLinks.climbUuid, climbUuid)));

    const enriched = await Promise.all(
      rows.map(async (row): Promise<BetaLinkResult | null> => {
        // Non-Instagram links: pass through, but only serve a thumbnail if it's already cached in our S3.
        if (!isInstagramUrl(row.link)) {
          return {
            climbUuid: row.climbUuid,
            link: row.link,
            foreignUsername: row.foreignUsername,
            angle: row.angle,
            thumbnail: isOurS3Url(row.thumbnail) ? row.thumbnail : null,
            isListed: row.isListed,
            createdAt: row.createdAt,
          };
        }

        // Instagram link: always live-check.
        const meta = await fetchInstagramMeta(row.link);

        if (meta.status === 'gone') {
          // Post is private/deleted — omit from response.
          return null;
        }

        if (meta.status === 'transient_error') {
          // Network blip — keep showing the link with whatever cached thumbnail we have.
          return {
            climbUuid: row.climbUuid,
            link: row.link,
            foreignUsername: row.foreignUsername,
            angle: row.angle,
            thumbnail: isOurS3Url(row.thumbnail) ? row.thumbnail : null,
            isListed: row.isListed,
            createdAt: row.createdAt,
          };
        }

        // status === 'ok'
        const mediaId = getInstagramMediaId(row.link);
        let thumbnail: string | null = null;
        let persistedThumbnail: string | null = null;

        if (isS3Configured()) {
          // Production-style path: cache to our S3 bucket and persist the S3 URL.
          if (isOurS3Url(row.thumbnail)) {
            thumbnail = row.thumbnail;
          } else if (mediaId) {
            thumbnail = await cacheInstagramThumbnail(mediaId, meta.thumbnail);
            persistedThumbnail = thumbnail;
          }
        } else {
          // Dev path: no S3. Proxy the fbcdn URL through our backend so the browser doesn't hit Instagram CDN cross-origin.
          thumbnail = getDevProxyThumbnailUrl(meta.thumbnail);
        }

        const newUsername = row.foreignUsername ?? meta.username;
        const needsDbUpdate =
          (persistedThumbnail && persistedThumbnail !== row.thumbnail) ||
          (newUsername && newUsername !== row.foreignUsername);

        if (needsDbUpdate) {
          try {
            await db
              .update(dbSchema.boardBetaLinks)
              .set({
                thumbnail: persistedThumbnail ?? row.thumbnail,
                foreignUsername: newUsername,
              })
              .where(
                and(
                  eq(dbSchema.boardBetaLinks.boardType, row.boardType),
                  eq(dbSchema.boardBetaLinks.climbUuid, row.climbUuid),
                  eq(dbSchema.boardBetaLinks.link, row.link),
                ),
              );
          } catch (err) {
            console.error('[BetaLinks] Failed to persist enriched metadata:', err);
          }
        }

        return {
          climbUuid: row.climbUuid,
          link: row.link,
          foreignUsername: newUsername,
          angle: row.angle,
          thumbnail,
          isListed: row.isListed,
          createdAt: row.createdAt,
        };
      }),
    );

    return enriched.filter((r): r is BetaLinkResult => r !== null);
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
      thumbnailUrl: isReady ? getSignedThumbnailUrl(row.bunnyVideoId) : null,
      playbackUrl: isReady ? getSignedPlaybackUrl(row.bunnyVideoId) : null,
      duration: row.duration,
      createdAt: row.createdAt,
    };
  },
};

import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchInstagramMeta, getInstagramMediaId, isInstagramUrl } from '../../../lib/instagram-meta';
import {
  cacheInstagramThumbnail,
  getDevProxyThumbnailUrl,
  isOurS3Url,
  isS3Configured,
} from '../../../lib/beta-link-thumbnails';

type BetaLinkResult = {
  climbUuid: string;
  link: string;
  foreignUsername: string | null;
  angle: number | null;
  thumbnail: string | null;
  isListed: boolean | null;
  createdAt: string | null;
};

export const betaVideoQueries = {
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
};

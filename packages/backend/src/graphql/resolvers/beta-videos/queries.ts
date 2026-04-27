import { db } from '../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchInstagramMeta, getInstagramMediaId, isInstagramUrl } from '../../../lib/instagram-meta';
import { fetchTikTokMeta, getTikTokCacheId, isTikTokUrl } from '../../../lib/tiktok-meta';
import {
  cacheInstagramThumbnail,
  cacheTikTokThumbnail,
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

// We never surface KayaClimb beta links — we don't want to drive traffic to a
// competing climbing app from our slider. Filter them out at the resolver.
const KAYACLIMB_HOST = /^https?:\/\/(?:[a-z0-9-]+\.)?kayaclimb\.com\//i;

function isKayaClimbUrl(url: string): boolean {
  return KAYACLIMB_HOST.test(url);
}

type Row = typeof dbSchema.boardBetaLinks.$inferSelect;

function passthroughResult(row: Row): BetaLinkResult {
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

async function persistEnriched(row: Row, persistedThumbnail: string | null, newUsername: string | null): Promise<void> {
  const needsDbUpdate =
    (persistedThumbnail && persistedThumbnail !== row.thumbnail) ||
    (newUsername && newUsername !== row.foreignUsername);
  if (!needsDbUpdate) return;
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

async function enrichInstagramRow(row: Row): Promise<BetaLinkResult | null> {
  const meta = await fetchInstagramMeta(row.link);

  if (meta.status === 'gone') return null;
  if (meta.status === 'transient_error') return passthroughResult(row);

  const mediaId = getInstagramMediaId(row.link);
  let thumbnail: string | null = null;
  let persistedThumbnail: string | null = null;

  if (isS3Configured()) {
    if (isOurS3Url(row.thumbnail)) {
      thumbnail = row.thumbnail;
    } else if (mediaId) {
      thumbnail = await cacheInstagramThumbnail(mediaId, meta.thumbnail);
      persistedThumbnail = thumbnail;
    }
  } else {
    thumbnail = getDevProxyThumbnailUrl(meta.thumbnail);
  }

  const newUsername = row.foreignUsername ?? meta.username;
  await persistEnriched(row, persistedThumbnail, newUsername);

  return {
    climbUuid: row.climbUuid,
    link: row.link,
    foreignUsername: newUsername,
    angle: row.angle,
    thumbnail,
    isListed: row.isListed,
    createdAt: row.createdAt,
  };
}

async function enrichTikTokRow(row: Row): Promise<BetaLinkResult | null> {
  const meta = await fetchTikTokMeta(row.link);

  if (meta.status === 'gone') return null;
  if (meta.status === 'transient_error') return passthroughResult(row);

  const cacheId = getTikTokCacheId(row.link);
  let thumbnail: string | null = null;
  let persistedThumbnail: string | null = null;

  if (isS3Configured()) {
    if (isOurS3Url(row.thumbnail)) {
      thumbnail = row.thumbnail;
    } else if (cacheId) {
      thumbnail = await cacheTikTokThumbnail(cacheId, meta.thumbnail);
      persistedThumbnail = thumbnail;
    }
  } else {
    thumbnail = getDevProxyThumbnailUrl(meta.thumbnail);
  }

  const newUsername = row.foreignUsername ?? meta.username;
  await persistEnriched(row, persistedThumbnail, newUsername);

  return {
    climbUuid: row.climbUuid,
    link: row.link,
    foreignUsername: newUsername,
    angle: row.angle,
    thumbnail,
    isListed: row.isListed,
    createdAt: row.createdAt,
  };
}

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
        if (isKayaClimbUrl(row.link)) return null;
        if (isInstagramUrl(row.link)) return enrichInstagramRow(row);
        if (isTikTokUrl(row.link)) return enrichTikTokRow(row);
        // Unknown platform: serve only an already-cached thumbnail (don't
        // hot-link an arbitrary URL).
        return passthroughResult(row);
      }),
    );

    return enriched.filter((r): r is BetaLinkResult => r !== null);
  },
};

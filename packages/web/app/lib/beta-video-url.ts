import {
  BETA_VIDEO_URL_VALIDATION_MESSAGE,
  getInstagramMediaId,
  getTikTokVideoId,
  isBetaVideoUrl,
  isInstagramUrl,
  isTikTokUrl,
} from '@boardsesh/shared-schema';
import type { BetaLink } from '@/app/lib/api-wrappers/sync-api-types';

export { BETA_VIDEO_URL_VALIDATION_MESSAGE, isBetaVideoUrl, isInstagramUrl, isTikTokUrl };

/**
 * Stable identity used to dedupe beta links that point at the same video,
 * even when their URLs differ in tracking params or host. Prefer the platform
 * media id; fall back to the raw URL for unrecognised hosts.
 */
function betaLinkIdentity(url: string): string {
  const instagramId = getInstagramMediaId(url);
  if (instagramId) return `instagram:${instagramId}`;
  const tiktokId = getTikTokVideoId(url);
  if (tiktokId) return `tiktok:${tiktokId}`;
  return `raw:${url}`;
}

export function dedupeBetaLinks(betaLinks: BetaLink[]): BetaLink[] {
  const dedupedLinks: BetaLink[] = [];
  const indexByIdentity = new Map<string, number>();

  for (const betaLink of betaLinks) {
    const identity = betaLinkIdentity(betaLink.link);
    const existingIndex = indexByIdentity.get(identity);

    if (existingIndex === undefined) {
      indexByIdentity.set(identity, dedupedLinks.length);
      dedupedLinks.push(betaLink);
      continue;
    }

    const existing = dedupedLinks[existingIndex];
    dedupedLinks[existingIndex] = {
      ...existing,
      foreign_username: existing.foreign_username ?? betaLink.foreign_username,
      angle: existing.angle ?? betaLink.angle,
      thumbnail: existing.thumbnail ?? betaLink.thumbnail,
      created_at: existing.created_at || betaLink.created_at,
    };
  }

  return dedupedLinks;
}

/**
 * Maps the GraphQL `betaLinks` response into the `BetaLink` shape used by
 * the rest of the web app. Used by both `BoardseshBetaSection` and the IG
 * post dialog.
 */
type BetaLinksGqlRow = {
  climbUuid: string;
  link: string;
  foreignUsername: string | null;
  angle: number | null;
  thumbnail: string | null;
  isListed: boolean | null;
  createdAt: string | null;
};

export function mapBetaLinksResponse(rows: BetaLinksGqlRow[]): BetaLink[] {
  return rows.map((b) => ({
    climb_uuid: b.climbUuid,
    link: b.link,
    foreign_username: b.foreignUsername,
    angle: b.angle,
    thumbnail: b.thumbnail,
    is_listed: b.isListed ?? false,
    created_at: b.createdAt ?? '',
  }));
}

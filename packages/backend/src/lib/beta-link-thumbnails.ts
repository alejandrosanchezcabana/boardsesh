import { getPublicUrl, isS3Configured, uploadToS3 } from '../storage/s3';

export { isS3Configured };

const STATIC_THUMBNAIL_PREFIX = '/static/beta-link-thumbnails/';

/**
 * URL we surface to clients for a cached thumbnail. Mirrors the avatar
 * pattern: backend-relative `/static/...` path that the backend proxies out
 * of S3 (Tigris on Railway doesn't honor `ACL: 'public-read'`, so direct
 * bucket URLs 403 in the browser).
 *
 * Strips a leading slash from the key so we never produce `/static//...`
 * if a future refactor changes how keys are constructed — that mismatched
 * URL would slip past `isOurS3Url` and silently break the resolver
 * short-circuit.
 */
function getStaticThumbnailUrl(key: string): string {
  const normalizedKey = key.replace(/^\/+/, '');
  return `/static/${normalizedKey}`;
}

/**
 * Dev-only thumbnail proxy. Used by both Instagram and TikTok branches when
 * S3 is not configured — lets the browser fetch CDN thumbnails through our
 * backend instead of cross-origin. The matching route is 410'd in production
 * whenever AWS_S3_BUCKET_NAME is set.
 */
export function getDevProxyThumbnailUrl(remoteUrl: string): string {
  return `/api/internal/beta-link-thumbnail?url=${encodeURIComponent(remoteUrl)}`;
}

const FETCH_TIMEOUT_MS = 4000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export function instagramThumbnailKey(mediaId: string): string {
  return `beta-link-thumbnails/instagram/${mediaId}.jpg`;
}

export function tiktokThumbnailKey(cacheId: string): string {
  return `beta-link-thumbnails/tiktok/${cacheId}.jpg`;
}

export function isOurS3Url(url: string | null): boolean {
  if (!url) return false;
  // New canonical form: backend-relative `/static/beta-link-thumbnails/...`
  // served via handleStaticBetaThumbnail.
  if (url.startsWith(STATIC_THUMBNAIL_PREFIX)) return true;
  // Legacy form (pre-#1734-fix): direct Tigris/S3 URL persisted from
  // getPublicUrl. These objects exist in our bucket but 403 in the browser
  // because Tigris ignores public-read ACLs. We still recognize them as
  // "ours" so the resolver short-circuit holds during/after the backfill;
  // the backfill rewrites these to the new prefix.
  try {
    const ourPrefix = getPublicUrl('');
    if (ourPrefix && url.startsWith(ourPrefix)) return true;
  } catch {
    // S3 not configured — only the static prefix is ours.
  }
  return false;
}

async function cacheRemoteThumbnail(key: string, sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    await uploadToS3(buffer, key, contentType);
    return getStaticThumbnailUrl(key);
  } catch (err) {
    console.error('[BetaLinks] cacheRemoteThumbnail failed:', err);
    return null;
  }
}

export function cacheInstagramThumbnail(mediaId: string, fbcdnUrl: string): Promise<string | null> {
  return cacheRemoteThumbnail(instagramThumbnailKey(mediaId), fbcdnUrl);
}

export function cacheTikTokThumbnail(cacheId: string, tiktokCdnUrl: string): Promise<string | null> {
  return cacheRemoteThumbnail(tiktokThumbnailKey(cacheId), tiktokCdnUrl);
}

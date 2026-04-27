import { getPublicUrl, isS3Configured, uploadToS3 } from '../storage/s3';

export { isS3Configured };

export function getDevProxyThumbnailUrl(remoteUrl: string): string {
  return `/api/internal/instagram-thumbnail?url=${encodeURIComponent(remoteUrl)}`;
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
  try {
    const ourPrefix = getPublicUrl('');
    return url.startsWith(ourPrefix);
  } catch {
    return false;
  }
}

async function cacheRemoteThumbnail(key: string, sourceUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const { url } = await uploadToS3(buffer, key, contentType);
    return url;
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

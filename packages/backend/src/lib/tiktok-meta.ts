import { createHash } from 'node:crypto';
import { getTikTokVideoId, isTikTokUrl, TIKTOK_URL_REGEX } from '@boardsesh/shared-schema';

export { TIKTOK_URL_REGEX, isTikTokUrl };

const FETCH_TIMEOUT_MS = 4000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const TIKTOK_META_TTL_MS = 10 * 60 * 1000;
// Negative TTL for transient errors so a TikTok rate-limit doesn't cause a
// refetch on every read. See instagram-meta.ts for the same pattern.
export const TIKTOK_TRANSIENT_TTL_MS = 2 * 60 * 1000;

const CIRCUIT_WINDOW_MS = 60 * 1000;
const CIRCUIT_THRESHOLD = 10;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Stable cache key for a TikTok URL.
 *
 * Long-form `/@user/video/<id>` URLs return the numeric video ID so all
 * variants of the same video (with/without query params, www vs bare host)
 * share a key. Short links (`vm.tiktok.com/<short>`, `t.tiktok.com/<short>`)
 * fall back to a hash of the URL — we don't expand them.
 */
export function getTikTokCacheId(url: string): string | null {
  const videoId = getTikTokVideoId(url);
  if (videoId) return videoId;
  if (!isTikTokUrl(url)) return null;
  return `s${createHash('sha1').update(url).digest('hex').slice(0, 16)}`;
}

export type TikTokMetaResult =
  | { status: 'ok'; thumbnail: string; username: string | null }
  | { status: 'gone' }
  | { status: 'transient_error' };

type OEmbedResponse = {
  thumbnail_url?: string;
  author_unique_id?: string;
  author_name?: string;
};

const metaCache = new Map<string, { data: TikTokMetaResult; expiresAt: number }>();
const inflight = new Map<string, Promise<TikTokMetaResult>>();

const transientTimestamps: number[] = [];
let circuitOpenUntil = 0;

function recordTransientError(): void {
  const now = Date.now();
  transientTimestamps.push(now);
  const cutoff = now - CIRCUIT_WINDOW_MS;
  while (transientTimestamps.length > 0 && transientTimestamps[0] < cutoff) {
    transientTimestamps.shift();
  }
  if (transientTimestamps.length >= CIRCUIT_THRESHOLD && circuitOpenUntil <= now) {
    circuitOpenUntil = now + CIRCUIT_COOLDOWN_MS;
    console.warn(
      `[tiktok-meta] circuit breaker open for ${CIRCUIT_COOLDOWN_MS / 1000}s after ${transientTimestamps.length} transient errors in ${CIRCUIT_WINDOW_MS / 1000}s`,
    );
  }
}

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export function clearTikTokMetaCache(): void {
  metaCache.clear();
  inflight.clear();
  transientTimestamps.length = 0;
  circuitOpenUntil = 0;
}

async function fetchTikTokMetaUncached(url: string): Promise<TikTokMetaResult> {
  if (!isTikTokUrl(url)) return { status: 'gone' };

  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

  let res: Response;
  try {
    res = await fetch(oembedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return { status: 'transient_error' };
  }

  // 404 / 410 → the video is private or deleted. Other non-2xx → transient
  // (rate limit, edge hiccup) so we keep showing the cached thumbnail.
  if (res.status === 404 || res.status === 410) return { status: 'gone' };
  if (!res.ok) return { status: 'transient_error' };

  let data: OEmbedResponse;
  try {
    data = (await res.json()) as OEmbedResponse;
  } catch {
    return { status: 'transient_error' };
  }

  // Some 200s come back without a thumbnail_url during edge / rate-limit
  // hiccups. Prefer transient_error over `gone` so we don't drop a real
  // beta video — `gone` only fires on explicit 404/410 above.
  if (!data.thumbnail_url) return { status: 'transient_error' };

  return {
    status: 'ok',
    thumbnail: data.thumbnail_url,
    username: data.author_unique_id ?? data.author_name ?? null,
  };
}

export async function fetchTikTokMeta(url: string): Promise<TikTokMetaResult> {
  const now = Date.now();
  const cached = metaCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (isCircuitOpen()) {
    return { status: 'transient_error' };
  }

  const existing = inflight.get(url);
  if (existing) return existing;

  const promise = fetchTikTokMetaUncached(url)
    .then((result) => {
      const ttl = result.status === 'transient_error' ? TIKTOK_TRANSIENT_TTL_MS : TIKTOK_META_TTL_MS;
      metaCache.set(url, { data: result, expiresAt: Date.now() + ttl });
      if (result.status === 'transient_error') {
        recordTransientError();
      }
      return result;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}

import { getInstagramMediaId, INSTAGRAM_URL_REGEX, isInstagramUrl } from '@boardsesh/shared-schema';

export { INSTAGRAM_URL_REGEX, isInstagramUrl, getInstagramMediaId };

const FETCH_TIMEOUT_MS = 4000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const INSTAGRAM_META_TTL_MS = 10 * 60 * 1000;
// Cache transient errors briefly so a rate-limit / login-wall response from
// Instagram doesn't make us refetch on every read of every beta link. Short
// enough that we recover quickly when IG comes back, long enough to break
// the request-per-read pattern under load.
export const INSTAGRAM_TRANSIENT_TTL_MS = 2 * 60 * 1000;

// Circuit breaker: if we observe a burst of transient errors, stop calling
// out for a cooldown so we don't keep poking IG while it's actively
// throttling us. The resolver layer keeps serving cached thumbnails during
// the open window (see enrichRow's transient_error handling).
//
// State is per-process (module-singleton) — same shape as the existing
// `metaCache` / `inflight` maps. In a horizontally scaled deploy each
// instance independently rate-limits itself; threshold + cooldown are sized
// so a single instance can't sustain enough outbound load to matter, but a
// fleet-wide breaker would need a Redis-backed counter (out of scope here).
const CIRCUIT_WINDOW_MS = 60 * 1000;
const CIRCUIT_THRESHOLD = 10;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

export type InstagramMetaResult =
  | { status: 'ok'; thumbnail: string; username: string | null }
  | { status: 'gone' }
  | { status: 'transient_error' };

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#064;/g, '@')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function decodeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
}

/**
 * IG sometimes serves a 200 OK login wall (rate limit, age-gate, geo-block)
 * instead of the embed page. The login wall has no `EmbeddedMediaImage` /
 * `og:image` so the regular path would classify it as `gone`. Detect a
 * couple of stable signals so we can map it to `transient_error` instead.
 */
function looksLikeLoginWall(html: string): boolean {
  return (
    /accounts\/login/i.test(html) ||
    /<title>\s*Login\s*[••]\s*Instagram\s*<\/title>/i.test(html) ||
    /Please wait a few minutes before you try again/i.test(html)
  );
}

const metaCache = new Map<string, { data: InstagramMetaResult; expiresAt: number }>();
const inflight = new Map<string, Promise<InstagramMetaResult>>();

const transientTimestamps: number[] = [];
let circuitOpenUntil = 0;

function recordTransientError(): void {
  const now = Date.now();
  transientTimestamps.push(now);
  // Drop entries outside the rolling window.
  const cutoff = now - CIRCUIT_WINDOW_MS;
  while (transientTimestamps.length > 0 && transientTimestamps[0] < cutoff) {
    transientTimestamps.shift();
  }
  if (transientTimestamps.length >= CIRCUIT_THRESHOLD && circuitOpenUntil <= now) {
    circuitOpenUntil = now + CIRCUIT_COOLDOWN_MS;
    console.warn(
      `[instagram-meta] circuit breaker open for ${CIRCUIT_COOLDOWN_MS / 1000}s after ${transientTimestamps.length} transient errors in ${CIRCUIT_WINDOW_MS / 1000}s`,
    );
  }
}

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export function clearInstagramMetaCache(): void {
  metaCache.clear();
  inflight.clear();
  transientTimestamps.length = 0;
  circuitOpenUntil = 0;
}

async function fetchInstagramMetaUncached(url: string): Promise<InstagramMetaResult> {
  const mediaId = getInstagramMediaId(url);
  if (!mediaId) return { status: 'gone' };
  const embedUrl = `https://www.instagram.com/p/${mediaId}/embed/captioned/`;

  let html: string;
  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'transient_error' };
    html = await res.text();
  } catch {
    return { status: 'transient_error' };
  }

  // Primary signal: <img class="EmbeddedMediaImage" alt="Instagram post shared by &#064;<user>" src="...p1080x1080..." />
  // The alt and src order isn't guaranteed; try both arrangements.
  const altThenSrc = html.match(
    /<img[^>]*class=["']EmbeddedMediaImage["'][^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["']/i,
  );
  const srcThenAlt = altThenSrc
    ? null
    : html.match(/<img[^>]*class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/i);

  let thumbnail: string | null = null;
  let usernameFromAlt: string | null = null;

  if (altThenSrc) {
    thumbnail = decodeHtmlEntities(altThenSrc[2]);
    usernameFromAlt = decodeHtmlEntities(altThenSrc[1]).match(/@([\w._]+)/)?.[1] ?? null;
  } else if (srcThenAlt) {
    thumbnail = decodeHtmlEntities(srcThenAlt[1]);
    usernameFromAlt = decodeHtmlEntities(srcThenAlt[2]).match(/@([\w._]+)/)?.[1] ?? null;
  }

  if (!thumbnail) {
    const ogImageRaw = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
    const displayUrlRaw = html.match(/"display_url"\s*:\s*"([^"]+)"/)?.[1] ?? null;
    const thumbnailSrcRaw = html.match(/"thumbnail_src"\s*:\s*"([^"]+)"/)?.[1] ?? null;
    thumbnail = ogImageRaw
      ? decodeHtmlEntities(ogImageRaw)
      : displayUrlRaw
        ? decodeJsonString(displayUrlRaw)
        : thumbnailSrcRaw
          ? decodeJsonString(thumbnailSrcRaw)
          : null;
  }

  if (!thumbnail) {
    // 200 OK but no embedded image — could be a real "post is gone" page
    // *or* a login wall served by Instagram during rate-limit / age-gate /
    // geo-block. Treat the login-wall variants as transient so we don't
    // silently drop a real beta link the next time the resolver runs.
    if (looksLikeLoginWall(html)) {
      return { status: 'transient_error' };
    }
    return { status: 'gone' };
  }

  const username =
    usernameFromAlt ??
    html.match(/"owner"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/)?.[1] ??
    html.match(/<input[^>]*class=["']EmbedInput["'][^>]*value=["']@?([\w._]+)["']/i)?.[1] ??
    null;

  return { status: 'ok', thumbnail, username };
}

export async function fetchInstagramMeta(url: string): Promise<InstagramMetaResult> {
  const now = Date.now();
  const cached = metaCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Circuit open: short-circuit to transient_error without making a network
  // call. The resolver layer keeps serving cached thumbnails during this
  // window (see enrichRow). Don't poison the meta cache with this synthetic
  // result — once the circuit closes we want to retry normally.
  if (isCircuitOpen()) {
    return { status: 'transient_error' };
  }

  const existing = inflight.get(url);
  if (existing) return existing;

  const promise = fetchInstagramMetaUncached(url)
    .then((result) => {
      const ttl = result.status === 'transient_error' ? INSTAGRAM_TRANSIENT_TTL_MS : INSTAGRAM_META_TTL_MS;
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

const FETCH_TIMEOUT_MS = 4000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const INSTAGRAM_META_TTL_MS = 10 * 60 * 1000;

export const INSTAGRAM_URL_REGEX =
  /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([\w-]+)\/?(?:[?#].*)?$/i;

export function isInstagramUrl(url: string): boolean {
  return INSTAGRAM_URL_REGEX.test(url);
}

export function getInstagramMediaId(url: string): string | null {
  const match = url.match(INSTAGRAM_URL_REGEX);
  return match?.[1] ?? null;
}

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

const metaCache = new Map<string, { data: InstagramMetaResult; expiresAt: number }>();
const inflight = new Map<string, Promise<InstagramMetaResult>>();

export function clearInstagramMetaCache(): void {
  metaCache.clear();
  inflight.clear();
}

async function fetchInstagramMetaUncached(url: string): Promise<InstagramMetaResult> {
  const mediaId = getInstagramMediaId(url);
  if (!mediaId) return { status: 'gone' };
  const embedUrl = `https://www.instagram.com/p/${mediaId}/embed/captioned/`;

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
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
    // 200 OK but no embedded image — post is private/deleted/age-gated.
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

  const existing = inflight.get(url);
  if (existing) return existing;

  const promise = fetchInstagramMetaUncached(url)
    .then((result) => {
      // Only cache terminal results — don't pin transient errors.
      if (result.status !== 'transient_error') {
        metaCache.set(url, { data: result, expiresAt: Date.now() + INSTAGRAM_META_TTL_MS });
      }
      return result;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}

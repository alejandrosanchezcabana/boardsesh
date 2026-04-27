import { createHash } from 'node:crypto';

const FETCH_TIMEOUT_MS = 4000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// Match any tiktok host: tiktok.com, www.tiktok.com, vm.tiktok.com, vt.tiktok.com,
// m.tiktok.com, t.tiktok.com. oEmbed accepts all of these so we don't need to
// normalize the URL before resolving.
export const TIKTOK_URL_REGEX = /^https?:\/\/(?:[a-z0-9-]+\.)?tiktok\.com\//i;

const LONG_FORM_VIDEO_ID = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;

export function isTikTokUrl(url: string): boolean {
  return TIKTOK_URL_REGEX.test(url);
}

/**
 * Stable cache key for a TikTok URL.
 *
 * Long-form `/@user/video/<id>` URLs return the numeric video ID so all
 * variants of the same video (with/without query params, www vs bare host)
 * share a key. Short links (`vm.tiktok.com/<short>`, `t.tiktok.com/<short>`)
 * fall back to a hash of the URL — we don't expand them.
 */
export function getTikTokCacheId(url: string): string | null {
  const match = url.match(LONG_FORM_VIDEO_ID);
  if (match) return match[1];
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

export async function fetchTikTokMeta(url: string): Promise<TikTokMetaResult> {
  if (!isTikTokUrl(url)) return { status: 'gone' };

  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    res = await fetch(oembedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
  } catch {
    return { status: 'transient_error' };
  }

  // 404 / 410 → the video is private or deleted. Other non-2xx → treat as
  // transient (rate limit, edge hiccup) so we keep showing the cached
  // thumbnail next time.
  if (res.status === 404 || res.status === 410) return { status: 'gone' };
  if (!res.ok) return { status: 'transient_error' };

  let data: OEmbedResponse;
  try {
    data = (await res.json()) as OEmbedResponse;
  } catch {
    return { status: 'transient_error' };
  }

  if (!data.thumbnail_url) return { status: 'gone' };

  return {
    status: 'ok',
    thumbnail: data.thumbnail_url,
    username: data.author_unique_id ?? data.author_name ?? null,
  };
}

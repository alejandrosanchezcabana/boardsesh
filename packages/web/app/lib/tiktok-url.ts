export const TIKTOK_URL_REGEX = /^https?:\/\/(?:[a-z0-9-]+\.)?tiktok\.com\//i;

const LONG_FORM_VIDEO_ID = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;

export function isTikTokUrl(url: string): boolean {
  return TIKTOK_URL_REGEX.test(url);
}

/**
 * Numeric video ID for long-form `/@user/video/<id>` URLs, used to dedupe
 * different variants of the same video. Short links (`vm.tiktok.com/<short>`)
 * return null — we don't expand them client-side.
 */
export function getTikTokVideoId(url: string): string | null {
  const match = url.match(LONG_FORM_VIDEO_ID);
  return match?.[1] ?? null;
}

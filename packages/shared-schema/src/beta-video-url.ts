/**
 * Beta-video URL helpers — Instagram and TikTok.
 *
 * Shared across backend resolvers/validation and the web app so we have a
 * single definition of which URLs we accept and how we extract identifiers.
 */

export const INSTAGRAM_URL_REGEX =
  /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([\w-]+)\/?(?:[?#].*)?$/i;

export const TIKTOK_URL_REGEX = /^https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\//i;

const TIKTOK_LONG_FORM_VIDEO_ID = /^https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;

/**
 * Combined accept regex for the attach mutation + tick `videoUrl` validation.
 * The two source patterns are anchored, so the alternation stays anchored.
 */
export const BETA_VIDEO_URL_REGEX = new RegExp(`(?:${INSTAGRAM_URL_REGEX.source})|(?:${TIKTOK_URL_REGEX.source})`, 'i');

export const BETA_VIDEO_URL_VALIDATION_MESSAGE = 'Needs to be an Instagram or TikTok URL';

export function isInstagramUrl(url: string): boolean {
  return INSTAGRAM_URL_REGEX.test(url);
}

export function isTikTokUrl(url: string): boolean {
  return TIKTOK_URL_REGEX.test(url);
}

export function isBetaVideoUrl(url: string): boolean {
  return isInstagramUrl(url) || isTikTokUrl(url);
}

export function getInstagramMediaId(url: string): string | null {
  const match = url.match(INSTAGRAM_URL_REGEX);
  return match?.[1] ?? null;
}

/**
 * Numeric video id for long-form `/@user/video/<id>` TikTok URLs. Short links
 * (`vm.tiktok.com/<short>`, `t.tiktok.com/<short>`) return null — we don't
 * unfold them.
 */
export function getTikTokVideoId(url: string): string | null {
  const match = url.match(TIKTOK_LONG_FORM_VIDEO_ID);
  return match?.[1] ?? null;
}

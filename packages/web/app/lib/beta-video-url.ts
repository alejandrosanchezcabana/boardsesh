import { isInstagramUrl } from './instagram-url';
import { isTikTokUrl } from './tiktok-url';

/** True if `url` is an Instagram or TikTok URL we can attach as a beta video. */
export function isBetaVideoUrl(url: string): boolean {
  return isInstagramUrl(url) || isTikTokUrl(url);
}

export const BETA_VIDEO_URL_VALIDATION_MESSAGE = 'Needs to be an Instagram or TikTok URL';

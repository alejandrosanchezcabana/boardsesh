import { getInstagramMediaId, INSTAGRAM_URL_REGEX, isInstagramUrl } from '@boardsesh/shared-schema';

export { INSTAGRAM_URL_REGEX, isInstagramUrl, getInstagramMediaId };

export function getInstagramEmbedUrl(url: string): string | null {
  const mediaId = getInstagramMediaId(url);
  if (mediaId) {
    return `https://www.instagram.com/p/${mediaId}/embed`;
  }
  return null;
}

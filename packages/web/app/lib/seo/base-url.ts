export const SITE_URL = 'https://www.boardsesh.com';

export function absoluteUrl(path = '/'): string {
  if (!path.startsWith('/')) {
    return `${SITE_URL}/${path}`;
  }
  return `${SITE_URL}${path}`;
}

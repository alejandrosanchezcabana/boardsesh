export const SITE_URL = 'https://www.boardsesh.com';

export function absoluteUrl(path = '/'): string {
  // Canonical site URL has no trailing slash, so the homepage is just SITE_URL.
  // This matches the convention sitemap consumers (and our snapshot tests) expect.
  if (path === '' || path === '/') {
    return SITE_URL;
  }
  if (!path.startsWith('/')) {
    return `${SITE_URL}/${path}`;
  }
  return `${SITE_URL}${path}`;
}

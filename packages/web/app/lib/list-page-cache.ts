import { SUPPORTED_BOARDS } from '@/app/lib/board-data';

/** Search params that indicate user-specific queries — must not be CDN-cached. */
const USER_SPECIFIC_PARAMS = ['hideAttempted', 'hideCompleted', 'showOnlyAttempted', 'showOnlyCompleted', 'onlyDrafts'];

/**
 * Returns the appropriate Cache-Control header value for a list page request,
 * or null if the request is not a list page.
 */
export function getListPageCacheControl(pathname: string, searchParams: URLSearchParams): string | null {
  // Fast-path: skip parsing for routes that clearly aren't list pages
  if (!pathname.endsWith('/list')) {
    return null;
  }

  const pathParts = pathname.split('/').filter(Boolean);

  // Must end with /list and have at least 6 segments: board/layout/size/sets/angle/list
  if (pathParts.length < 6 || pathParts[pathParts.length - 1] !== 'list') {
    return null;
  }

  // First segment must be a supported board
  if (!(SUPPORTED_BOARDS as readonly string[]).includes(pathParts[0].toLowerCase())) {
    return null;
  }

  const hasUserSpecificParams = USER_SPECIFIC_PARAMS.some((param) => {
    const value = searchParams.get(param);
    return value === 'true' || value === '1';
  });

  if (hasUserSpecificParams) {
    return 'private, no-store';
  }

  return 'public, s-maxage=86400, stale-while-revalidate=604800';
}

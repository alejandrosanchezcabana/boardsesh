import { SUPPORTED_BOARDS } from '@/app/lib/board-data';

/** Search params that indicate user-specific queries — must not be CDN-cached. */
const USER_SPECIFIC_PARAMS = ['hideAttempted', 'hideCompleted', 'showOnlyAttempted', 'showOnlyCompleted', 'onlyDrafts'];

/**
 * Checks whether a request is a cacheable list page and returns the CDN cache
 * duration in seconds, or null if the request should not be CDN-cached.
 *
 * User-specific params (hideAttempted, etc.) only prevent caching when the
 * request has an authenticated session — matching the GraphQL resolver logic
 * where userId is only resolved when user-specific filters are active.
 * Without a session these params have no effect on query results.
 *
 * Matches both URL formats:
 *   - /[board]/[layout]/[size]/[sets]/[angle]/list  (legacy numeric)
 *   - /b/[board_slug]/[angle]/list                  (new slug format)
 */
export function getListPageCacheTTL(pathname: string, searchParams: URLSearchParams, hasSession: boolean): number | null {
  // Fast-path: skip parsing for routes that clearly aren't list pages
  if (!pathname.endsWith('/list')) {
    return null;
  }

  const pathParts = pathname.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  if (lastPart !== 'list') {
    return null;
  }

  const isLegacyFormat =
    pathParts.length >= 6 &&
    (SUPPORTED_BOARDS as readonly string[]).includes(pathParts[0].toLowerCase());

  const isSlugFormat =
    pathParts.length >= 4 &&
    pathParts[0] === 'b';

  if (!isLegacyFormat && !isSlugFormat) {
    return null;
  }

  // User-specific params only matter when there's an authenticated session.
  // Without a session, these params have no effect on query results (the DB
  // query ignores them without a userId), so the response is still cacheable.
  if (hasSession) {
    const hasUserSpecificParams = USER_SPECIFIC_PARAMS.some((param) => {
      const value = searchParams.get(param);
      return value === 'true' || value === '1';
    });

    if (hasUserSpecificParams) {
      return null;
    }
  }

  return 86400; // 24 hours
}

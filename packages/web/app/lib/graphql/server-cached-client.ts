import "server-only";
import { unstable_cache } from "next/cache";
import { GraphQLClient, RequestDocument, Variables } from "graphql-request";
import { sortObjectKeys } from "@/app/lib/cache-utils";
import { getGraphQLHttpUrl } from "./client";
import { executeAuthenticatedGraphQL } from "./server-graphql";

// Re-export uncached authenticated server functions so existing imports
// from this file continue to work without changes.
export { serverMyBoards, serverUserPlaylists, serverGroupedNotifications } from "./server-graphql";

/**
 * Execute a GraphQL query via HTTP (non-cached version for internal use)
 */
async function executeGraphQLInternal<T = unknown, V extends Variables = Variables>(
  document: RequestDocument,
  variables?: V,
): Promise<T> {
  const url = getGraphQLHttpUrl();
  const client = new GraphQLClient(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return client.request<T>(document, variables);
}

/**
 * Create a stable cache key from GraphQL variables
 * Recursively sorts all object keys to ensure consistent key generation
 */
function createCacheKeyFromVariables(variables: Variables | undefined): string[] {
  if (!variables) return ["no-variables"];

  // Recursively sort all keys for stable JSON representation
  const sortedVariables = sortObjectKeys(variables);
  return [JSON.stringify(sortedVariables)];
}

/**
 * Execute a cached GraphQL query for server-side rendering
 *
 * Uses Next.js unstable_cache to cache results at the data cache layer.
 * This ensures repeated requests with the same parameters return cached data.
 *
 * @param document - GraphQL query document
 * @param variables - Query variables
 * @param cacheTag - Tag for cache invalidation (e.g., 'climb-search')
 * @param revalidate - Cache duration in seconds
 */
export function createCachedGraphQLQuery<T = unknown, V extends Variables = Variables>(
  document: RequestDocument,
  cacheTag: string,
  revalidate: number,
) {
  return async (variables?: V): Promise<T> => {
    const cachedFn = unstable_cache(
      async () => executeGraphQLInternal<T, V>(document, variables),
      ["graphql", cacheTag, ...createCacheKeyFromVariables(variables)],
      {
        revalidate,
        tags: [cacheTag],
      },
    );

    return cachedFn();
  };
}

/**
 * Cached server-side session-grouped feed query.
 * Used for SSR on the home page for both authenticated and unauthenticated users.
 */
export async function cachedSessionGroupedFeed(
  boardUuid?: string,
  isAuthenticated: boolean = false,
) {
  const { GET_SESSION_GROUPED_FEED } = await import("@/app/lib/graphql/operations/activity-feed");

  const revalidate = isAuthenticated ? 300 : 86400;

  const query = createCachedGraphQLQuery<{
    sessionGroupedFeed: import("@boardsesh/shared-schema").SessionFeedResult;
  }>(
    GET_SESSION_GROUPED_FEED,
    isAuthenticated ? "session-grouped-feed-auth" : "session-grouped-feed-public",
    revalidate,
  );

  const result = await query({ input: { boardUuid, limit: 20 } });
  return result.sessionGroupedFeed;
}

/**
 * Cached, authenticated server-side session feed for a specific user.
 * Used for SSR on the /you/sessions page.
 * Cache is per-user (tag includes userId) with a 2-minute TTL.
 */
export async function cachedUserSessionGroupedFeed(authToken: string, userId: string) {
  const { GET_SESSION_GROUPED_FEED } = await import("@/app/lib/graphql/operations/activity-feed");

  type Response = { sessionGroupedFeed: import("@boardsesh/shared-schema").SessionFeedResult };
  const tag = `user-session-feed-${userId}`;

  const cachedFn = unstable_cache(
    async () => {
      const result = await executeAuthenticatedGraphQL<Response>(
        GET_SESSION_GROUPED_FEED,
        { input: { userId, limit: 20 } },
        authToken,
      );
      return result.sessionGroupedFeed;
    },
    ["graphql", tag, JSON.stringify({ userId })],
    { revalidate: 120, tags: [tag] },
  );

  return cachedFn();
}

/**
 * Server-side cached fetch of discover playlists (public, no auth needed).
 */
export async function cachedDiscoverPlaylists(
  input: { boardType?: string; layoutId?: number } = {},
): Promise<{
  popular: import("@/app/lib/graphql/operations/playlists").DiscoverablePlaylist[];
  recent: import("@/app/lib/graphql/operations/playlists").DiscoverablePlaylist[];
} | null> {
  const { DISCOVER_PLAYLISTS } = await import("@/app/lib/graphql/operations/playlists");
  type Response = import("@/app/lib/graphql/operations/playlists").DiscoverPlaylistsQueryResponse;

  try {
    const popularQuery = createCachedGraphQLQuery<Response>(
      DISCOVER_PLAYLISTS,
      "discover-playlists-popular",
      300, // 5 min cache
    );
    const recentQuery = createCachedGraphQLQuery<Response>(
      DISCOVER_PLAYLISTS,
      "discover-playlists-recent",
      300,
    );

    const [popularRes, recentRes] = await Promise.all([
      popularQuery({ input: { ...input, pageSize: 10, sortBy: "popular" } }),
      recentQuery({ input: { ...input, pageSize: 10, sortBy: "recent" } }),
    ]);

    return {
      popular: popularRes.discoverPlaylists.playlists,
      recent: recentRes.discoverPlaylists.playlists,
    };
  } catch {
    return null;
  }
}

/**
 * Cached server-side fetch of user profile stats (public, no auth needed).
 */
export async function cachedUserProfileStats(
  userId: string,
): Promise<
  | import("@/app/lib/graphql/operations/ticks").GetUserProfileStatsQueryResponse["userProfileStats"]
  | null
> {
  const { GET_USER_PROFILE_STATS } = await import("@/app/lib/graphql/operations/ticks");
  type Response = import("@/app/lib/graphql/operations/ticks").GetUserProfileStatsQueryResponse;

  try {
    const tag = `user-profile-stats-${userId}`;
    const query = createCachedGraphQLQuery<Response>(GET_USER_PROFILE_STATS, tag, 300);
    const result = await query({ userId });
    return result.userProfileStats;
  } catch {
    return null;
  }
}

/**
 * Cached server-side fetch of user ticks for a specific board type (public, no auth needed).
 */
export async function cachedUserTicks(
  userId: string,
  boardType: string,
): Promise<
  import("@/app/lib/graphql/operations/ticks").GetUserTicksQueryResponse["userTicks"] | null
> {
  const { GET_USER_TICKS } = await import("@/app/lib/graphql/operations/ticks");
  type Response = import("@/app/lib/graphql/operations/ticks").GetUserTicksQueryResponse;

  try {
    const tag = `user-ticks-${userId}-${boardType}`;
    const query = createCachedGraphQLQuery<Response>(GET_USER_TICKS, tag, 300);
    const result = await query({ userId, boardType });
    return result.userTicks;
  } catch {
    return null;
  }
}

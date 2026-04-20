import 'server-only';
import { GraphQLClient, RequestDocument, Variables } from 'graphql-request';
import { getGraphQLHttpUrl } from './client';
import type { GroupedNotificationConnection } from '@boardsesh/shared-schema';

/**
 * Execute a GraphQL query with an auth token (non-cached, per-user data).
 * Used for server-side rendering of authenticated pages where results
 * should not be shared across users or requests.
 * Also used by server-cached-client.ts for cached-but-authenticated queries.
 */
export async function executeAuthenticatedGraphQL<T = unknown, V extends Variables = Variables>(
  document: RequestDocument,
  variables?: V,
  authToken?: string,
): Promise<T> {
  const url = getGraphQLHttpUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const client = new GraphQLClient(url, { headers });
  return client.request<T>(document, variables);
}

/**
 * Server-side fetch of the current user's boards (owned + followed).
 * NOT cached — personalized data is per-user.
 */
export async function serverMyBoards(
  authToken: string,
): Promise<import('@boardsesh/shared-schema').UserBoard[] | null> {
  const { GET_MY_BOARDS } = await import('@/app/lib/graphql/operations/boards');
  type GetMyBoardsQueryResponse = import('@/app/lib/graphql/operations/boards').GetMyBoardsQueryResponse;

  try {
    const response = await executeAuthenticatedGraphQL<GetMyBoardsQueryResponse>(
      GET_MY_BOARDS,
      { input: { limit: 50, offset: 0 } },
      authToken,
    );
    return response.myBoards.boards;
  } catch {
    return null;
  }
}

/**
 * Server-side fetch of the user's playlists (authenticated, not cached).
 */
export async function serverUserPlaylists(
  authToken: string,
  input: { boardType?: string; layoutId?: number } = {},
): Promise<import('@/app/lib/graphql/operations/playlists').Playlist[] | null> {
  const { GET_ALL_USER_PLAYLISTS } = await import('@/app/lib/graphql/operations/playlists');
  type Response = import('@/app/lib/graphql/operations/playlists').GetAllUserPlaylistsQueryResponse;

  try {
    const response = await executeAuthenticatedGraphQL<Response>(
      GET_ALL_USER_PLAYLISTS,
      { input },
      authToken,
    );
    return response.allUserPlaylists;
  } catch {
    return null;
  }
}

/**
 * Fetch the first page of grouped notifications server-side.
 * Returns null on failure so the client can fall back to client-side fetching.
 */
export async function serverGroupedNotifications(
  authToken: string,
  limit: number = 20,
  offset: number = 0,
): Promise<GroupedNotificationConnection> {
  const { GET_GROUPED_NOTIFICATIONS } = await import('@/app/lib/graphql/operations/notifications');
  type Response = { groupedNotifications: GroupedNotificationConnection };

  const data = await executeAuthenticatedGraphQL<Response>(
    GET_GROUPED_NOTIFICATIONS,
    { limit, offset },
    authToken,
  );

  return data.groupedNotifications;
}

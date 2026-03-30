import React from 'react';
import 'server-only';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  GET_POPULAR_BOARD_CONFIGS,
  type GetPopularBoardConfigsQueryResponse,
} from '@/app/lib/graphql/operations';
import type { PopularBoardConfig } from '@boardsesh/shared-schema';

/**
 * Fetches popular board configurations server-side via the GraphQL backend.
 * Uses React.cache() for request deduplication within a single server render.
 * The backend caches the result for 30 days, so this is effectively free after the first call.
 */
export const getPopularBoardConfigs = React.cache(async (): Promise<PopularBoardConfig[]> => {
  try {
    const client = createGraphQLHttpClient();
    const result = await client.request<GetPopularBoardConfigsQueryResponse>(
      GET_POPULAR_BOARD_CONFIGS,
      { input: { limit: 12, offset: 0 } },
    );
    return result.popularBoardConfigs.configs;
  } catch (err) {
    console.error('Failed to SSR popular board configs:', err);
    return [];
  }
});

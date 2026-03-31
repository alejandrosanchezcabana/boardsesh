import { db } from '../../client';
import { searchClimbs as sharedSearchClimbs, type BoardRouteParams, type ClimbSearchParams } from '@boardsesh/db/queries';
import { getSizeEdges } from '../util/product-sizes-data';
import type { Climb, ClimbSearchResult } from '@boardsesh/shared-schema';

// Re-export shared types for backward compatibility
export type { ClimbSearchParams, BoardRouteParams as ParsedBoardRouteParameters };

export const searchClimbs = async (
  params: BoardRouteParams,
  searchParams: ClimbSearchParams,
  userId?: string,
): Promise<ClimbSearchResult> => {
  const sizeEdges = getSizeEdges(params.board_name, params.size_id);
  if (!sizeEdges) {
    return { climbs: [], totalCount: 0, hasMore: false };
  }

  try {
    const result = await sharedSearchClimbs(db, params, searchParams, sizeEdges, userId);

    // Map ClimbRow to Climb (add fields expected by the GraphQL schema)
    const climbs: Climb[] = result.climbs.map((row) => ({
      ...row,
      mirrored: null,
      userAscents: null,
      userAttempts: null,
    }));

    return {
      climbs,
      hasMore: result.hasMore,
      totalCount: 0, // Resolved lazily by the totalCount field resolver
    };
  } catch (error) {
    console.error('Error in searchClimbs:', error);
    throw error;
  }
};

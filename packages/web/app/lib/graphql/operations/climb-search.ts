import { gql } from 'graphql-request';
import type { Climb, HoldState } from '@/app/lib/types';

// Slim fragment for search/list views (no description or mirrored - unused in list/card)
const CLIMB_SEARCH_FIELDS = `
  uuid
  setter_username
  name
  frames
  angle
  ascensionist_count
  difficulty
  quality_average
  stars
  difficulty_error
  benchmark_difficulty
  is_draft
`;

// Full fragment for single-climb views that need all fields
const CLIMB_DETAIL_FIELDS = `
  uuid
  setter_username
  name
  description
  frames
  angle
  ascensionist_count
  difficulty
  quality_average
  stars
  difficulty_error
  mirrored
  benchmark_difficulty
  userAscents
  userAttempts
`;

export const SEARCH_CLIMBS = gql`
  query SearchClimbs($input: ClimbSearchInput!) {
    searchClimbs(input: $input) {
      climbs {
        ${CLIMB_SEARCH_FIELDS}
      }
      hasMore
    }
  }
`;

export const SEARCH_CLIMBS_COUNT = gql`
  query SearchClimbsCount($input: ClimbSearchInput!) {
    searchClimbs(input: $input) {
      totalCount
    }
  }
`;

export const GET_CLIMB = gql`
  query GetClimb(
    $boardName: String!
    $layoutId: Int!
    $sizeId: Int!
    $setIds: String!
    $angle: Int!
    $climbUuid: ID!
  ) {
    climb(
      boardName: $boardName
      layoutId: $layoutId
      sizeId: $sizeId
      setIds: $setIds
      angle: $angle
      climbUuid: $climbUuid
    ) {
      ${CLIMB_DETAIL_FIELDS}
    }
  }
`;

// Type for the search input
export interface ClimbSearchInputVariables {
  input: {
    boardName: string;
    layoutId: number;
    sizeId: number;
    setIds: string;
    angle: number;
    page?: number;
    pageSize?: number;
    gradeAccuracy?: string;
    minGrade?: number;
    maxGrade?: number;
    minAscents?: number;
    sortBy?: string;
    sortOrder?: string;
    name?: string;
    setter?: string[];
    onlyTallClimbs?: boolean;
    holdsFilter?: Record<string, HoldState>;
    hideAttempted?: boolean;
    hideCompleted?: boolean;
    showOnlyAttempted?: boolean;
    showOnlyCompleted?: boolean;
    onlyDrafts?: boolean;
  };
}

// Type for the search response - uses the Climb type from the app
export interface ClimbSearchResponse {
  searchClimbs: {
    climbs: Climb[];
    totalCount?: number;
    hasMore: boolean;
  };
}

export interface ClimbSearchCountResponse {
  searchClimbs: {
    totalCount: number;
  };
}

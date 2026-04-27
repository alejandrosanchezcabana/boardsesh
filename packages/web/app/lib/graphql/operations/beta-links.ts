import { gql } from 'graphql-request';

export const GET_BETA_LINKS = gql`
  query GetBetaLinks($boardType: String!, $climbUuid: String!) {
    betaLinks(boardType: $boardType, climbUuid: $climbUuid) {
      climbUuid
      link
      foreignUsername
      angle
      thumbnail
      isListed
      createdAt
    }
  }
`;

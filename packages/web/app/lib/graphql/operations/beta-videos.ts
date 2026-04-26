import { gql } from 'graphql-request';

export const GET_BETA_VIDEOS = gql`
  query GetBetaVideos($boardType: String!, $climbUuid: String!) {
    betaVideos(boardType: $boardType, climbUuid: $climbUuid) {
      uuid
      userId
      userDisplayName
      userAvatarUrl
      boardType
      climbUuid
      angle
      bunnyVideoId
      status
      thumbnailUrl
      playbackUrl
      duration
      createdAt
    }
  }
`;

export const GET_BETA_VIDEO = gql`
  query GetBetaVideo($uuid: ID!) {
    betaVideo(uuid: $uuid) {
      uuid
      userId
      userDisplayName
      userAvatarUrl
      boardType
      climbUuid
      angle
      bunnyVideoId
      status
      thumbnailUrl
      playbackUrl
      duration
      createdAt
    }
  }
`;

export const CREATE_BETA_VIDEO = gql`
  mutation CreateBetaVideo($input: CreateBetaVideoInput!) {
    createBetaVideo(input: $input) {
      uuid
      uploadUrl
      authorizationSignature
      authorizationExpire
      videoId
      libraryId
    }
  }
`;

export const DELETE_BETA_VIDEO = gql`
  mutation DeleteBetaVideo($uuid: ID!) {
    deleteBetaVideo(uuid: $uuid)
  }
`;

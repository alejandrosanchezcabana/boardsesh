export const betaVideosTypeDefs = /* GraphQL */ `
  """
  A beta video uploaded to Boardsesh via Bunny Stream.
  """
  type BetaVideo {
    uuid: ID!
    userId: ID
    userDisplayName: String
    userAvatarUrl: String
    boardType: String!
    climbUuid: String!
    angle: Int
    bunnyVideoId: String!
    status: String!
    thumbnailUrl: String
    playbackUrl: String
    duration: Float
    createdAt: String!
  }

  """
  Input for creating a new beta video upload.
  """
  input CreateBetaVideoInput {
    boardType: String!
    climbUuid: String!
    angle: Int
    title: String
  }

  """
  Result of creating a beta video, includes TUS upload credentials
  for direct browser-to-Bunny upload.
  """
  type CreateBetaVideoResult {
    uuid: ID!
    uploadUrl: String!
    authorizationSignature: String!
    authorizationExpire: Int!
    videoId: String!
    libraryId: String!
  }

  """
  An external Instagram beta link attached to a climb.
  Thumbnail (when present) is served from our own S3 bucket.
  """
  type BetaLink {
    climbUuid: String!
    link: String!
    foreignUsername: String
    angle: Int
    thumbnail: String
    isListed: Boolean
    createdAt: String
  }
`;

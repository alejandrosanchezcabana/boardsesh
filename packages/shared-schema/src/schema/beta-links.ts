export const betaLinksTypeDefs = /* GraphQL */ `
  """
  An external Instagram or TikTok beta link attached to a climb.
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

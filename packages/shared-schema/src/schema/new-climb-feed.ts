export const newClimbFeedTypeDefs = /* GraphQL */ `
  # ============================================
  # New Climb Feed & Subscriptions
  # ============================================

  type NewClimbSubscription {
    id: ID!
    boardType: String!
    layoutId: Int!
    createdAt: String!
  }

  input NewClimbSubscriptionInput {
    boardType: String!
    layoutId: Int!
  }

  type NewClimbFeedItem {
    uuid: ID!
    name: String
    boardType: String!
    layoutId: Int!
    setterDisplayName: String
    setterAvatarUrl: String
    angle: Int
    frames: String
    difficultyName: String
    "Whether matching is disallowed on this climb"
    isNoMatch: Boolean!
    createdAt: String!
  }

  type NewClimbFeedResult {
    items: [NewClimbFeedItem!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  input NewClimbFeedInput {
    boardType: String!
    layoutId: Int!
    limit: Int
    offset: Int
  }

  input MoonBoardHoldsInput {
    start: [String!]!
    hand: [String!]!
    finish: [String!]!
  }

  input MoonBoardClimbDuplicateCandidateInput {
    clientKey: String!
    holds: MoonBoardHoldsInput!
  }

  input CheckMoonBoardClimbDuplicatesInput {
    layoutId: Int!
    angle: Int!
    climbs: [MoonBoardClimbDuplicateCandidateInput!]!
  }

  type MoonBoardClimbDuplicateMatch {
    clientKey: String!
    exists: Boolean!
    existingClimbUuid: ID
    existingClimbName: String
  }

  type NewClimbCreatedEvent {
    climb: NewClimbFeedItem!
  }

  input SaveClimbInput {
    boardType: String!
    layoutId: Int!
    name: String!
    description: String
    isDraft: Boolean!
    frames: String!
    framesCount: Int
    framesPace: Int
    angle: Int!
  }

  input SaveMoonBoardClimbInput {
    boardType: String!
    layoutId: Int!
    name: String!
    description: String
    holds: MoonBoardHoldsInput!
    angle: Int!
    isDraft: Boolean
    userGrade: String
    isBenchmark: Boolean
    setter: String
  }

  type SaveClimbResult {
    uuid: ID!
    synced: Boolean!
    "ISO timestamp of when the row was created"
    createdAt: String
    "ISO timestamp of when the row was first published (null while still a draft)"
    publishedAt: String
  }

  """
  Input for updating an existing climb. Only the climb's owner can update
  the row, and only while it is still a draft OR within 24 hours of its
  first publish.
  """
  input UpdateClimbInput {
    uuid: ID!
    boardType: String!
    name: String
    description: String
    frames: String
    angle: Int
    "When set, flips the draft state. A climb can go from draft→published but not the other way around."
    isDraft: Boolean
    framesCount: Int
    framesPace: Int
  }

  type UpdateClimbResult {
    uuid: ID!
    createdAt: String
    publishedAt: String
    isDraft: Boolean!
  }
`;

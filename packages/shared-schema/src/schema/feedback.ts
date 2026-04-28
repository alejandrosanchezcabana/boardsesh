export const feedbackTypeDefs = /* GraphQL */ `
  """
  Free-form debug context attached to a feedback submission. Stored as jsonb.
  Every field is optional — anonymous submissions made outside a board route
  may carry only \`url\` / \`userAgent\`.
  """
  input FeedbackContextInput {
    climbUuid: String
    climbName: String
    difficulty: String
    sessionId: String
    sessionName: String
    url: String
    userAgent: String
  }

  """
  Input for submitAppFeedback mutation.
  """
  input SubmitAppFeedbackInput {
    """
    1–5 star rating. Null for bug reports.
    """
    rating: Int

    """
    Optional free-text comment. Required for bug-report sources; typically
    present for rating sources when rating is below 3.
    """
    comment: String

    """
    'ios' | 'android' | 'web'.
    """
    platform: String!

    """
    App build version (native) or deployed web version. Optional.
    """
    appVersion: String

    """
    Where the feedback originated: 'prompt' | 'drawer-feedback' (rating flows)
    or 'shake-bug' | 'drawer-bug' (bug reports).
    """
    source: String!

    """
    Board the user is climbing on (\`kilter\` | \`tension\` | \`moonboard\`).
    Null when submission happens outside a board context.
    """
    boardName: String
    layoutId: Int
    sizeId: Int
    setIds: [Int!]
    angle: Int

    """
    Optional debug context (current climb, party session, URL, user agent).
    """
    context: FeedbackContextInput
  }
`;

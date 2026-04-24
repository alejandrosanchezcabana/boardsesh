export const feedbackTypeDefs = /* GraphQL */ `
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
  }
`;

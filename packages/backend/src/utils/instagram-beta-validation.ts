import { GraphQLError } from 'graphql';
import { fetchInstagramMeta, getInstagramMediaId } from '../lib/instagram-meta';

// Extends GraphQLError so the user-facing message survives Yoga's
// `maskedErrors: true` in production. Plain Error subclasses are replaced
// with the generic "Unexpected error." string before reaching the client,
// which would surface as the fallback "Couldn't add video. Try again."
// toast instead of our specific guidance ("post is private/deleted",
// "already linked to <other climb>", "Instagram is temporarily blocking
// us", etc.).
export class InstagramBetaValidationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'INSTAGRAM_BETA_VALIDATION' } });
    this.name = 'InstagramBetaValidationError';
  }
}

const GENERIC_VALIDATION_ERROR = "We couldn't read this Instagram link. Double-check the URL and try again.";
const POST_UNAVAILABLE_ERROR = "This Instagram post isn't available — it may be private, deleted, or region-locked.";
const TRANSIENT_ERROR = 'Instagram is temporarily blocking us from previewing this link. Try again in a minute.';

export interface InstagramPageMetadata {
  imageUrl: string | null;
  mediaId: string;
  username: string | null;
}

export async function validateInstagramBetaLink(url: string): Promise<InstagramPageMetadata> {
  const mediaId = getInstagramMediaId(url);
  // mediaId is the canonical identity for the post (used for dedup + S3 cache
  // key). Without it we can't safely persist regardless of what Instagram
  // returns.
  if (!mediaId) {
    throw new InstagramBetaValidationError(GENERIC_VALIDATION_ERROR);
  }

  // fetchInstagramMeta is designed to return a status enum rather than throw,
  // but a try/catch keeps any unexpected runtime error (regex/JSON edge case,
  // dependency change) inside the InstagramBetaValidationError envelope so
  // Yoga's maskedErrors: true doesn't surface a generic "Unexpected error."
  // toast to the user.
  let result;
  try {
    result = await fetchInstagramMeta(url);
  } catch {
    throw new InstagramBetaValidationError(TRANSIENT_ERROR);
  }

  if (result.status === 'gone') {
    throw new InstagramBetaValidationError(POST_UNAVAILABLE_ERROR);
  }

  if (result.status === 'transient_error') {
    throw new InstagramBetaValidationError(TRANSIENT_ERROR);
  }

  return {
    // Normalize empty-string thumbnail to null so downstream consumers that
    // null-check (rather than truthy-check) imageUrl behave consistently with
    // the previous validator's contract.
    imageUrl: result.thumbnail || null,
    mediaId,
    username: result.username,
  };
}

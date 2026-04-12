import type { Climb } from '@/app/lib/types';

// Users can edit their own drafts indefinitely, and their own published
// climbs for the first 24 hours after publish. The backend enforces the
// same window; this mirror-on-the-client keeps the UI in sync so peers
// don't see a useless Edit affordance.
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Decide whether the signed-in user can edit a given climb.
 *
 * Ownership is gated on the immutable Boardsesh `userId` rather than the
 * mutable `setter_username`. Using a display name would mean:
 *
 *   1. A user who renames themselves suddenly loses Edit on their own
 *      climbs, even though the backend still considers them the owner.
 *   2. Two signed-in users with colliding usernames could each see the
 *      Edit button on climbs they don't own (the backend would reject
 *      the update, but the UI would mislead them).
 *   3. Climbs where `setter_username` is blank (possible when the session
 *      doesn't expose a display name at save time) would pass the
 *      `username === currentUsername` check for any signed-in user, since
 *      the original gate short-circuited on falsy usernames.
 *
 * Party queue items round-trip `userId` through the `ClimbInput` GraphQL
 * type so peers can run this check locally without a backend hop.
 */
export function isClimbEditable(
  climb: Climb,
  opts: {
    currentUserId: string | null | undefined;
    hasBoardRoute: boolean;
    now?: number;
  },
): boolean {
  // The Edit target lives under /b/{slug}/{angle}/create. When we're not
  // on a board-slug-shaped route, we can't build a URL so the affordance
  // is hidden entirely.
  if (!opts.hasBoardRoute) return false;
  if (!opts.currentUserId) return false;
  // Ownership must match by userId. Aurora-synced climbs have a null
  // userId, which also correctly fails this check — no one can edit them.
  if (!climb.userId || climb.userId !== opts.currentUserId) return false;
  if (climb.is_draft) return true;
  if (!climb.published_at) return false;
  const publishedMs = Date.parse(climb.published_at);
  if (!Number.isFinite(publishedMs)) return false;
  const now = opts.now ?? Date.now();
  return now - publishedMs <= EDIT_WINDOW_MS;
}

import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';

/**
 * Batch-fetch the set of playlist UUIDs that the given user has pinned, out
 * of a candidate list. Returns an empty Set when the user is not
 * authenticated (so unauthenticated callers always see `isPinnedByMe = false`
 * without an extra round-trip).
 *
 * Mirrors getPlaylistFollowStats but pins are scoped per-user only — there
 * is no aggregate pin count. The userPlaylistPins table joins by playlist
 * id, so we resolve uuids first.
 */
export async function getPlaylistPinSet(playlistUuids: string[], currentUserId: string | null): Promise<Set<string>> {
  if (!currentUserId || playlistUuids.length === 0) return new Set();

  const rows = await db
    .select({ uuid: dbSchema.playlists.uuid })
    .from(dbSchema.userPlaylistPins)
    .innerJoin(dbSchema.playlists, eq(dbSchema.userPlaylistPins.playlistId, dbSchema.playlists.id))
    .where(and(eq(dbSchema.userPlaylistPins.userId, currentUserId), inArray(dbSchema.playlists.uuid, playlistUuids)));

  return new Set(rows.map((r) => r.uuid));
}

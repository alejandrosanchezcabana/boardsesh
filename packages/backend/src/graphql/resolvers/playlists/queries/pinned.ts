import { eq, and, or, isNull, desc, inArray } from 'drizzle-orm';
import type { ConnectionContext } from '@boardsesh/shared-schema';
import { db } from '../../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { requireAuthenticated, validateInput } from '../../shared/helpers';
import { GetMyPinnedPlaylistsInputSchema } from '../../../../validation/schemas';
import { getPlaylistFollowStats } from '../helpers/follow-stats';
import { getClimbCounts, formatOwnedPlaylist, type OwnedPlaylistRow } from '../helpers/enrichment';

/**
 * Server-side cap. The pinned grid is a small surface; pins beyond this cap
 * are not surfaced (overflow is not shown — owned playlists also live in
 * "Jump Back In", but pins on other users' public playlists do not).
 */
const PINNED_LIMIT = 12;

const PINNED_SELECT = {
  id: dbSchema.playlists.id,
  uuid: dbSchema.playlists.uuid,
  boardType: dbSchema.playlists.boardType,
  layoutId: dbSchema.playlists.layoutId,
  name: dbSchema.playlists.name,
  description: dbSchema.playlists.description,
  isPublic: dbSchema.playlists.isPublic,
  color: dbSchema.playlists.color,
  icon: dbSchema.playlists.icon,
  createdAt: dbSchema.playlists.createdAt,
  updatedAt: dbSchema.playlists.updatedAt,
  lastAccessedAt: dbSchema.playlists.lastAccessedAt,
  pinnedAt: dbSchema.userPlaylistPins.createdAt,
} as const;

/**
 * Get the authenticated user's pinned playlists. Pins are user-scoped:
 * a user can pin their own private/public playlists or anyone's public
 * playlist. Ordering is most-recently-pinned first.
 */
export const myPinnedPlaylists = async (
  _: unknown,
  { input }: { input: { boardType?: string; layoutId?: number } },
  ctx: ConnectionContext,
): Promise<unknown[]> => {
  requireAuthenticated(ctx);
  validateInput(GetMyPinnedPlaylistsInputSchema, input, 'input');

  const userId = ctx.userId!;

  const conditions = [eq(dbSchema.userPlaylistPins.userId, userId)];

  if (input.boardType) {
    conditions.push(eq(dbSchema.playlists.boardType, input.boardType));
  }

  if (input.layoutId != null) {
    const layoutCondition = or(eq(dbSchema.playlists.layoutId, input.layoutId), isNull(dbSchema.playlists.layoutId));
    if (layoutCondition) {
      conditions.push(layoutCondition);
    }
  }

  const rows = await db
    .select(PINNED_SELECT)
    .from(dbSchema.userPlaylistPins)
    .innerJoin(dbSchema.playlists, eq(dbSchema.userPlaylistPins.playlistId, dbSchema.playlists.id))
    .where(and(...conditions))
    .orderBy(desc(dbSchema.userPlaylistPins.createdAt))
    .limit(PINNED_LIMIT);

  // Pinned playlists may be owned by other users — look up the current
  // user's role (if any) for each pinned playlist. Scope by playlist id
  // (mirrors getPlaylistFollowStats) so users with large libraries don't
  // pull their entire ownership table into memory just to discard it.
  const pinnedIds = rows.map((r) => r.id);
  const ownership = pinnedIds.length
    ? await db
        .select({
          playlistId: dbSchema.playlistOwnership.playlistId,
          role: dbSchema.playlistOwnership.role,
        })
        .from(dbSchema.playlistOwnership)
        .where(
          and(eq(dbSchema.playlistOwnership.userId, userId), inArray(dbSchema.playlistOwnership.playlistId, pinnedIds)),
        )
    : [];
  const roleByPlaylistId = new Map(ownership.map((o) => [o.playlistId.toString(), o.role]));

  const owned: OwnedPlaylistRow[] = rows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    boardType: row.boardType,
    layoutId: row.layoutId,
    name: row.name,
    description: row.description,
    isPublic: row.isPublic,
    color: row.color,
    icon: row.icon,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastAccessedAt: row.lastAccessedAt,
    role: roleByPlaylistId.get(row.id.toString()) ?? 'viewer',
  }));

  const climbCounts = await getClimbCounts(owned.map((p) => p.id));
  const followStats = await getPlaylistFollowStats(
    owned.map((p) => p.uuid),
    userId,
  );
  // Every row here is pinned by definition — short-circuit the lookup.
  const pinSet = new Set(owned.map((p) => p.uuid));
  return owned.map((p) => formatOwnedPlaylist(p, climbCounts, followStats, pinSet));
};

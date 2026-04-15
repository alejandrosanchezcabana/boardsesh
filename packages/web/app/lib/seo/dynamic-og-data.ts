import 'server-only';

import { cache } from 'react';
import { sql as drizzleSql } from 'drizzle-orm';
import { dbz, sql as rawSql } from '@/app/lib/db/db';
import { buildOgVersionToken } from './og';

export type ProfileOgSummary = {
  displayName: string;
  avatarUrl: string | null;
  fallbackImageUrl: string | null;
  version: string;
};

export const getProfileOgSummary = cache(async (userId: string): Promise<ProfileOgSummary | null> => {
  const rows = (await rawSql`
    SELECT
      u.name,
      u.image,
      p.display_name,
      p.avatar_url,
      GREATEST(
        COALESCE(u.updated_at, to_timestamp(0)),
        COALESCE(p.updated_at, to_timestamp(0)),
        COALESCE((SELECT MAX(bt.updated_at) FROM boardsesh_ticks bt WHERE bt.user_id = ${userId}), to_timestamp(0))
      ) AS version_at
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `) as Array<{
    name: string | null;
    image: string | null;
    display_name: string | null;
    avatar_url: string | null;
    version_at: string | Date | null;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    displayName: row.display_name || row.name || 'Crusher',
    avatarUrl: row.avatar_url || null,
    fallbackImageUrl: row.image || null,
    version: buildOgVersionToken(row.version_at),
  };
});

export type SetterOgSummary = {
  displayName: string;
  avatarUrl: string | null;
  version: string;
};

export const getSetterOgSummary = cache(async (username: string): Promise<SetterOgSummary> => {
  const result = await dbz.execute<{
    name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    version_at: string | Date | null;
  }>(drizzleSql`
    SELECT
      profile.name,
      profile.display_name,
      profile.avatar_url,
      GREATEST(
        COALESCE(profile.user_updated_at, to_timestamp(0)),
        COALESCE(profile.profile_updated_at, to_timestamp(0)),
        COALESCE(
          (
            SELECT MAX(bt.updated_at)
            FROM boardsesh_ticks bt
            JOIN board_climbs bc ON bc.uuid = bt.climb_uuid AND bc.board_type = bt.board_type
            WHERE bc.setter_username = ${username}
          ),
          to_timestamp(0)
        ),
        COALESCE(
          (
            SELECT MAX(c.created_at::timestamp)
            FROM board_climbs c
            WHERE c.setter_username = ${username}
          ),
          to_timestamp(0)
        )
      ) AS version_at
    FROM (SELECT 1) AS seed
    LEFT JOIN (
      SELECT
        u.name,
        u.updated_at AS user_updated_at,
        p.display_name,
        p.avatar_url,
        p.updated_at AS profile_updated_at
      FROM user_board_mappings ubm
      JOIN users u ON u.id = ubm.user_id
      LEFT JOIN user_profiles p ON p.user_id = ubm.user_id
      WHERE ubm.board_username = ${username}
      LIMIT 1
    ) AS profile ON true
  `);

  const row = result.rows[0];

  return {
    displayName: row?.display_name || row?.name || username,
    avatarUrl: row?.avatar_url || null,
    version: buildOgVersionToken(row?.version_at),
  };
});

export type SessionOgGradeRow = {
  difficulty: number;
  count: number;
};

export type SessionOgSummary = {
  sessionName: string;
  participantNames: string[];
  totalSends: number;
  gradeRows: SessionOgGradeRow[];
  version: string;
  found: boolean;
};

export const getSessionOgSummary = cache(async (sessionId: string): Promise<SessionOgSummary> => {
  const [sessionResult, participantResult, gradeResult] = await Promise.all([
    dbz.execute<{
      session_name: string | null;
      version_at: string | Date | null;
    }>(drizzleSql`
      SELECT
        bs.session_name,
        GREATEST(
          COALESCE(bs.last_activity, to_timestamp(0)),
          COALESCE((SELECT MAX(bt.updated_at) FROM boardsesh_ticks bt WHERE bt.session_id = ${sessionId}), to_timestamp(0))
        ) AS version_at
      FROM board_sessions bs
      WHERE bs.id = ${sessionId}
      LIMIT 1
    `),
    dbz.execute<{
      display_name: string;
    }>(drizzleSql`
      SELECT DISTINCT
        COALESCE(up.display_name, u.name, 'Climber') as display_name
      FROM boardsesh_ticks bt
      JOIN users u ON u.id = bt.user_id
      LEFT JOIN user_profiles up ON up.user_id = bt.user_id
      WHERE bt.session_id = ${sessionId}
      LIMIT 6
    `),
    dbz.execute<{
      difficulty: number;
      cnt: number;
    }>(drizzleSql`
      SELECT bt.difficulty, COUNT(*) as cnt
      FROM boardsesh_ticks bt
      WHERE bt.session_id = ${sessionId}
        AND bt.status IN ('flash', 'send')
        AND bt.difficulty IS NOT NULL
      GROUP BY bt.difficulty
      ORDER BY bt.difficulty
    `),
  ]);

  const sessionRow = sessionResult.rows[0];

  if (!sessionRow) {
    return {
      sessionName: 'Climbing Session',
      participantNames: [],
      totalSends: 0,
      gradeRows: [],
      version: buildOgVersionToken(null),
      found: false,
    };
  }

  const gradeRows = gradeResult.rows.map((row) => ({
    difficulty: Number(row.difficulty),
    count: Number(row.cnt),
  }));

  return {
    sessionName: sessionRow.session_name || 'Climbing Session',
    participantNames: participantResult.rows.map((row) => row.display_name),
    totalSends: gradeRows.reduce((sum, row) => sum + row.count, 0),
    gradeRows,
    version: buildOgVersionToken(sessionRow.version_at),
    found: true,
  };
});

export type PlaylistOgSummary = {
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isPublic: boolean;
  boardType: string;
  climbCount: number;
  version: string;
};

export const getPlaylistOgSummary = cache(async (playlistUuid: string): Promise<PlaylistOgSummary | null> => {
  const result = await dbz.execute<{
    name: string | null;
    description: string | null;
    color: string | null;
    icon: string | null;
    is_public: boolean;
    board_type: string;
    climb_count: number;
    version_at: string | Date | null;
  }>(drizzleSql`
    SELECT
      p.name,
      p.description,
      p.color,
      p.icon,
      p.is_public,
      p.board_type,
      p.updated_at AS version_at,
      (SELECT COUNT(*) FROM playlist_climbs pc WHERE pc.playlist_id = p.id) as climb_count
    FROM playlists p
    WHERE p.uuid = ${playlistUuid}
    LIMIT 1
  `);

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    name: row.name || 'Playlist',
    description: row.description,
    color: row.color,
    icon: row.icon,
    isPublic: row.is_public,
    boardType: row.board_type,
    climbCount: Number(row.climb_count),
    version: buildOgVersionToken(row.version_at),
  };
});

import { pgTable, bigserial, text, integer, real, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const boardseshBetaVideos = pgTable(
  'boardsesh_beta_videos',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    uuid: text('uuid').notNull().unique(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    boardType: text('board_type').notNull(),
    climbUuid: text('climb_uuid').notNull(),
    angle: integer('angle'),
    bunnyVideoId: text('bunny_video_id').notNull(),
    bunnyLibraryId: text('bunny_library_id').notNull(),
    title: text('title'),
    status: text('status').notNull().default('processing'),
    thumbnailUrl: text('thumbnail_url'),
    duration: real('duration'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => ({
    climbIdx: index('boardsesh_beta_videos_climb_idx').on(table.boardType, table.climbUuid),
    userIdx: index('boardsesh_beta_videos_user_idx').on(table.userId),
    bunnyVideoIdx: uniqueIndex('boardsesh_beta_videos_bunny_video_idx').on(table.bunnyVideoId),
  }),
);

export type BoardseshBetaVideo = typeof boardseshBetaVideos.$inferSelect;
export type NewBoardseshBetaVideo = typeof boardseshBetaVideos.$inferInsert;

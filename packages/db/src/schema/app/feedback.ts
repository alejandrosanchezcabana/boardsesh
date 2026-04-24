import { pgTable, text, integer, timestamp, bigserial, index } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const appFeedback = pgTable(
  'app_feedback',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    rating: integer('rating'),
    comment: text('comment'),
    platform: text('platform').notNull(),
    appVersion: text('app_version'),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('app_feedback_created_at_idx').on(table.createdAt),
    userIdx: index('app_feedback_user_idx').on(table.userId),
  }),
);

export type AppFeedback = typeof appFeedback.$inferSelect;
export type NewAppFeedback = typeof appFeedback.$inferInsert;

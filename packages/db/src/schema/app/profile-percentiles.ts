import { pgTable, text, integer, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const userClimbPercentiles = pgTable('user_climb_percentiles', {
  userId: text('user_id')
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalDistinctClimbs: integer('total_distinct_climbs').notNull().default(0),
  percentile: doublePrecision('percentile').notNull().default(0),
  totalActiveUsers: integer('total_active_users').notNull().default(0),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
});

export type UserClimbPercentileSnapshot = typeof userClimbPercentiles.$inferSelect;
export type NewUserClimbPercentileSnapshot = typeof userClimbPercentiles.$inferInsert;

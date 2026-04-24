import { pgTable, bigserial, bigint, integer, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { userBoards } from './boards';

/**
 * Auto-recorded board configurations seen on BLE connect.
 *
 * Captures the (board_name, layout_id, size_id, set_ids, angle) the user was on
 * when their device connected to a controller with a given serial number. Acts
 * as a fallback for serial→board lookups when the user has not deliberately
 * saved a `userBoards` row for the same controller. `boardId` links to a
 * deliberately-saved board when the connect happened from a /b/{slug}/... route.
 */
export const userBoardSerials = pgTable(
  'user_board_serials',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serialNumber: text('serial_number').notNull(),
    boardName: text('board_name').notNull(),
    layoutId: bigint('layout_id', { mode: 'number' }).notNull(),
    sizeId: bigint('size_id', { mode: 'number' }).notNull(),
    setIds: text('set_ids').notNull(),
    angle: integer('angle'),
    boardUuid: text('board_uuid').references(() => userBoards.uuid, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserSerial: uniqueIndex('user_board_serials_unique_user_serial').on(table.userId, table.serialNumber),
    serialIdx: index('user_board_serials_serial_idx').on(table.serialNumber),
    boardUuidIdx: index('user_board_serials_board_uuid_idx').on(table.boardUuid),
  }),
);

export type UserBoardSerial = typeof userBoardSerials.$inferSelect;
export type NewUserBoardSerial = typeof userBoardSerials.$inferInsert;

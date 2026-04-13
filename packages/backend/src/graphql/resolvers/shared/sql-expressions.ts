import { sql, eq, and } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm/alias';
import * as dbSchema from '@boardsesh/db/schema';
import { db } from '../../../db/client';

/**
 * Aliased board_difficulty_grades table for consensus grade lookups.
 * Join this on ROUND(boardClimbStats.displayDifficulty) + boardType
 * to avoid correlated subqueries.
 */
export const consensusGradeTable = aliasedTable(dbSchema.boardDifficultyGrades, 'consensus_grade');

/**
 * JOIN condition for consensusGradeTable — requires boardClimbStats
 * to already be joined in the query.
 */
export const consensusGradeJoinCondition = and(
  eq(consensusGradeTable.difficulty, sql`ROUND(${dbSchema.boardClimbStats.displayDifficulty})`),
  eq(consensusGradeTable.boardType, dbSchema.boardClimbStats.boardType),
);

/**
 * SQL expression: consensus difficulty name from the joined consensus grade table.
 * Requires consensusGradeTable to be LEFT JOINed in the query.
 */
export const consensusDifficultyNameExpr = sql<string | null>`${consensusGradeTable.boulderName}`;

/**
 * SQL expression: COALESCE user-logged grade with consensus grade.
 * Falls back to consensus when user didn't log a grade.
 * Requires both boardDifficultyGrades and consensusGradeTable to be joined.
 */
export const difficultyNameWithFallbackExpr = sql<string | null>`COALESCE(
  ${dbSchema.boardDifficultyGrades.boulderName},
  ${consensusGradeTable.boulderName}
)`;

/**
 * SQL expression: rounded consensus difficulty ID.
 * Requires boardClimbStats to be joined in the query.
 */
export const consensusDifficultyExpr = sql<number | null>`ROUND(${dbSchema.boardClimbStats.displayDifficulty})`;

/**
 * Imperative query: look up consensus grade name for a specific climb+angle.
 * Used in contexts where an inline SQL expression isn't possible (e.g. event publishing).
 */
export async function getConsensusDifficultyName(
  climbUuid: string,
  boardType: string,
  angle: number,
): Promise<string | undefined> {
  const [result] = await db
    .select({ boulderName: dbSchema.boardDifficultyGrades.boulderName })
    .from(dbSchema.boardClimbStats)
    .innerJoin(
      dbSchema.boardDifficultyGrades,
      and(
        eq(dbSchema.boardDifficultyGrades.difficulty, sql`ROUND(${dbSchema.boardClimbStats.displayDifficulty})`),
        eq(dbSchema.boardDifficultyGrades.boardType, dbSchema.boardClimbStats.boardType),
      ),
    )
    .where(
      and(
        eq(dbSchema.boardClimbStats.climbUuid, climbUuid),
        eq(dbSchema.boardClimbStats.boardType, boardType),
        eq(dbSchema.boardClimbStats.angle, angle),
      ),
    )
    .limit(1);
  return result?.boulderName ?? undefined;
}

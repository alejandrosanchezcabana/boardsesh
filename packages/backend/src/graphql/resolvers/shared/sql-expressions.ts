import { sql, eq, and } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm/alias";
import * as dbSchema from "@boardsesh/db/schema";
import { db } from "../../../db/client";

/**
 * Aliased board_difficulty_grades table for consensus grade lookups.
 * Resolves the community-voted grade from boardClimbStats.displayDifficulty
 * without a correlated subquery.
 *
 * ## Required joins (in order)
 *
 * Queries that use any of the expressions below must include these joins:
 *
 * 1. `boardClimbStats` — joined on (climbUuid, boardType, angle)
 * 2. `boardDifficultyGrades` — joined on (tick.difficulty, boardType) — user's logged grade
 * 3. `consensusGradeTable` — joined via `consensusGradeJoinCondition` — consensus grade
 *
 * Example:
 * ```ts
 * db.select({ difficultyName: difficultyNameWithFallbackExpr })
 *   .from(boardseshTicks)
 *   .leftJoin(boardClimbStats, ...)
 *   .leftJoin(boardDifficultyGrades, ...)
 *   .leftJoin(consensusGradeTable, consensusGradeJoinCondition)
 * ```
 *
 * If a required join is missing the query will produce nulls (not an error)
 * because these are LEFT JOINs with nullable column references.
 */
export const consensusGradeTable = aliasedTable(dbSchema.boardDifficultyGrades, "consensus_grade");

/**
 * JOIN condition for consensusGradeTable.
 * Requires boardClimbStats to already be joined in the query.
 */
export const consensusGradeJoinCondition = and(
  eq(consensusGradeTable.difficulty, sql`ROUND(${dbSchema.boardClimbStats.displayDifficulty})`),
  eq(consensusGradeTable.boardType, dbSchema.boardClimbStats.boardType),
);

/**
 * Consensus difficulty name from the joined consensus grade table.
 * Requires `consensusGradeTable` LEFT JOIN (see {@link consensusGradeTable}).
 */
export const consensusDifficultyNameExpr = sql<string | null>`${consensusGradeTable.boulderName}`;

/**
 * COALESCE user-logged grade with consensus grade.
 * Falls back to consensus when the user didn't log a grade.
 * Requires both `boardDifficultyGrades` and `consensusGradeTable` LEFT JOINs
 * (see {@link consensusGradeTable}).
 */
export const difficultyNameWithFallbackExpr = sql<string | null>`COALESCE(
  ${dbSchema.boardDifficultyGrades.boulderName},
  ${consensusGradeTable.boulderName}
)`;

/**
 * Rounded consensus difficulty ID.
 * Requires `boardClimbStats` to be joined in the query.
 */
export const consensusDifficultyExpr = sql<
  number | null
>`ROUND(${dbSchema.boardClimbStats.displayDifficulty})`;

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
        eq(
          dbSchema.boardDifficultyGrades.difficulty,
          sql`ROUND(${dbSchema.boardClimbStats.displayDifficulty})`,
        ),
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

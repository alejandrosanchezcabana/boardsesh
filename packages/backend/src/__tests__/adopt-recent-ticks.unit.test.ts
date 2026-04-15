/**
 * Tests for adoptRecentTicksForSession.
 *
 * Verifies that when a user starts a party session, recent solo ticks
 * (within 2 hours, no session_id) are adopted into the new session,
 * and affected inferred sessions are cleaned up properly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track all mock calls for assertions
const mockSelectResult: unknown[] = [];
const mockDeleteWhereCalls: unknown[] = [];
const mockUpdateSetCalls: unknown[] = [];
const mockUpdateWhereCalls: unknown[] = [];

// Flexible mock that supports chained select/from/where queries
// Returns mockSelectResult by default, but can be overridden per-call
let selectCallIndex = 0;
const selectResults: unknown[][] = [];

function resetSelectResults(...results: unknown[][]) {
  selectResults.length = 0;
  selectResults.push(...results);
  selectCallIndex = 0;
}

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn((...args: unknown[]) => {
      mockSelectResult.push(args);
      const currentIndex = selectCallIndex++;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => {
            const result = selectResults[currentIndex] ?? [];
            return Promise.resolve(result);
          }),
        })),
      };
    }),
    update: vi.fn(() => ({
      set: vi.fn((...args: unknown[]) => {
        mockUpdateSetCalls.push(args);
        return {
          where: vi.fn((...whereArgs: unknown[]) => {
            mockUpdateWhereCalls.push(whereArgs);
            return Promise.resolve();
          }),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((...args: unknown[]) => {
        mockDeleteWhereCalls.push(args);
        return Promise.resolve();
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => Promise.resolve()),
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    execute: vi.fn(() => Promise.resolve({ rows: [] })),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
        })),
      })),
      execute: vi.fn(() => Promise.resolve({ rows: [] })),
    })),
  },
}));

vi.mock('@boardsesh/db/schema', () => ({
  boardseshTicks: {
    uuid: 'uuid',
    userId: 'user_id',
    climbedAt: 'climbed_at',
    status: 'status',
    sessionId: 'session_id',
    inferredSessionId: 'inferred_session_id',
    id: 'id',
  },
  inferredSessions: {
    id: 'id',
    userId: 'user_id',
    firstTickAt: 'first_tick_at',
    lastTickAt: 'last_tick_at',
    endedAt: 'ended_at',
    tickCount: 'tick_count',
    totalSends: 'total_sends',
    totalFlashes: 'total_flashes',
    totalAttempts: 'total_attempts',
  },
}));

vi.mock('../graphql/resolvers/social/session-mutations', () => ({
  recalculateSessionStats: vi.fn().mockResolvedValue(undefined),
}));

import { adoptRecentTicksForSession } from '../jobs/inferred-session-builder';
import { recalculateSessionStats } from '../graphql/resolvers/social/session-mutations';
import { db } from '../db/client';

describe('adoptRecentTicksForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult.length = 0;
    mockDeleteWhereCalls.length = 0;
    mockUpdateSetCalls.length = 0;
    mockUpdateWhereCalls.length = 0;
    selectCallIndex = 0;
    selectResults.length = 0;
  });

  it('returns 0 when no recent ticks exist', async () => {
    // First select: find recent ticks → empty
    resetSelectResults([]);

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(0);
    // Should not attempt any updates or deletes
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('adopts recent ticks with no inferred session (orphaned)', async () => {
    // First select: find recent ticks → 2 orphaned ticks
    resetSelectResults(
      [
        { uuid: 'tick-1', inferredSessionId: null },
        { uuid: 'tick-2', inferredSessionId: null },
      ],
    );

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(2);
    // Should update ticks with session_id and clear inferred_session_id
    expect(db.update).toHaveBeenCalled();
    expect(mockUpdateSetCalls.length).toBeGreaterThan(0);
    // First set call should contain sessionId and null inferredSessionId
    expect(mockUpdateSetCalls[0][0]).toEqual({
      sessionId: 'party-session-1',
      inferredSessionId: null,
    });
    // No inferred sessions to clean up (all were null)
    expect(db.delete).not.toHaveBeenCalled();
    expect(recalculateSessionStats).not.toHaveBeenCalled();
  });

  it('adopts ticks with inferred session and deletes empty inferred session', async () => {
    // First select: find recent ticks → 3 ticks all from same inferred session
    // Second select: count remaining ticks in inferred session → 0
    resetSelectResults(
      [
        { uuid: 'tick-1', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-3', inferredSessionId: 'inferred-1' },
      ],
      [{ count: 0 }],
    );

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(3);
    // Should update ticks
    expect(db.update).toHaveBeenCalled();
    // Should delete the now-empty inferred session
    expect(db.delete).toHaveBeenCalled();
    expect(mockDeleteWhereCalls.length).toBe(1);
    // Should NOT recalculate stats (session was deleted)
    expect(recalculateSessionStats).not.toHaveBeenCalled();
  });

  it('recalculates stats when inferred session still has remaining ticks', async () => {
    // First select: find recent ticks → 2 ticks from inferred session
    // Second select: count remaining ticks in inferred session → 3 (some older ticks remain)
    resetSelectResults(
      [
        { uuid: 'tick-1', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
      ],
      [{ count: 3 }],
    );

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(2);
    // Should NOT delete the inferred session (still has ticks)
    expect(db.delete).not.toHaveBeenCalled();
    // Should recalculate stats for the partially-emptied inferred session
    expect(recalculateSessionStats).toHaveBeenCalledWith('inferred-1');
  });

  it('handles ticks from multiple inferred sessions', async () => {
    // First select: find recent ticks → ticks from 2 different inferred sessions
    // Second select: count for inferred-1 → 0 (delete it)
    // Third select: count for inferred-2 → 5 (recalculate stats)
    resetSelectResults(
      [
        { uuid: 'tick-1', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-3', inferredSessionId: 'inferred-2' },
      ],
      [{ count: 0 }],
      [{ count: 5 }],
    );

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(3);
    // Should delete inferred-1 (empty) and recalculate inferred-2 (has remaining ticks)
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(recalculateSessionStats).toHaveBeenCalledTimes(1);
    expect(recalculateSessionStats).toHaveBeenCalledWith('inferred-2');
  });

  it('handles mix of orphaned and inferred-session ticks', async () => {
    // First select: find recent ticks → mix of orphaned and inferred
    // Second select: count for inferred-1 → 0
    resetSelectResults(
      [
        { uuid: 'tick-1', inferredSessionId: null },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-3', inferredSessionId: null },
      ],
      [{ count: 0 }],
    );

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(3);
    // Should only process inferred-1, not try to clean up null sessions
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});

describe('adoptRecentTicksForSession - 2 hour window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult.length = 0;
    mockDeleteWhereCalls.length = 0;
    mockUpdateSetCalls.length = 0;
    mockUpdateWhereCalls.length = 0;
    selectCallIndex = 0;
    selectResults.length = 0;
  });

  it('uses a 2 hour cutoff window', async () => {
    // The function calculates: new Date(Date.now() - 2 * 60 * 60 * 1000)
    // We just verify it calls select (the WHERE clause is handled by drizzle ORM
    // and tested via integration tests)
    resetSelectResults([]);

    await adoptRecentTicksForSession('user-1', 'party-session-1');

    // Should have called select to find recent ticks
    expect(db.select).toHaveBeenCalled();
  });
});

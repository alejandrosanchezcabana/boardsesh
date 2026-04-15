/**
 * Tests for adoptRecentTicksForSession and extractBoardType.
 *
 * Verifies that when a user starts a party session, recent solo ticks
 * (within 2 hours, no session_id) are adopted into the new session,
 * and affected inferred sessions are cleaned up properly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track mutation calls on the transaction mock
let txUpdateSetCalls: unknown[] = [];
let txDeleteWhereCalls: unknown[] = [];

// Queue of results for sequential tx.select() calls
let txSelectResults: unknown[][] = [];
let txSelectCallIndex = 0;

const mockTxSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => {
      const result = txSelectResults[txSelectCallIndex++] ?? [];
      return Promise.resolve(result);
    }),
  })),
}));

const mockTxUpdate = vi.fn(() => ({
  set: vi.fn((...args: unknown[]) => {
    txUpdateSetCalls.push(args);
    return {
      where: vi.fn(() => Promise.resolve()),
    };
  }),
}));

const mockTxDelete = vi.fn(() => ({
  where: vi.fn((...args: unknown[]) => {
    txDeleteWhereCalls.push(args);
    return Promise.resolve();
  }),
}));

vi.mock('../db/client', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: mockTxSelect,
        update: mockTxUpdate,
        delete: mockTxDelete,
        execute: vi.fn(() => Promise.resolve({ rows: [] })),
      };
      return fn(tx);
    }),
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
    boardType: 'board_type',
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

import { adoptRecentTicksForSession, extractBoardType } from '../jobs/inferred-session-builder';
import { recalculateSessionStats } from '../graphql/resolvers/social/session-mutations';
import { db } from '../db/client';

describe('extractBoardType', () => {
  it('extracts board type from standard path', () => {
    expect(extractBoardType('/kilter/original/12x12-square/screw_bolt/40/list')).toBe('kilter');
    expect(extractBoardType('/tension/original/12x12/main/40/list')).toBe('tension');
    expect(extractBoardType('/decoy/original/12x12/main/40/list')).toBe('decoy');
  });

  it('returns null for slug-based paths', () => {
    expect(extractBoardType('/b/my-home-wall-kilter/40/list')).toBeNull();
    expect(extractBoardType('/b/some-gym-tension/35/list')).toBeNull();
  });

  it('returns null for empty or root path', () => {
    expect(extractBoardType('/')).toBeNull();
    expect(extractBoardType('')).toBeNull();
  });
});

describe('adoptRecentTicksForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txUpdateSetCalls = [];
    txDeleteWhereCalls = [];
    txSelectResults = [];
    txSelectCallIndex = 0;
  });

  it('returns 0 when no recent ticks exist', async () => {
    txSelectResults = [[]];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(0);
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it('runs inside a transaction', async () => {
    txSelectResults = [[]];

    await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('adopts orphaned ticks (no inferred session)', async () => {
    txSelectResults = [
      [
        { uuid: 'tick-1', inferredSessionId: null },
        { uuid: 'tick-2', inferredSessionId: null },
      ],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(2);
    expect(txUpdateSetCalls).toHaveLength(1);
    expect(txUpdateSetCalls[0][0]).toEqual({
      sessionId: 'party-session-1',
      inferredSessionId: null,
    });
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(recalculateSessionStats).not.toHaveBeenCalled();
  });

  it('deletes empty inferred sessions after adopting all their ticks', async () => {
    txSelectResults = [
      [
        { uuid: 'tick-1', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-3', inferredSessionId: 'inferred-1' },
      ],
      // Count remaining → 0
      [{ count: 0 }],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(3);
    expect(txDeleteWhereCalls).toHaveLength(1);
    expect(recalculateSessionStats).not.toHaveBeenCalled();
  });

  it('recalculates stats for partially-emptied inferred sessions', async () => {
    txSelectResults = [
      [
        { uuid: 'tick-1', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
      ],
      // Count remaining → 3
      [{ count: 3 }],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(2);
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(recalculateSessionStats).toHaveBeenCalledOnce();
    expect(recalculateSessionStats).toHaveBeenCalledWith(
      'inferred-1',
      expect.anything(),
    );
  });

  it('handles ticks from multiple inferred sessions', async () => {
    txSelectResults = [
      [
        { uuid: 'tick-1', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-3', inferredSessionId: 'inferred-2' },
      ],
      // Count for inferred-1 → 0 (delete)
      [{ count: 0 }],
      // Count for inferred-2 → 5 (recalculate)
      [{ count: 5 }],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(3);
    expect(txDeleteWhereCalls).toHaveLength(1);
    expect(recalculateSessionStats).toHaveBeenCalledOnce();
    expect(recalculateSessionStats).toHaveBeenCalledWith(
      'inferred-2',
      expect.anything(),
    );
  });

  it('handles mix of orphaned and inferred-session ticks', async () => {
    txSelectResults = [
      [
        { uuid: 'tick-1', inferredSessionId: null },
        { uuid: 'tick-2', inferredSessionId: 'inferred-1' },
        { uuid: 'tick-3', inferredSessionId: null },
      ],
      // Count for inferred-1 → 0
      [{ count: 0 }],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(3);
    expect(txDeleteWhereCalls).toHaveLength(1);
  });

  it('guards against undefined remaining count', async () => {
    txSelectResults = [
      [{ uuid: 'tick-1', inferredSessionId: 'inferred-1' }],
      // Unexpected empty result for count query
      [],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(1);
    // Should treat undefined remaining as empty → delete
    expect(txDeleteWhereCalls).toHaveLength(1);
  });

  it('accepts boardType parameter to filter ticks', async () => {
    // When boardType is passed, the WHERE clause includes a board_type filter.
    // We verify the select was called (the actual filtering is done by drizzle's
    // eq() which is tested by drizzle-orm itself).
    txSelectResults = [
      [{ uuid: 'tick-1', inferredSessionId: null }],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1', 'kilter');

    expect(result).toBe(1);
    expect(mockTxSelect).toHaveBeenCalled();
  });

  it('works without boardType parameter', async () => {
    txSelectResults = [
      [{ uuid: 'tick-1', inferredSessionId: null }],
    ];

    const result = await adoptRecentTicksForSession('user-1', 'party-session-1');

    expect(result).toBe(1);
  });
});

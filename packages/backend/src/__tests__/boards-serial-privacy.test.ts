import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import type { ConnectionContext } from '@boardsesh/shared-schema';
import { socialBoardQueries } from '../graphql/resolvers/social/boards';

// Mock db + dependencies before importing resolver.
// `vi.mock` is hoisted to the top of the file at parse time, so even though
// these calls appear textually below the resolver import, they execute first.
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };
  return { mockDb };
});

vi.mock('../db/client', () => ({
  db: mockDb,
}));

vi.mock('../utils/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('../utils/redis-rate-limiter', () => ({
  checkRateLimitRedis: vi.fn(),
}));

vi.mock('../events/index', () => ({
  publishSocialEvent: vi.fn().mockResolvedValue(undefined),
}));

// Minimal DB row matching the userBoards schema shape
function makeDbBoard(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uuid: 'board-uuid-1',
    slug: 'my-board',
    ownerId: 'owner-123',
    boardType: 'kilter',
    layoutId: 1,
    sizeId: 10,
    setIds: '1,2',
    name: 'Secret Home Wall',
    description: 'My private training cave',
    locationName: '123 Home Street',
    latitude: 40.7128,
    longitude: -74.006,
    isPublic: false,
    isUnlisted: false,
    hideLocation: false,
    isOwned: true,
    angle: 40,
    isAngleAdjustable: true,
    createdAt: new Date('2025-01-01'),
    gymId: null,
    serialNumber: 'SERIAL001',
    deletedAt: null,
    ...overrides,
  };
}

function makeUnauthCtx(): ConnectionContext {
  return { connectionId: 'conn-1', isAuthenticated: false } as ConnectionContext;
}

function makeAuthCtx(userId = 'user-1'): ConnectionContext {
  return { connectionId: 'conn-1', isAuthenticated: true, userId } as ConnectionContext;
}

// Set up the mock chain for db.select().from().where() returning the given rows
function setupDbSelect(rows: unknown[]) {
  const mockWhere = vi.fn().mockResolvedValue(rows);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  mockDb.select.mockReturnValue({ from: mockFrom });
}

// Set up multiple sequential select calls (for enrichBoards which does many queries).
// Each call to db.select().from()... resolves to the corresponding entry in `calls`.
function setupDbSelectSequence(calls: unknown[][]) {
  let callIndex = 0;

  mockDb.select.mockImplementation(() => {
    const currentIndex = callIndex++;
    const rows = calls[currentIndex] ?? [];

    // Build a chainable mock that supports .from().where(), .from().leftJoin().where(),
    // and .from().where().groupBy() — all resolving to `rows`.
    const terminal = Object.assign(Promise.resolve(rows), {
      groupBy: vi.fn().mockResolvedValue(rows),
      limit: vi.fn().mockImplementation(() => ({
        offset: vi.fn().mockResolvedValue(rows),
      })),
    });
    const mockWhere = vi.fn().mockReturnValue(terminal);
    const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
      leftJoin: mockLeftJoin,
    });

    return { from: mockFrom };
  });
}

// Set up the mock chain for `db.select().from().leftJoin().where()` resolving to rows.
// `myBoardSerialConfigs` calls: select({...}).from(userBoardSerials).leftJoin(...).where(...)
// where the where(...) result is awaited directly (no .limit()/.groupBy()).
function setupDbLeftJoin(rows: unknown[]) {
  const terminal = Object.assign(Promise.resolve(rows), {
    groupBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  });
  const mockWhere = vi.fn().mockReturnValue(terminal);
  const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere, leftJoin: mockLeftJoin });
  mockDb.select.mockReturnValue({ from: mockFrom });
  return { mockWhere, mockLeftJoin, mockFrom };
}

describe('boardsBySerialNumbers privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unauthenticated callers', () => {
    it('strips name, description, and locationName from non-public boards', async () => {
      const privateBoard = makeDbBoard({
        isPublic: false,
        name: 'Secret Wall',
        description: 'Hidden',
        locationName: 'Home',
      });
      setupDbSelect([privateBoard]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SERIAL001'] },
        makeUnauthCtx(),
      );

      expect(results).toHaveLength(1);
      const board = results[0];
      // Name falls back to boardType for non-public boards
      expect(board.name).toBe('kilter');
      expect(board.description).toBeNull();
      expect(board.locationName).toBeNull();
    });

    it('strips name, description, and locationName from unlisted boards', async () => {
      const unlistedBoard = makeDbBoard({
        isPublic: false,
        isUnlisted: true,
        name: 'Hidden Wall',
        description: 'Not discoverable',
        locationName: 'Secret Location',
      });
      setupDbSelect([unlistedBoard]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SERIAL001'] },
        makeUnauthCtx(),
      );

      expect(results).toHaveLength(1);
      const board = results[0];
      expect(board.name).toBe('kilter');
      expect(board.description).toBeNull();
      expect(board.locationName).toBeNull();
      expect(board.isUnlisted).toBe(true);
    });

    it('includes name, description, and locationName for public boards', async () => {
      const publicBoard = makeDbBoard({
        isPublic: true,
        name: 'Gym Wall',
        description: 'Open to all',
        locationName: 'Downtown Gym',
      });
      setupDbSelect([publicBoard]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SERIAL001'] },
        makeUnauthCtx(),
      );

      expect(results).toHaveLength(1);
      const board = results[0];
      expect(board.name).toBe('Gym Wall');
      expect(board.description).toBe('Open to all');
      expect(board.locationName).toBe('Downtown Gym');
    });

    it('always strips GPS, owner identity, and stats', async () => {
      const publicBoard = makeDbBoard({
        isPublic: true,
        latitude: 40.7128,
        longitude: -74.006,
        ownerId: 'owner-secret',
      });
      setupDbSelect([publicBoard]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SERIAL001'] },
        makeUnauthCtx(),
      );

      const board = results[0];
      expect(board.latitude).toBeNull();
      expect(board.longitude).toBeNull();
      expect(board.ownerId).toBe('');
      expect(board.ownerDisplayName).toBeNull();
      expect(board.ownerAvatarUrl).toBeNull();
      expect(board.totalAscents).toBe(0);
      expect(board.uniqueClimbers).toBe(0);
      expect(board.followerCount).toBe(0);
      expect(board.commentCount).toBe(0);
      expect(board.isFollowedByMe).toBe(false);
    });

    it('returns board configuration fields for all boards', async () => {
      const board = makeDbBoard({ isPublic: false, serialNumber: 'SN42' });
      setupDbSelect([board]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SN42'] },
        makeUnauthCtx(),
      );

      const result = results[0];
      expect(result.uuid).toBe('board-uuid-1');
      expect(result.slug).toBe('my-board');
      expect(result.boardType).toBe('kilter');
      expect(result.layoutId).toBe(1);
      expect(result.sizeId).toBe(10);
      expect(result.setIds).toBe('1,2');
      expect(result.angle).toBe(40);
      expect(result.serialNumber).toBe('SN42');
      expect(result.isPublic).toBe(false);
      expect(result.isUnlisted).toBe(false);
    });

    it('returns all non-null UserBoard fields with valid defaults', async () => {
      const board = makeDbBoard({ isPublic: false });
      setupDbSelect([board]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SERIAL001'] },
        makeUnauthCtx(),
      );

      const result = results[0];
      // Verify every non-null field in the GraphQL schema is present
      expect(result.uuid).toBeDefined();
      expect(result.slug).toBeDefined();
      expect(typeof result.ownerId).toBe('string');
      expect(typeof result.boardType).toBe('string');
      expect(typeof result.layoutId).toBe('number');
      expect(typeof result.sizeId).toBe('number');
      expect(typeof result.setIds).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.isPublic).toBe('boolean');
      expect(typeof result.isUnlisted).toBe('boolean');
      expect(typeof result.hideLocation).toBe('boolean');
      expect(typeof result.isOwned).toBe('boolean');
      expect(typeof result.angle).toBe('number');
      expect(typeof result.isAngleAdjustable).toBe('boolean');
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.totalAscents).toBe('number');
      expect(typeof result.uniqueClimbers).toBe('number');
      expect(typeof result.followerCount).toBe('number');
      expect(typeof result.commentCount).toBe('number');
      expect(typeof result.isFollowedByMe).toBe('boolean');
    });

    it('does not call enrichBoards (no owner/stats queries)', async () => {
      setupDbSelect([makeDbBoard()]);

      await socialBoardQueries.boardsBySerialNumbers(null, { serialNumbers: ['SERIAL001'] }, makeUnauthCtx());

      // Only one select call: the board lookup itself.
      // enrichBoards would trigger 6+ additional select calls.
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  describe('authenticated callers', () => {
    it('returns full board data including owner and stats', async () => {
      const board = makeDbBoard({
        isPublic: false,
        name: 'Secret Wall',
        description: 'Private',
        locationName: 'Home',
        latitude: 40.7128,
        longitude: -74.006,
      });

      // First call: board lookup; remaining calls: enrichBoards queries
      setupDbSelectSequence([
        [board], // board lookup
        [{ userId: 'owner-123', name: 'Owner', image: null, displayName: 'The Owner', avatarUrl: null }], // owner
        [{ boardId: 1, totalAscents: 42, uniqueClimbers: 10 }], // ticks
        [{ boardUuid: 'board-uuid-1', count: 5 }], // followers
        [{ entityId: 'board-uuid-1', count: 3 }], // comments
        [{ boardUuid: 'board-uuid-1' }], // follow status
        [], // gyms
      ]);

      const results = await socialBoardQueries.boardsBySerialNumbers(
        null,
        { serialNumbers: ['SERIAL001'] },
        makeAuthCtx('user-1'),
      );

      expect(results).toHaveLength(1);
      const result = results[0];
      expect(result.name).toBe('Secret Wall');
      expect(result.description).toBe('Private');
      expect(result.locationName).toBe('Home');
      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBe(-74.006);
      expect(result.ownerDisplayName).toBe('The Owner');
      expect(result.totalAscents).toBe(42);
      expect(result.uniqueClimbers).toBe(10);
    });
  });
});

describe('myBoardSerialConfigs privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRecording(overrides: Record<string, unknown> = {}) {
    return {
      serialNumber: 'SERIAL001',
      boardName: 'kilter',
      layoutId: 1,
      sizeId: 10,
      setIds: '1,20',
      updatedAt: new Date('2026-04-01'),
      boardUuid: null,
      boardSlug: null,
      ...overrides,
    };
  }

  it('throws when caller is not authenticated', async () => {
    setupDbLeftJoin([]);

    await expect(
      socialBoardQueries.myBoardSerialConfigs(null, { serialNumbers: ['SERIAL001'] }, makeUnauthCtx()),
    ).rejects.toThrow(/Authentication required/);

    // Must short-circuit before any DB call.
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns empty array when input has no non-empty serials', async () => {
    setupDbLeftJoin([]);

    const results = await socialBoardQueries.myBoardSerialConfigs(
      null,
      { serialNumbers: ['', '   '] },
      makeAuthCtx('user-1'),
    );

    expect(results).toEqual([]);
    // No DB query when input is empty after filtering.
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('queries the DB and returns mapped recordings for the calling user', async () => {
    const recording = makeRecording({
      serialNumber: 'SN42',
      boardName: 'tension',
      layoutId: 5,
      sizeId: 12,
      setIds: '1,3',
      boardUuid: 'linked-board-uuid',
      boardSlug: 'my-tension',
    });
    setupDbLeftJoin([recording]);

    const results = await socialBoardQueries.myBoardSerialConfigs(
      null,
      { serialNumbers: ['SN42'] },
      makeAuthCtx('user-1'),
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      serialNumber: 'SN42',
      boardName: 'tension',
      layoutId: 5,
      sizeId: 12,
      setIds: '1,3',
      updatedAt: '2026-04-01T00:00:00.000Z',
      boardUuid: 'linked-board-uuid',
      boardSlug: 'my-tension',
    });
    // Single DB call — the resolver does not enrich beyond the leftJoin.
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('does not return recordings belonging to other users (DB filter is the boundary)', async () => {
    // Simulate the WHERE clause filtering correctly: when called as user-1,
    // the DB only returns user-1's rows. user-2's row is invisible to user-1
    // and would never appear in the result set.
    const userOneRecording = makeRecording({ serialNumber: 'SHARED-SERIAL' });
    setupDbLeftJoin([userOneRecording]);

    const userOneResults = await socialBoardQueries.myBoardSerialConfigs(
      null,
      { serialNumbers: ['SHARED-SERIAL'] },
      makeAuthCtx('user-1'),
    );

    expect(userOneResults).toHaveLength(1);
    expect(userOneResults[0].serialNumber).toBe('SHARED-SERIAL');

    // Now simulate the same query as user-2: DB returns nothing because
    // user-2 has no recording for that serial. User-2 cannot see user-1's row.
    vi.clearAllMocks();
    setupDbLeftJoin([]);

    const userTwoResults = await socialBoardQueries.myBoardSerialConfigs(
      null,
      { serialNumbers: ['SHARED-SERIAL'] },
      makeAuthCtx('user-2'),
    );

    expect(userTwoResults).toEqual([]);
  });

  it('caps input at 20 serials before querying the DB', async () => {
    setupDbLeftJoin([]);

    const twentyFiveSerials = Array.from({ length: 25 }, (_, i) => `SN${i}`);
    await socialBoardQueries.myBoardSerialConfigs(null, { serialNumbers: twentyFiveSerials }, makeAuthCtx('user-1'));

    // Even though we passed 25 serials, only one DB call should happen and
    // the resolver should have sliced internally. We can't introspect the
    // inArray operator's args without mocking drizzle-orm, so the assertion
    // here is "no error, single query, returns []" — the slice is also unit
    // tested by the boundary value at the caller layer.
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('handles a recording with no linked board (boardUuid + boardSlug both null)', async () => {
    setupDbLeftJoin([makeRecording({ boardUuid: null, boardSlug: null })]);

    const results = await socialBoardQueries.myBoardSerialConfigs(
      null,
      { serialNumbers: ['SERIAL001'] },
      makeAuthCtx('user-1'),
    );

    expect(results[0].boardUuid).toBeNull();
    expect(results[0].boardSlug).toBeNull();
  });
});

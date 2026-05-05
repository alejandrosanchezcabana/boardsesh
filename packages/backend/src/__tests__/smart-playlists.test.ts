import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import type { ConnectionContext } from '@boardsesh/shared-schema';
import { playlistQueries } from '../graphql/resolvers/playlists/queries';

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

vi.mock('../db/client', () => ({ db: mockDb }));

vi.mock('../db/queries/util/table-select', () => ({
  UNIFIED_TABLES: {
    climbs: {
      uuid: 'uuid',
      layoutId: 'layoutId',
      boardType: 'boardType',
      setterUsername: 'setterUsername',
      name: 'name',
      description: 'description',
      frames: 'frames',
    },
    climbStats: {
      climbUuid: 'climbUuid',
      boardType: 'boardType',
      angle: 'angle',
      ascensionistCount: 'ascensionistCount',
      qualityAverage: 'qualityAverage',
      difficultyAverage: 'difficultyAverage',
      displayDifficulty: 'displayDifficulty',
      benchmarkDifficulty: 'benchmarkDifficulty',
    },
  },
  isValidBoardName: vi.fn().mockReturnValue(true),
}));

function makeCtx(overrides: Partial<ConnectionContext> = {}): ConnectionContext {
  return {
    connectionId: 'conn-1',
    isAuthenticated: true,
    userId: 'user-123',
    sessionId: null,
    boardPath: null,
    controllerId: null,
    controllerApiKey: null,
    ...overrides,
  } as ConnectionContext;
}

/**
 * Mock Drizzle chain that records every method invocation. Terminal awaits
 * resolve to `resolveValue`. Subsequent .then() calls also resolve to
 * resolveValue (we reuse the same chain for nested subqueries).
 */
function makeChain(resolveValue: unknown = []) {
  const calls: Record<string, unknown[][]> = {};
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'groupBy',
    'having',
    'orderBy',
    'limit',
    'offset',
    'as',
  ];
  for (const method of methods) {
    calls[method] = [];
    chain[method] = vi.fn((...args: unknown[]) => {
      calls[method].push(args);
      return chain;
    });
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
  return { chain, calls };
}

const USER_ROW = {
  id: 'user-123',
  name: 'Marco',
  image: 'https://img/marco.jpg',
  displayName: 'Marco D',
  avatarUrl: 'https://img/marco-avatar.jpg',
};

describe('smartPlaylist resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FIVE_STARS uses LIMIT/OFFSET for pagination and only returns the requested page', async () => {
    const ctx = makeCtx();

    // user lookup
    mockDb.select.mockReturnValueOnce(makeChain([USER_ROW]).chain);
    // page query
    const { chain: pageChain, calls: pageCalls } = makeChain([
      { climbUuid: 'c1', boardType: 'kilter', latestClimbedAt: '2026-01-01' },
    ]);
    mockDb.select.mockReturnValueOnce(pageChain);
    // count query
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 42 }]).chain);
    // hydrate
    mockDb.select.mockReturnValueOnce(
      makeChain([
        {
          climbUuid: 'c1',
          layoutId: 1,
          boardType: 'kilter',
          setter_username: 'u',
          name: 'n',
          description: '',
          frames: '',
          statsAngle: 40,
          ascensionist_count: 5,
          difficulty_id: 20,
          quality_average: 5,
          difficulty_error: 0,
          benchmark_difficulty: null,
        },
      ]).chain,
    );

    const result = await playlistQueries.smartPlaylist(
      null,
      {
        input: { type: 'FIVE_STARS', userId: 'user-123', page: 2, pageSize: 10 },
      },
      ctx,
    );

    expect(result.totalCount).toBe(42);
    expect(result.hasMore).toBe(true); // 30 / 42
    expect(result.meta).toMatchObject({ userId: 'user-123', userName: 'Marco D', climbCount: 42 });
    expect(pageCalls.limit[0]).toEqual([10]);
    expect(pageCalls.offset[0]).toEqual([20]);
  });

  it('MOST_REPEATED applies HAVING SUM > 1 and orders by total attempts', async () => {
    const ctx = makeCtx();

    mockDb.select.mockReturnValueOnce(makeChain([USER_ROW]).chain);
    const { chain: pageChain, calls: pageCalls } = makeChain([]);
    mockDb.select.mockReturnValueOnce(pageChain);
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 0 }]).chain); // count subquery wrapper
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 0 }]).chain); // count outer

    await playlistQueries.smartPlaylist(
      null,
      {
        input: { type: 'MOST_REPEATED', userId: 'user-123' },
      },
      ctx,
    );

    expect(pageCalls.having.length).toBe(1);
    expect(pageCalls.orderBy.length).toBe(1);
    expect(pageCalls.groupBy.length).toBe(1);
  });

  it('PROJECTS scopes the sent-climbs subquery by boardType when boardName is provided', async () => {
    const ctx = makeCtx();

    mockDb.select.mockReturnValueOnce(makeChain([USER_ROW]).chain);

    // page selects: outer + inner sentSubquery (sentSubquery is built lazily during the where())
    const { chain: outerChain } = makeChain([]);
    mockDb.select.mockReturnValueOnce(outerChain);
    const { chain: sentChainPage, calls: sentCallsPage } = makeChain([]);
    mockDb.select.mockReturnValueOnce(sentChainPage);

    // count selects: same shape
    const { chain: countOuter } = makeChain([{ count: 0 }]);
    mockDb.select.mockReturnValueOnce(countOuter);
    const { chain: sentChainCount, calls: sentCallsCount } = makeChain([]);
    mockDb.select.mockReturnValueOnce(sentChainCount);

    await playlistQueries.smartPlaylist(
      null,
      {
        input: { type: 'PROJECTS', userId: 'user-123', boardName: 'kilter' },
      },
      ctx,
    );

    // Each sentSubquery should have been built with two conditions (userId + boardType in addition
    // to the inArray status), so where() has been called once with one composed argument.
    expect(sentCallsPage.where.length).toBe(1);
    expect(sentCallsCount.where.length).toBe(1);
  });

  it('throws when user does not exist', async () => {
    const ctx = makeCtx();
    mockDb.select.mockReturnValueOnce(makeChain([]).chain);

    await expect(
      playlistQueries.smartPlaylist(
        null,
        {
          input: { type: 'FIVE_STARS', userId: 'missing' },
        },
        ctx,
      ),
    ).rejects.toThrow('User not found');
  });

  it('is callable without authentication (public)', async () => {
    const ctx = makeCtx({ isAuthenticated: false, userId: undefined });

    mockDb.select.mockReturnValueOnce(makeChain([USER_ROW]).chain);
    mockDb.select.mockReturnValueOnce(makeChain([]).chain);
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 0 }]).chain);

    const result = await playlistQueries.smartPlaylist(
      null,
      {
        input: { type: 'FIVE_STARS', userId: 'user-123' },
      },
      ctx,
    );
    expect(result.meta.userId).toBe('user-123');
  });
});

describe('mySmartPlaylistCounts resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const ctx = makeCtx({ isAuthenticated: false, userId: undefined });
    await expect(playlistQueries.mySmartPlaylistCounts(null, undefined, ctx)).rejects.toThrow(
      'Authentication required',
    );
  });

  it('returns one entry per smart-playlist type', async () => {
    const ctx = makeCtx();

    // FIVE_STARS count
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 7 }]).chain);
    // MOST_REPEATED — the resolver wraps the GROUP BY/HAVING in a subquery,
    // so two select calls happen for this type. The subquery's `.as()` returns
    // a value used as the from() target of the outer select — the outer is
    // what eventually awaits to a count.
    mockDb.select.mockReturnValueOnce(makeChain([]).chain); // inner
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 3 }]).chain); // outer
    // PROJECTS outer
    mockDb.select.mockReturnValueOnce(makeChain([{ count: 5 }]).chain);
    // PROJECTS sentSubquery
    mockDb.select.mockReturnValueOnce(makeChain([]).chain);

    const result = await playlistQueries.mySmartPlaylistCounts(null, undefined, ctx);
    expect(result).toEqual([
      { type: 'FIVE_STARS', count: 7 },
      { type: 'MOST_REPEATED', count: 3 },
      { type: 'PROJECTS', count: 5 },
    ]);
  });
});

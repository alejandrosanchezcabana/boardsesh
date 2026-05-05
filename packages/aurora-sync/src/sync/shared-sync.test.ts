import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncData } from '../api/sync-api-types';
import type { SyncOptions } from '../api/types';

const { mockSharedSync, mockPopulateDenormalizedColumns, mockConvertLitUpHolds } = vi.hoisted(() => ({
  mockSharedSync: vi.fn(),
  mockPopulateDenormalizedColumns: vi.fn().mockResolvedValue(undefined),
  mockConvertLitUpHolds: vi.fn().mockReturnValue({}),
}));

vi.mock('../api/shared-sync-api', () => ({
  sharedSync: mockSharedSync,
}));

vi.mock('@boardsesh/db/queries', () => ({
  populateDenormalizedColumns: mockPopulateDenormalizedColumns,
}));

vi.mock('@boardsesh/board-constants/hold-states', () => ({
  convertLitUpHoldsStringToMap: mockConvertLitUpHolds,
}));

// drizzle() returns a client we never actually issue queries against; the
// shim below replaces its surface area entirely. We only mock `drizzle`
// itself so the import doesn't fail.
vi.mock('drizzle-orm/postgres-js', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm/postgres-js')>('drizzle-orm/postgres-js');
  return {
    ...actual,
    drizzle: vi.fn(() => createDbShim()),
  };
});

import { syncSharedData } from './shared-sync';

/**
 * Minimal db shim. Drizzle's query builder is fluent — every call returns
 * `this` until awaited. We don't care about the SQL produced; we only need
 * the `transaction` callback and the `select`/`insert` chains to be
 * thenable. The fluent shim short-circuits all chained methods to itself
 * and resolves to an empty array for SELECTs.
 */
function createDbShim() {
  const fluent: Record<string, unknown> = {};
  const proxy: ProxyHandler<typeof fluent> = {
    get(_target, prop) {
      if (prop === 'then') return undefined; // not a thenable, just chainable
      if (prop === Symbol.toPrimitive) return undefined;
      if (prop === 'transaction') {
        return async (cb: (tx: typeof shim) => Promise<void>) => cb(shim);
      }
      if (prop === 'execute') return async () => undefined;
      // Every method (insert, select, values, where, onConflictDoUpdate, etc.)
      // returns the same fluent object, so chains keep flowing. The terminal
      // `await` resolves to whatever the proxy is — fine for INSERTs (we don't
      // read the result) and SELECTs that hit `.from(...)`.
      return new Proxy(() => shim, {
        apply: () => shim,
      });
    },
  };
  const shim = new Proxy(fluent, proxy) as Record<string, unknown> & {
    transaction: (cb: (tx: unknown) => Promise<void>) => Promise<void>;
  };
  return shim;
}

function complete(payload: Partial<SyncData>): SyncData {
  return { _complete: true, ...payload };
}

function partial(payload: Partial<SyncData>): SyncData {
  return { _complete: false, ...payload };
}

describe('syncSharedData loop', () => {
  beforeEach(() => {
    mockSharedSync.mockReset();
    mockPopulateDenormalizedColumns.mockReset();
    mockPopulateDenormalizedColumns.mockResolvedValue(undefined);
  });

  it('exits after one batch when Aurora reports _complete', async () => {
    mockSharedSync.mockResolvedValueOnce(complete({ shared_syncs: [] }));

    const result = await syncSharedData(fakePostgresClient(), 'decoy', 'token');

    expect(mockSharedSync).toHaveBeenCalledTimes(1);
    expect(result.complete).toBe(true);
    expect(result.newClimbs).toEqual([]);
  });

  it('keeps looping while _complete is false', async () => {
    mockSharedSync
      .mockResolvedValueOnce(partial({ shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-01-01 00:00:00' }] }))
      .mockResolvedValueOnce(partial({ shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-02-01 00:00:00' }] }))
      .mockResolvedValueOnce(complete({ shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-03-01 00:00:00' }] }));

    await syncSharedData(fakePostgresClient(), 'decoy', 'token');

    expect(mockSharedSync).toHaveBeenCalledTimes(3);
  });

  it('stops at MAX_SYNC_ATTEMPTS even when Aurora never reports _complete', async () => {
    // Always partial — never complete.
    mockSharedSync.mockResolvedValue(partial({ shared_syncs: [] }));

    const result = await syncSharedData(fakePostgresClient(), 'decoy', 'token');

    expect(mockSharedSync).toHaveBeenCalledTimes(100); // MAX_SYNC_ATTEMPTS
    expect(result.complete).toBe(false);
  });
});

describe('syncSharedData cursor merge', () => {
  beforeEach(() => {
    mockSharedSync.mockReset();
    mockPopulateDenormalizedColumns.mockReset();
    mockPopulateDenormalizedColumns.mockResolvedValue(undefined);
  });

  it('keeps the cursor for tables Aurora did not return in the latest batch', async () => {
    // Batch 1: Aurora returns shared_syncs only for climbs. Other tables
    // (products, holes, etc.) had no new data; their cursors must not reset.
    mockSharedSync
      .mockResolvedValueOnce(
        partial({
          shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-04-01 00:00:00' }],
        }),
      )
      .mockResolvedValueOnce(complete({ shared_syncs: [] }));

    await syncSharedData(fakePostgresClient(), 'decoy', 'token');

    // The second call's syncOptions.sharedSyncs should still contain all 15
    // tables, with `climbs` advanced to 2026-04-01 and the rest at the
    // default floor (2024-05-01) since the in-memory map was seeded empty.
    const secondCallOptions = mockSharedSync.mock.calls[1][1] as SyncOptions;
    const cursors = new Map(
      (secondCallOptions.sharedSyncs ?? []).map((s) => [s.table_name, s.last_synchronized_at]),
    );
    expect(cursors.get('climbs')).toBe('2026-04-01 00:00:00');
    expect(cursors.get('products')).toBe('2024-05-01 00:00:00.000000');
    expect(cursors.get('holes')).toBe('2024-05-01 00:00:00.000000');
    // 15 entries — every shared-sync table is represented every batch.
    expect(secondCallOptions.sharedSyncs?.length).toBe(15);
  });

  it('advances cursors progressively as Aurora returns updates over multiple batches', async () => {
    mockSharedSync
      .mockResolvedValueOnce(
        partial({
          shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-01-01 00:00:00' }],
        }),
      )
      .mockResolvedValueOnce(
        partial({
          shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-02-01 00:00:00' }],
        }),
      )
      .mockResolvedValueOnce(
        complete({
          shared_syncs: [{ table_name: 'climbs', last_synchronized_at: '2026-03-01 00:00:00' }],
        }),
      );

    await syncSharedData(fakePostgresClient(), 'decoy', 'token');

    const climbsCursors = mockSharedSync.mock.calls.map((call) => {
      const opts = call[1] as SyncOptions;
      return opts.sharedSyncs?.find((s) => s.table_name === 'climbs')?.last_synchronized_at;
    });
    expect(climbsCursors).toEqual([
      '2024-05-01 00:00:00.000000', // batch 1: in-memory map empty → default floor
      '2026-01-01 00:00:00', // batch 2: after batch 1's response merged
      '2026-02-01 00:00:00', // batch 3: after batch 2's response merged
    ]);
  });

  it('floors a missing cursor at 2024-05-01 rather than 1970', async () => {
    mockSharedSync.mockResolvedValueOnce(complete({ shared_syncs: [] }));

    await syncSharedData(fakePostgresClient(), 'decoy', 'token');

    const firstCallOptions = mockSharedSync.mock.calls[0][1] as SyncOptions;
    expect(firstCallOptions.sharedSyncs?.[0].last_synchronized_at).toBe('2024-05-01 00:00:00.000000');
  });
});

/**
 * postgres.js client stub. `syncSharedData` only uses it as the argument to
 * `drizzle()` — which we mock to return our shim — so the real client is
 * never invoked. Casting is fine here because no method on the actual client
 * surface is called.
 */
function fakePostgresClient(): never {
  return {} as never;
}

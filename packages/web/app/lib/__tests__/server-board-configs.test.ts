import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock React.cache - in test environment it may not deduplicate, so we test the function itself
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    // In server components, React.cache deduplicates within a request.
    // In tests, we just pass through to verify the function logic.
    cache: (fn: Function) => fn,
  };
});

const mockGetBoardSelectorOptions = vi.fn(() => ({
  layouts: {
    kilter: [{ id: 8, name: 'Original' }],
    tension: [{ id: 9, name: 'Original' }],
  },
  sizes: {
    'kilter-8': [{ id: 25, name: '12x12' }],
    'tension-9': [{ id: 1, name: 'Full' }],
  },
  sets: {
    'kilter-8-25': [{ id: 26, name: 'Set A' }],
    'tension-9-1': [{ id: 8, name: 'Set A' }],
  },
}));

const mockGetBoardDetails = vi.fn(() => ({
  board_name: 'kilter',
  layout_id: 8,
  size_id: 25,
  set_ids: [26, 27],
  images_to_holds: {},
  holdsData: [],
  edge_left: 0,
  edge_right: 100,
  edge_bottom: 0,
  edge_top: 100,
  boardWidth: 1080,
  boardHeight: 1920,
  supportsMirroring: false,
}));

vi.mock('@/app/lib/__generated__/product-sizes-data', () => ({
  getBoardSelectorOptions: mockGetBoardSelectorOptions,
  getBoardDetails: mockGetBoardDetails,
}));

vi.mock('@/app/lib/moonboard-config', () => ({
  MOONBOARD_ENABLED: false,
  MOONBOARD_LAYOUTS: {},
  MOONBOARD_SETS: {},
  MOONBOARD_SIZE: { id: 1, name: 'Standard', description: 'Standard MoonBoard' },
}));

describe('getAllBoardConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns BoardConfigData with layouts, sizes, sets, and details', async () => {
    const { getAllBoardConfigs } = await import('../server-board-configs');

    const result = await getAllBoardConfigs();

    expect(result).toHaveProperty('layouts');
    expect(result).toHaveProperty('sizes');
    expect(result).toHaveProperty('sets');
    expect(result).toHaveProperty('details');

    expect(result.layouts.kilter).toEqual([{ id: 8, name: 'Original' }]);
    expect(result.layouts.tension).toEqual([{ id: 9, name: 'Original' }]);
    expect(result.sizes['kilter-8']).toEqual([{ id: 25, name: '12x12' }]);
    expect(result.sets['kilter-8-25']).toEqual([{ id: 26, name: 'Set A' }]);
  });

  it('fetches board details for all 5 common configurations', async () => {
    const { getAllBoardConfigs } = await import('../server-board-configs');

    await getAllBoardConfigs();

    expect(mockGetBoardDetails).toHaveBeenCalledTimes(5);

    // Verify each of the 5 common configs was requested
    expect(mockGetBoardDetails).toHaveBeenCalledWith({
      board_name: 'kilter',
      layout_id: 8,
      size_id: 25,
      set_ids: [26, 27, 28, 29],
    });
    expect(mockGetBoardDetails).toHaveBeenCalledWith({
      board_name: 'kilter',
      layout_id: 8,
      size_id: 17,
      set_ids: [26, 27],
    });
    expect(mockGetBoardDetails).toHaveBeenCalledWith({
      board_name: 'tension',
      layout_id: 10,
      size_id: 6,
      set_ids: [12, 13],
    });
    expect(mockGetBoardDetails).toHaveBeenCalledWith({
      board_name: 'tension',
      layout_id: 9,
      size_id: 1,
      set_ids: [8, 9, 10, 11],
    });
    expect(mockGetBoardDetails).toHaveBeenCalledWith({
      board_name: 'tension',
      layout_id: 11,
      size_id: 6,
      set_ids: [12, 13],
    });

    // Verify details keys are populated
    const result = await getAllBoardConfigs();
    expect(result.details['kilter-8-25-26,27,28,29']).not.toBeNull();
    expect(result.details['kilter-8-17-26,27']).not.toBeNull();
    expect(result.details['tension-10-6-12,13']).not.toBeNull();
    expect(result.details['tension-9-1-8,9,10,11']).not.toBeNull();
    expect(result.details['tension-11-6-12,13']).not.toBeNull();
  });

  it('handles individual board detail failures gracefully (sets null, does not throw)', async () => {
    // Make the second call fail
    let callCount = 0;
    mockGetBoardDetails.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Network error');
      }
      return {
        board_name: 'kilter',
        layout_id: 8,
        size_id: 25,
        set_ids: [26, 27],
        images_to_holds: {},
        holdsData: [],
        edge_left: 0,
        edge_right: 100,
        edge_bottom: 0,
        edge_top: 100,
        boardWidth: 1080,
        boardHeight: 1920,
        supportsMirroring: false,
      };
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { getAllBoardConfigs } = await import('../server-board-configs');
    const result = await getAllBoardConfigs();

    // Should not throw
    expect(result).toBeDefined();

    // The failed config should have null, others should have details
    const detailValues = Object.values(result.details);
    const nullDetails = detailValues.filter((v) => v === null);
    const nonNullDetails = detailValues.filter((v) => v !== null);

    expect(nullDetails).toHaveLength(1);
    expect(nonNullDetails).toHaveLength(4);

    // console.error should have been called for the failure
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch details for'), expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('includes MoonBoard configurations when enabled', async () => {
    // Reset modules so the re-import picks up the new mock
    vi.resetModules();
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react');
      return { ...actual, cache: (fn: Function) => fn };
    });
    vi.doMock('@/app/lib/__generated__/product-sizes-data', () => ({
      getBoardSelectorOptions: mockGetBoardSelectorOptions,
      getBoardDetails: mockGetBoardDetails,
    }));
    vi.doMock('@/app/lib/moonboard-config', () => ({
      MOONBOARD_ENABLED: true,
      MOONBOARD_LAYOUTS: {
        'moonboard-2016': { id: 2, name: 'MoonBoard 2016', folder: 'moonboard2016' },
        'moonboard-2024': { id: 3, name: 'MoonBoard 2024', folder: 'moonboard2024' },
      },
      MOONBOARD_SETS: {
        'moonboard-2016': [
          { id: 2, name: 'Hold Set A', imageFile: 'holdseta.png' },
          { id: 3, name: 'Hold Set B', imageFile: 'holdsetb.png' },
        ],
        'moonboard-2024': [
          { id: 5, name: 'Hold Set D', imageFile: 'holdsetd.png' },
        ],
      },
      MOONBOARD_SIZE: { id: 1, name: 'Standard', description: '11x18 Grid' },
    }));

    // Re-import to pick up the new mock
    const { getAllBoardConfigs } = await import('../server-board-configs');

    const result = await getAllBoardConfigs();

    // Should have moonboard layouts
    expect(result.layouts.moonboard).toBeDefined();
    expect(result.layouts.moonboard).toHaveLength(2);
    expect(result.layouts.moonboard).toContainEqual({ id: 2, name: 'MoonBoard 2016' });
    expect(result.layouts.moonboard).toContainEqual({ id: 3, name: 'MoonBoard 2024' });

    // Should have sizes for each moonboard layout
    expect(result.sizes['moonboard-2']).toEqual([{ id: 1, name: 'Standard', description: '11x18 Grid' }]);
    expect(result.sizes['moonboard-3']).toEqual([{ id: 1, name: 'Standard', description: '11x18 Grid' }]);

    // Should have sets for each layout-size combination
    expect(result.sets['moonboard-2-1']).toEqual([
      { id: 2, name: 'Hold Set A' },
      { id: 3, name: 'Hold Set B' },
    ]);
    expect(result.sets['moonboard-3-1']).toEqual([{ id: 5, name: 'Hold Set D' }]);
  });

  it('React.cache deduplication - calling twice returns same promise/reference', async () => {
    // Reset modules so the re-import picks up the new mock
    vi.resetModules();

    // Track how many times the underlying function is actually invoked
    let underlyingCallCount = 0;
    const cacheFn = (fn: Function) => {
      // Simulate React.cache: memoize the result so repeated calls
      // return the exact same reference (like React.cache does per-request).
      let cached: unknown = undefined;
      let hasCached = false;
      return (...args: unknown[]) => {
        if (!hasCached) {
          underlyingCallCount++;
          cached = fn(...args);
          hasCached = true;
        }
        return cached;
      };
    };

    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react');
      return {
        ...actual,
        default: { ...actual, cache: cacheFn },
        cache: cacheFn,
      };
    });
    vi.doMock('@/app/lib/__generated__/product-sizes-data', () => ({
      getBoardSelectorOptions: mockGetBoardSelectorOptions,
      getBoardDetails: mockGetBoardDetails,
    }));
    vi.doMock('@/app/lib/moonboard-config', () => ({
      MOONBOARD_ENABLED: false,
      MOONBOARD_LAYOUTS: {},
      MOONBOARD_SETS: {},
      MOONBOARD_SIZE: { id: 1, name: 'Standard', description: 'Standard MoonBoard' },
    }));

    const { getAllBoardConfigs } = await import('../server-board-configs');

    const result1 = getAllBoardConfigs();
    const result2 = getAllBoardConfigs();

    // With React.cache, both calls should return the exact same promise reference
    expect(result1).toBe(result2);

    // The underlying function should only have been invoked once
    expect(underlyingCallCount).toBe(1);

    // getBoardDetails should only be called 5 times (from the single invocation)
    await result1;
    expect(mockGetBoardDetails).toHaveBeenCalledTimes(5);
  });
});

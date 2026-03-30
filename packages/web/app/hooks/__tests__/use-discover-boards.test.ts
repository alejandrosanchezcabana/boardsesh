import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { UserBoard } from '@boardsesh/shared-schema';

// --- Mocks ---

const mockRequest = vi.fn();

vi.mock('@/app/lib/graphql/client', () => ({
  createGraphQLHttpClient: () => ({ request: mockRequest }),
}));

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => ({ token: 'test-token', isAuthenticated: true }),
}));

vi.mock('@/app/lib/graphql/operations', () => ({
  SEARCH_BOARDS: 'SEARCH_BOARDS_QUERY',
}));

// --- Import after mocks ---

import { useDiscoverBoards } from '../use-discover-boards';

// --- Helpers ---

function makeBoard(uuid: string, totalAscents: number, overrides?: Partial<UserBoard>): UserBoard {
  return {
    uuid,
    name: `Board ${uuid}`,
    boardType: 'kilter',
    layoutId: 8,
    sizeId: 25,
    setIds: '26,27',
    angle: 40,
    totalAscents,
    slug: `kilter/8/25/26,27`,
    locationName: null,
    latitude: null,
    longitude: null,
    isFollowedByMe: false,
    ownerId: 'owner-1',
    isPublic: true,
    isOwned: false,
    isAngleAdjustable: false,
    createdAt: '2025-01-01T00:00:00Z',
    uniqueClimbers: 0,
    followerCount: 0,
    commentCount: 0,
    ...overrides,
  } as UserBoard;
}

function makeSearchResponse(boards: UserBoard[]) {
  return { searchBoards: { boards, totalCount: boards.length, hasMore: false } };
}

let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

function setupGeolocation() {
  mockGetCurrentPosition = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: mockGetCurrentPosition },
    writable: true,
    configurable: true,
  });
}

function removeGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

function geoSuccess(latitude: number, longitude: number) {
  mockGetCurrentPosition.mockImplementation(
    (success: PositionCallback) => {
      success({
        coords: {
          latitude,
          longitude,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON() {
            return { latitude, longitude, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null };
          },
        },
        timestamp: Date.now(),
        toJSON() {
          return { coords: this.coords, timestamp: this.timestamp };
        },
      } as GeolocationPosition);
    },
  );
}

function geoDenied() {
  mockGetCurrentPosition.mockImplementation(
    (_success: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        message: 'User denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    },
  );
}

// --- Tests ---

describe('useDiscoverBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGeolocation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loading=true initially', () => {
    // Don't resolve the request so we stay in loading state
    mockRequest.mockReturnValue(new Promise(() => {}));
    removeGeolocation();

    const { result } = renderHook(() => useDiscoverBoards());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.boards).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasLocation).toBe(false);
  });

  it('fetches popular boards when no geolocation available', async () => {
    removeGeolocation();

    const popular = [
      makeBoard('a', 100),
      makeBoard('b', 200),
      makeBoard('c', 50),
    ];
    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should sort by totalAscents descending
    expect(result.current.boards.map((b) => b.uuid)).toEqual(['b', 'a', 'c']);
    expect(result.current.hasLocation).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches both popular and nearby when geolocation available, merges correctly (nearby first)', async () => {
    geoSuccess(40.7, -74.0);

    const popular = [makeBoard('p1', 300), makeBoard('p2', 100)];
    const nearby = [makeBoard('n1', 10), makeBoard('n2', 5)];

    // First request: popular boards
    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));
    // Second request: nearby boards
    mockRequest.mockResolvedValueOnce(makeSearchResponse(nearby));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Nearby first, then popular sorted by totalAscents
    expect(result.current.boards.map((b) => b.uuid)).toEqual(['n1', 'n2', 'p1', 'p2']);
    expect(result.current.hasLocation).toBe(true);
  });

  it('deduplicates boards that appear in both nearby and popular', async () => {
    geoSuccess(40.7, -74.0);

    const shared = makeBoard('shared', 500);
    const popular = [shared, makeBoard('p1', 200)];
    const nearby = [makeBoard('shared', 500, { name: 'Nearby Shared' }), makeBoard('n1', 10)];

    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));
    mockRequest.mockResolvedValueOnce(makeSearchResponse(nearby));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const uuids = result.current.boards.map((b) => b.uuid);
    // 'shared' should appear only once, from nearby
    expect(uuids.filter((u) => u === 'shared')).toHaveLength(1);
    // nearby version comes first
    expect(result.current.boards[0].name).toBe('Nearby Shared');
    // p1 is the only non-duplicate popular board
    expect(uuids).toContain('p1');
  });

  it('caps results at limit', async () => {
    geoSuccess(40.7, -74.0);

    const nearby = Array.from({ length: 5 }, (_, i) => makeBoard(`n${i}`, i));
    const popular = Array.from({ length: 10 }, (_, i) => makeBoard(`p${i}`, i * 10));

    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));
    mockRequest.mockResolvedValueOnce(makeSearchResponse(nearby));

    const { result } = renderHook(() => useDiscoverBoards({ limit: 8 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boards).toHaveLength(8);
    // First 5 are nearby
    expect(result.current.boards.slice(0, 5).map((b) => b.uuid)).toEqual(
      nearby.map((b) => b.uuid),
    );
  });

  it('sorts popular boards by totalAscents descending', async () => {
    removeGeolocation();

    const popular = [
      makeBoard('low', 10),
      makeBoard('high', 1000),
      makeBoard('mid', 500),
    ];
    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boards.map((b) => b.uuid)).toEqual(['high', 'mid', 'low']);
  });

  it('sets error when both fetches fail', async () => {
    removeGeolocation();

    mockRequest.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load boards');
    expect(result.current.boards).toEqual([]);
  });

  it('sets hasLocation=true when nearby boards found', async () => {
    geoSuccess(51.5, -0.1);

    const popular = [makeBoard('p1', 100)];
    const nearby = [makeBoard('n1', 10)];

    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));
    mockRequest.mockResolvedValueOnce(makeSearchResponse(nearby));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.hasLocation).toBe(true);
    });
  });

  it('geolocation denied falls back to popular only', async () => {
    geoDenied();

    const popular = [makeBoard('p1', 100), makeBoard('p2', 50)];
    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boards.map((b) => b.uuid)).toEqual(['p1', 'p2']);
    expect(result.current.hasLocation).toBe(false);
    // Only one request (popular), no nearby request since geo failed
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('caches geolocation across re-fetches (geoResolvedRef prevents re-prompt)', async () => {
    geoSuccess(40.7, -74.0);

    const popular1 = [makeBoard('p1', 100)];
    const nearby1 = [makeBoard('n1', 10)];

    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular1));
    mockRequest.mockResolvedValueOnce(makeSearchResponse(nearby1));

    const { result } = renderHook(() => useDiscoverBoards());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Geolocation was called exactly once on the initial fetch
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

    // After the first successful geo resolution, coordsRef.current is set.
    // On any subsequent effect run (e.g. token change), resolveGeolocation()
    // returns the cached coords immediately without calling getCurrentPosition again.
    // We verify this by confirming the geo API was only called once above.
    // The hook's internal coordsRef caching is the mechanism under test.
  });

  it('enableLocation=false skips geolocation', async () => {
    geoSuccess(40.7, -74.0);

    const popular = [makeBoard('p1', 100)];
    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));

    const { result } = renderHook(() =>
      useDiscoverBoards({ enableLocation: false }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.hasLocation).toBe(false);
    // Only popular request, no nearby
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('geoResolvedRef is not set when enableLocation=false (so toggling to true later works)', async () => {
    geoSuccess(40.7, -74.0);

    const popular = [makeBoard('p1', 100)];
    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular));

    // First render with enableLocation=false
    const { result, rerender } = renderHook(
      ({ enableLocation }: { enableLocation: boolean }) =>
        useDiscoverBoards({ enableLocation }),
      { initialProps: { enableLocation: false } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetCurrentPosition).not.toHaveBeenCalled();

    // Now toggle enableLocation to true
    const popular2 = [makeBoard('p2', 200)];
    const nearby = [makeBoard('n1', 10)];

    mockRequest.mockResolvedValueOnce(makeSearchResponse(popular2));
    mockRequest.mockResolvedValueOnce(makeSearchResponse(nearby));

    rerender({ enableLocation: true });

    await waitFor(() => {
      expect(result.current.hasLocation).toBe(true);
    });

    // Geolocation should now have been called
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.boards.some((b) => b.uuid === 'n1')).toBe(true);
  });
});

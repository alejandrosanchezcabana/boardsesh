// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { UserBoard } from '@boardsesh/shared-schema';

// --- Mocks ---

const mockRequest = vi.fn();

vi.mock('@/app/lib/graphql/client', () => ({
  createGraphQLHttpClient: () => ({ request: mockRequest }),
}));

vi.mock('@/app/lib/graphql/operations', () => ({
  SEARCH_BOARDS: 'SEARCH_BOARDS_QUERY',
}));

const mockUseGeolocation = vi.fn();
vi.mock('@/app/hooks/use-geolocation', () => ({
  useGeolocation: (...args: unknown[]) => mockUseGeolocation(...args),
}));

vi.mock('@/app/hooks/use-ws-auth-token', () => ({
  useWsAuthToken: () => ({ token: 'test-token', isAuthenticated: true }),
}));

// --- Import after mocks ---

import { useNearbyBoards } from '../use-nearby-boards';

// --- Helpers ---

function makeBoard(uuid: string, overrides?: Partial<UserBoard>): UserBoard {
  return {
    uuid,
    name: `Board ${uuid}`,
    boardType: 'kilter',
    layoutId: 8,
    sizeId: 25,
    setIds: '26,27',
    angle: 40,
    totalAscents: 10,
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

const mockRequestPermission = vi.fn();

function setGeolocation(overrides: Partial<ReturnType<typeof mockUseGeolocation>> = {}) {
  mockUseGeolocation.mockReturnValue({
    coordinates: null,
    loading: false,
    permissionState: null,
    requestPermission: mockRequestPermission,
    refresh: vi.fn(),
    error: null,
    ...overrides,
  });
}

// --- Tests ---

describe('useNearbyBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGeolocation();
  });

  it('returns empty boards and not loading when not enabled', () => {
    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: false }),
    );

    expect(result.current.boards).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('returns empty boards when coordinates are not available', () => {
    setGeolocation({ coordinates: null });

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    expect(result.current.boards).toEqual([]);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('fetches boards when coordinates are available', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });

    const boards = [makeBoard('b1'), makeBoard('b2')];
    mockRequest.mockResolvedValueOnce(makeSearchResponse(boards));

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boards).toEqual(boards);
    expect(result.current.error).toBeNull();
  });

  it('passes correct default parameters to SEARCH_BOARDS', async () => {
    setGeolocation({
      coordinates: { latitude: 51.5, longitude: -0.12, accuracy: 15 },
      permissionState: 'granted',
    });
    mockRequest.mockResolvedValueOnce(makeSearchResponse([]));

    renderHook(() => useNearbyBoards({ enabled: true }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    expect(mockRequest).toHaveBeenCalledWith('SEARCH_BOARDS_QUERY', {
      input: {
        latitude: 51.5,
        longitude: -0.12,
        radiusKm: 5,
        limit: 10,
        offset: 0,
      },
    });
  });

  it('passes custom radiusKm and limit parameters', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });
    mockRequest.mockResolvedValueOnce(makeSearchResponse([]));

    renderHook(() =>
      useNearbyBoards({ enabled: true, radiusKm: 100, limit: 25 }),
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    expect(mockRequest).toHaveBeenCalledWith('SEARCH_BOARDS_QUERY', {
      input: {
        latitude: 40.7,
        longitude: -74.0,
        radiusKm: 100,
        limit: 25,
        offset: 0,
      },
    });
  });

  it('returns permissionState from useGeolocation', () => {
    setGeolocation({ permissionState: 'denied' });

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    expect(result.current.permissionState).toBe('denied');
  });

  it('returns requestPermission from useGeolocation', () => {
    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    expect(result.current.requestPermission).toBe(mockRequestPermission);
  });

  it('sets error when GraphQL request fails', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });
    mockRequest.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to find nearby boards');
    expect(result.current.boards).toEqual([]);
  });

  it('shows loading state while geolocation is loading', () => {
    setGeolocation({ loading: true, permissionState: 'granted' });

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('does not show loading when permission is denied even if geo loading', () => {
    setGeolocation({ loading: true, permissionState: 'denied' });

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('does not show loading when not enabled', () => {
    setGeolocation({ loading: true });

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: false }),
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('shows loading during API call', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });

    let resolveRequest: (value: unknown) => void;
    mockRequest.mockReturnValueOnce(
      new Promise((resolve) => { resolveRequest = resolve; }),
    );

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    // Should be loading while the request is in flight
    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isLoading).toBe(true);

    // Resolve the request
    resolveRequest!(makeSearchResponse([makeBoard('b1')]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boards).toHaveLength(1);
  });

  it('cancels in-flight request when unmounted', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });

    let resolveRequest: (value: unknown) => void;
    mockRequest.mockReturnValueOnce(
      new Promise((resolve) => { resolveRequest = resolve; }),
    );

    const { unmount } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Resolve after unmount - state should not update (no act warning)
    resolveRequest!(makeSearchResponse([makeBoard('b1')]));
  });

  it('auto-requests permission when enabled and permission is granted but no coordinates', () => {
    setGeolocation({ permissionState: 'granted', coordinates: null });

    renderHook(() => useNearbyBoards({ enabled: true }));

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('does not auto-request permission when permissionState is null (iOS Safari)', () => {
    setGeolocation({ permissionState: null, coordinates: null });

    renderHook(() => useNearbyBoards({ enabled: true }));

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('does not auto-request permission when not enabled', () => {
    setGeolocation({ permissionState: 'granted', coordinates: null });

    renderHook(() => useNearbyBoards({ enabled: false }));

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('does not auto-request permission when coordinates already exist', () => {
    setGeolocation({
      permissionState: 'granted',
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
    });
    mockRequest.mockResolvedValueOnce(makeSearchResponse([]));

    renderHook(() => useNearbyBoards({ enabled: true }));

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('does not fetch when enabled but coordinates are null', () => {
    setGeolocation({ coordinates: null, permissionState: 'prompt' });

    renderHook(() => useNearbyBoards({ enabled: true }));

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('clears error on successful refetch', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });
    mockRequest.mockRejectedValueOnce(new Error('fail'));

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useNearbyBoards({ enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to find nearby boards');
    });

    // Simulate coordinates changing (triggers refetch via lat/lon deps)
    setGeolocation({
      coordinates: { latitude: 40.8, longitude: -74.1, accuracy: 10 },
      permissionState: 'granted',
    });
    mockRequest.mockResolvedValueOnce(makeSearchResponse([makeBoard('b1')]));

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.boards).toHaveLength(1);
    });
  });

  it('returns empty boards when API returns no nearby boards', async () => {
    setGeolocation({
      coordinates: { latitude: 40.7, longitude: -74.0, accuracy: 10 },
      permissionState: 'granted',
    });
    mockRequest.mockResolvedValueOnce(makeSearchResponse([]));

    const { result } = renderHook(() =>
      useNearbyBoards({ enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.boards).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

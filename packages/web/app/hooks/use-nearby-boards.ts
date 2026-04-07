import { useState, useEffect, useRef } from 'react';
import { useGeolocation } from '@/app/hooks/use-geolocation';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import {
  SEARCH_BOARDS,
  type SearchBoardsQueryResponse,
} from '@/app/lib/graphql/operations';
import type { UserBoard } from '@boardsesh/shared-schema';

interface UseNearbyBoardsOptions {
  /** Whether to activate the hook (e.g., when the drawer is open) */
  enabled: boolean;
  /** Search radius in kilometers */
  radiusKm?: number;
  /** Max number of boards to return */
  limit?: number;
}

interface UseNearbyBoardsReturn {
  boards: UserBoard[];
  isLoading: boolean;
  permissionState: PermissionState | null;
  requestPermission: () => Promise<void>;
  error: string | null;
}

/**
 * Hook that combines browser geolocation with the searchBoards GraphQL query
 * to discover public boards near the user's current location.
 */
export function useNearbyBoards({
  enabled,
  radiusKm = 5,
  limit = 10,
}: UseNearbyBoardsOptions): UseNearbyBoardsReturn {
  const { coordinates, loading: geoLoading, permissionState, requestPermission } = useGeolocation();
  const { token } = useWsAuthToken();
  const [boards, setBoards] = useState<UserBoard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  // Auto-fetch position when enabled and permission allows it.
  // useGeolocation only checks permission state on mount — it doesn't
  // auto-fetch coordinates. We trigger requestPermission (which calls
  // getCurrentPosition) when permission is 'granted'. On iOS Safari where
  // the Permissions API isn't supported, permissionState stays null — we
  // don't auto-request in that case to avoid an unexpected browser prompt.
  // The NearbyBoardsSection and BoardMapView show an explicit button instead.
  useEffect(() => {
    if (!enabled || permissionState !== 'granted') return;
    if (coordinates) return; // already have coords
    requestPermission();
  }, [enabled, permissionState, coordinates, requestPermission]);

  // Extract primitive values from coordinates to use as stable dependencies.
  // The coordinates object is recreated on each geolocation state update,
  // so using it directly would cause infinite effect re-runs.
  const lat = coordinates?.latitude ?? null;
  const lon = coordinates?.longitude ?? null;

  // Fetch nearby boards when coordinates are available
  useEffect(() => {
    if (!enabled || lat === null || lon === null) return;

    let cancelled = false;
    if (!hasDataRef.current) {
      setIsLoading(true);
    }
    setError(null);

    const client = createGraphQLHttpClient(token);

    client
      .request<SearchBoardsQueryResponse>(SEARCH_BOARDS, {
        input: {
          latitude: lat,
          longitude: lon,
          radiusKm,
          limit,
          offset: 0,
        },
      })
      .then((data) => {
        if (!cancelled) {
          setBoards(data.searchBoards.boards);
          hasDataRef.current = true;
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch nearby boards:', err);
        if (!cancelled) setError('Failed to find nearby boards');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, lat, lon, token, radiusKm, limit]);

  // Combine loading states: geo loading + query loading
  const combinedLoading = enabled && (geoLoading || isLoading) && permissionState !== 'denied';

  return {
    boards,
    isLoading: combinedLoading,
    permissionState,
    requestPermission,
    error,
  };
}

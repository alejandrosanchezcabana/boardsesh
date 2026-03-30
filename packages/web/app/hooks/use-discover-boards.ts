import { useState, useEffect, useCallback, useRef } from 'react';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { SEARCH_BOARDS, type SearchBoardsQueryResponse } from '@/app/lib/graphql/operations';
import type { UserBoard } from '@boardsesh/shared-schema';

interface UseDiscoverBoardsOptions {
  /** Maximum number of boards to return */
  limit?: number;
  /** Whether to request geolocation from the browser */
  enableLocation?: boolean;
}

interface DiscoverBoardsResult {
  boards: UserBoard[];
  isLoading: boolean;
  hasLocation: boolean;
  error: string | null;
}

/**
 * Discovers public boards for the home page.
 * Fetches popular boards immediately while geolocation resolves in parallel.
 * If location is available, nearby boards appear first (sorted by distance).
 * Remaining slots are filled with popular boards (sorted by totalAscents).
 * Deduplication ensures no board appears twice.
 *
 * Re-fetches when the auth token changes (e.g. user logs in) so that
 * board results can reflect authenticated context (isFollowedByMe, etc.).
 */
export function useDiscoverBoards({
  limit = 20,
  enableLocation = true,
}: UseDiscoverBoardsOptions = {}): DiscoverBoardsResult {
  const { token, isAuthenticated } = useWsAuthToken();
  const [boards, setBoards] = useState<UserBoard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache geolocation so we don't re-prompt on token changes
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const geoResolvedRef = useRef(false);

  const resolveGeolocation = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    if (coordsRef.current) return Promise.resolve(coordsRef.current);
    if (geoResolvedRef.current) return Promise.resolve(null);

    if (!enableLocation || typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(null);
    }

    // Set after enableLocation check so toggling enableLocation from false→true can still trigger geo
    geoResolvedRef.current = true;

    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300000,
        enableHighAccuracy: false,
      });
    }).then((position) => {
      coordsRef.current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      return coordsRef.current;
    }).catch(() => null);
  }, [enableLocation]);

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      // Only show loading skeleton on initial load, not on auth-triggered refetches
      if (boards.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      const client = createGraphQLHttpClient(token ?? undefined);

      // Fire popular boards request and geolocation resolution in parallel
      const popularPromise = client
        .request<SearchBoardsQueryResponse>(SEARCH_BOARDS, {
          input: { limit: limit * 2 },
        })
        .catch(() => null);

      const geoPromise = resolveGeolocation();

      const [popularResult, coords] = await Promise.all([popularPromise, geoPromise]);

      if (cancelled) return;

      // If we have coords, fetch nearby boards
      let nearbyBoards: UserBoard[] = [];
      if (coords) {
        try {
          const nearbyResult = await client.request<SearchBoardsQueryResponse>(SEARCH_BOARDS, {
            input: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusKm: 1,
              limit,
            },
          });
          nearbyBoards = nearbyResult.searchBoards.boards;
          setHasLocation(true);
        } catch {
          // Location search failed, fall through to popular only
        }
      }

      if (cancelled) return;

      const nearbyUuids = new Set(nearbyBoards.map((b) => b.uuid));

      if (popularResult) {
        const popularBoards = popularResult.searchBoards.boards
          .filter((b: UserBoard) => !nearbyUuids.has(b.uuid))
          .sort((a: UserBoard, b: UserBoard) => b.totalAscents - a.totalAscents);
        setBoards([...nearbyBoards, ...popularBoards].slice(0, limit));
      } else if (nearbyBoards.length > 0) {
        setBoards(nearbyBoards);
      } else {
        setError('Failed to load boards');
      }

      setIsLoading(false);
    };

    doFetch();

    return () => {
      cancelled = true;
    };
    // Re-run when auth state changes so boards reflect authenticated context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated, enableLocation, resolveGeolocation, limit]);

  return { boards, isLoading, hasLocation, error };
}

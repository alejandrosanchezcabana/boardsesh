"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { FavoritesContext } from "./favorites-batch-context";
import { favoritesStore } from "./favorites-store";

type UseFavoriteOptions = {
  climbUuid: string;
};

type UseFavoriteReturn = {
  isFavorited: boolean;
  isLoading: boolean;
  toggleFavorite: () => Promise<boolean>;
  isAuthenticated: boolean;
};

const noopToggle = async () => false;

/**
 * Hook to check and toggle favorite status for a climb.
 *
 * Uses `useSyncExternalStore` for the favorited boolean so only THIS
 * component re-renders when its specific climb's status changes —
 * not every consumer in the tree.
 *
 * When rendered outside a FavoritesProvider (e.g. on the home page proposals feed),
 * returns safe defaults — favorite actions will be unavailable but won't crash.
 */
export function useFavorite({ climbUuid }: UseFavoriteOptions): UseFavoriteReturn {
  const context = useContext(FavoritesContext);

  // Per-UUID subscription — only re-renders when THIS climb's boolean flips
  const isFavorited = useSyncExternalStore(
    favoritesStore.subscribe,
    () => favoritesStore.getIsFavorited(climbUuid),
    () => false, // server snapshot
  );

  // Read loading/auth from external store — components only re-render when
  // the specific value they read changes, not when any context field changes.
  const isLoading = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getIsLoading,
    () => false,
  );

  const isAuthenticated = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getIsAuthenticated,
    () => false,
  );

  const handleToggle = useCallback(async (): Promise<boolean> => {
    if (!context) return false;
    return context.toggleFavorite(climbUuid);
  }, [context, climbUuid]);

  if (!context) {
    return {
      isFavorited: false,
      isLoading: false,
      toggleFavorite: noopToggle,
      isAuthenticated: false,
    };
  }

  return {
    isFavorited,
    isLoading,
    toggleFavorite: handleToggle,
    isAuthenticated,
  };
}

'use client';

import React, { useMemo, useLayoutEffect } from 'react';
import { createTypedContext } from '@/app/lib/create-typed-context';
import { favoritesStore } from './favorites-store';

interface FavoritesContextValue {
  toggleFavorite: (uuid: string) => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const [FavoritesCtx, useFavoritesContext] = createTypedContext<FavoritesContextValue>('Favorites');

export const FavoritesContext = FavoritesCtx;
export { useFavoritesContext };

interface FavoritesProviderProps {
  favorites: Set<string>;
  toggleFavorite: (uuid: string) => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
  children: React.ReactNode;
}

export function FavoritesProvider({
  favorites,
  toggleFavorite,
  isLoading,
  isAuthenticated,
  children,
}: FavoritesProviderProps) {
  // Sync React Query data into the external store before children render.
  // useLayoutEffect ensures the store is up-to-date in the same commit.
  useLayoutEffect(() => {
    favoritesStore.setFavorites(favorites);
  }, [favorites]);

  // Context now only carries callbacks and auth state — these references
  // are stable so the context value rarely changes, preventing cascade
  // re-renders in all consumers.
  const value = useMemo<FavoritesContextValue>(
    () => ({
      toggleFavorite,
      isLoading,
      isAuthenticated,
    }),
    [toggleFavorite, isLoading, isAuthenticated]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

// Re-export for backwards compatibility during migration
export { FavoritesContext as FavoritesBatchContext };
export { FavoritesProvider as FavoritesBatchProvider };

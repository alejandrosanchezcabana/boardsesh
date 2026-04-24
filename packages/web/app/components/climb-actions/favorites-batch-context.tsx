'use client';

import React, { useMemo, useLayoutEffect } from 'react';
import { createTypedContext } from '@/app/lib/create-typed-context';
import { favoritesStore } from './favorites-store';

type FavoritesContextValue = {
  toggleFavorite: (uuid: string) => Promise<boolean>;
};

const [FavoritesCtx, useFavoritesContext] = createTypedContext<FavoritesContextValue>('Favorites');

export const FavoritesContext = FavoritesCtx;
export { useFavoritesContext };

type FavoritesProviderProps = {
  favorites: Set<string>;
  toggleFavorite: (uuid: string) => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
  children: React.ReactNode;
};

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

  // Sync loading/auth state to the external store so consumers can read
  // via useSyncExternalStore without subscribing to this context.
  useLayoutEffect(() => {
    favoritesStore.setMeta(isLoading, isAuthenticated);
  }, [isLoading, isAuthenticated]);

  // Context only carries toggleFavorite — stable callback, so the context
  // value never changes during normal operation. isLoading/isAuthenticated
  // are read from the external store via useSyncExternalStore, avoiding
  // the "all consumers re-render" cascade when loading state flips.
  const value = useMemo<FavoritesContextValue>(() => ({ toggleFavorite }), [toggleFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

// Re-export for backwards compatibility during migration
export { FavoritesContext as FavoritesBatchContext };
export { FavoritesProvider as FavoritesBatchProvider };

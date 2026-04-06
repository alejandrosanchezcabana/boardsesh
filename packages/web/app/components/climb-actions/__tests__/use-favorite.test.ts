import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { FavoritesContext } from '../favorites-batch-context';
import { favoritesStore } from '../favorites-store';
import { useFavorite } from '../use-favorite';

// Helper to create a wrapper with FavoritesContext.Provider
function createWrapper(contextValue: React.ContextType<typeof FavoritesContext>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(FavoritesContext.Provider, { value: contextValue }, children);
  };
}

describe('useFavorite', () => {
  const mockToggleFavorite = vi.fn().mockResolvedValue(true);

  const defaultContext = {
    toggleFavorite: mockToggleFavorite,
    isLoading: false,
    isAuthenticated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleFavorite.mockResolvedValue(true);
    // Reset the store to empty before each test
    favoritesStore.setFavorites(new Set());
  });

  describe('with FavoritesProvider', () => {
    it('reads isFavorited from the external store', () => {
      favoritesStore.setFavorites(new Set(['climb-123']));

      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }), {
        wrapper: createWrapper(defaultContext),
      });

      expect(result.current.isFavorited).toBe(true);
    });

    it('calls toggleFavorite with climbUuid when toggle invoked', async () => {
      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }), {
        wrapper: createWrapper(defaultContext),
      });

      await act(async () => {
        await result.current.toggleFavorite();
      });

      expect(mockToggleFavorite).toHaveBeenCalledWith('climb-123');
    });

    it('returns isLoading from context', () => {
      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }), {
        wrapper: createWrapper(defaultContext),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('returns isAuthenticated from context', () => {
      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }), {
        wrapper: createWrapper(defaultContext),
      });

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('returns isFavorited result for the specific climb', () => {
      favoritesStore.setFavorites(new Set(['climb-123']));

      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }), {
        wrapper: createWrapper(defaultContext),
      });

      expect(result.current.isFavorited).toBe(true);
    });

    it('handles different climbUuids correctly', () => {
      favoritesStore.setFavorites(new Set(['climb-A']));

      const { result: resultA } = renderHook(() => useFavorite({ climbUuid: 'climb-A' }), {
        wrapper: createWrapper(defaultContext),
      });
      const { result: resultB } = renderHook(() => useFavorite({ climbUuid: 'climb-B' }), {
        wrapper: createWrapper(defaultContext),
      });

      expect(resultA.current.isFavorited).toBe(true);
      expect(resultB.current.isFavorited).toBe(false);
    });
  });

  describe('without FavoritesProvider', () => {
    it('returns safe defaults when no FavoritesProvider is present', () => {
      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }));

      expect(result.current.isFavorited).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('toggleFavorite returns false when no provider', async () => {
      const { result } = renderHook(() => useFavorite({ climbUuid: 'climb-123' }));

      let toggled: boolean | undefined;
      await act(async () => {
        toggled = await result.current.toggleFavorite();
      });

      expect(toggled).toBe(false);
    });

    it('does not throw when rendered without provider', () => {
      expect(() => {
        renderHook(() => useFavorite({ climbUuid: 'climb-123' }));
      }).not.toThrow();
    });
  });
});

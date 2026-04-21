/**
 * External store for favorites data, enabling per-UUID subscriptions via
 * `useSyncExternalStore`. This avoids the React Context "all consumers
 * re-render" problem — each component only re-renders when its specific
 * climb's favorited status flips.
 */
class FavoritesStore {
  private favorites: Set<string> = new Set();
  private _isLoading = false;
  private _isAuthenticated = false;
  private listeners: Set<() => void> = new Set();

  /** Subscribe to store changes (signature expected by useSyncExternalStore). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Check if a specific UUID is favorited. Returns a primitive boolean
   *  so `Object.is` comparison in useSyncExternalStore works correctly —
   *  components only re-render when their specific value flips. */
  getIsFavorited = (uuid: string): boolean => {
    return this.favorites.has(uuid);
  };

  /** Read loading state. Used via useSyncExternalStore so only components
   *  that actually read this value re-render when it changes. */
  getIsLoading = (): boolean => this._isLoading;

  /** Read auth state. Stable for the lifetime of a session. */
  getIsAuthenticated = (): boolean => this._isAuthenticated;

  /** Bulk-replace the favorites set (called when React Query data changes). */
  setFavorites(next: Set<string>): void {
    // React Query creates new Set instances on each fetch, so reference equality
    // almost never fires. Compare contents instead to avoid spurious notifications.
    if (next.size === this.favorites.size && [...next].every((id) => this.favorites.has(id)))
      return;
    this.favorites = next;
    this.notify();
  }

  /** Update loading and auth state. Only notifies if values actually changed. */
  setMeta(isLoading: boolean, isAuthenticated: boolean): void {
    if (this._isLoading === isLoading && this._isAuthenticated === isAuthenticated) return;
    this._isLoading = isLoading;
    this._isAuthenticated = isAuthenticated;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const favoritesStore = new FavoritesStore();

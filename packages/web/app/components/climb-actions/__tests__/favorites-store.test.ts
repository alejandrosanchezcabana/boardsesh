import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

// Import a fresh instance per test by re-importing the module
import { favoritesStore } from "../favorites-store";

describe("FavoritesStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    favoritesStore.setFavorites(new Set());
    favoritesStore.setMeta(false, false);
  });

  describe("getIsFavorited", () => {
    it("returns false for unknown uuid", () => {
      expect(favoritesStore.getIsFavorited("unknown")).toBe(false);
    });

    it("returns true for a uuid that is in the set", () => {
      favoritesStore.setFavorites(new Set(["abc"]));
      expect(favoritesStore.getIsFavorited("abc")).toBe(true);
    });

    it("returns false for a uuid not in the set", () => {
      favoritesStore.setFavorites(new Set(["abc"]));
      expect(favoritesStore.getIsFavorited("xyz")).toBe(false);
    });
  });

  describe("subscribe / unsubscribe (listener cleanup)", () => {
    it("calls the listener when favorites change", () => {
      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setFavorites(new Set(["climb-1"]));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not call the listener after unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = favoritesStore.subscribe(listener);

      unsubscribe();
      favoritesStore.setFavorites(new Set(["climb-1"]));

      expect(listener).not.toHaveBeenCalled();
    });

    it("returns a cleanup function that removes only the unsubscribed listener", () => {
      const listenerA = vi.fn();
      const listenerB = vi.fn();

      const unsubscribeA = favoritesStore.subscribe(listenerA);
      favoritesStore.subscribe(listenerB);

      unsubscribeA();
      favoritesStore.setFavorites(new Set(["climb-1"]));

      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalledTimes(1);
    });
  });

  describe("concurrent subscriptions (notify loop)", () => {
    it("notifies all active listeners on change", () => {
      const listeners = [vi.fn(), vi.fn(), vi.fn()];
      listeners.forEach((l) => favoritesStore.subscribe(l));

      favoritesStore.setFavorites(new Set(["climb-x"]));

      listeners.forEach((l) => expect(l).toHaveBeenCalledTimes(1));
    });

    it("notifies remaining listeners after one is removed mid-session", () => {
      const listenerA = vi.fn();
      const listenerB = vi.fn();
      const listenerC = vi.fn();

      favoritesStore.subscribe(listenerA);
      const unsubscribeB = favoritesStore.subscribe(listenerB);
      favoritesStore.subscribe(listenerC);

      unsubscribeB();
      favoritesStore.setFavorites(new Set(["climb-y"]));

      expect(listenerA).toHaveBeenCalledTimes(1);
      expect(listenerB).not.toHaveBeenCalled();
      expect(listenerC).toHaveBeenCalledTimes(1);
    });
  });

  describe("setFavorites content-based deduplication", () => {
    it("does not notify when new set has identical contents", () => {
      favoritesStore.setFavorites(new Set(["a", "b"]));

      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      // New Set instance, same contents
      favoritesStore.setFavorites(new Set(["a", "b"]));

      expect(listener).not.toHaveBeenCalled();
    });

    it("notifies when an element is added", () => {
      favoritesStore.setFavorites(new Set(["a"]));

      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setFavorites(new Set(["a", "b"]));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies when an element is removed", () => {
      favoritesStore.setFavorites(new Set(["a", "b"]));

      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setFavorites(new Set(["a"]));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies when going from empty to non-empty", () => {
      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setFavorites(new Set(["climb-1"]));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies when going from non-empty to empty", () => {
      favoritesStore.setFavorites(new Set(["climb-1"]));

      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setFavorites(new Set());

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("setMeta / getIsLoading / getIsAuthenticated", () => {
    it("getIsLoading returns false by default", () => {
      expect(favoritesStore.getIsLoading()).toBe(false);
    });

    it("getIsAuthenticated returns false by default", () => {
      expect(favoritesStore.getIsAuthenticated()).toBe(false);
    });

    it("setMeta updates isLoading", () => {
      favoritesStore.setMeta(true, false);
      expect(favoritesStore.getIsLoading()).toBe(true);
    });

    it("setMeta updates isAuthenticated", () => {
      favoritesStore.setMeta(false, true);
      expect(favoritesStore.getIsAuthenticated()).toBe(true);
    });

    it("setMeta notifies listeners when values change", () => {
      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setMeta(true, true);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("setMeta does not notify listeners when values unchanged", () => {
      favoritesStore.setMeta(false, false);

      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setMeta(false, false);

      expect(listener).not.toHaveBeenCalled();
    });

    it("setMeta and setFavorites share the same listener pool", () => {
      const listener = vi.fn();
      favoritesStore.subscribe(listener);

      favoritesStore.setMeta(true, false);
      favoritesStore.setFavorites(new Set(["climb-1"]));

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});

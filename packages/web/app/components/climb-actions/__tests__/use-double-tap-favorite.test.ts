import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";

const mockToggleFavorite = vi.fn().mockResolvedValue(true);
const mockOpenAuthModal = vi.fn();

vi.mock("../use-favorite", () => ({
  useFavorite: vi.fn(() => ({
    isFavorited: false,
    isLoading: false,
    toggleFavorite: mockToggleFavorite,
    isAuthenticated: true,
  })),
}));

vi.mock("@/app/components/providers/auth-modal-provider", () => ({
  useAuthModal: () => ({ openAuthModal: mockOpenAuthModal }),
}));

import { useDoubleTapFavorite } from "../use-double-tap-favorite";
import { useFavorite } from "../use-favorite";

const mockedUseFavorite = vi.mocked(useFavorite);

describe("useDoubleTapFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseFavorite.mockReturnValue({
      isFavorited: false,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    });
  });

  it("returns expected shape", () => {
    const { result } = renderHook(() => useDoubleTapFavorite({ climbUuid: "test-uuid" }));

    expect(result.current).toEqual(
      expect.objectContaining({
        handleDoubleTap: expect.any(Function),
        showHeart: false,
        dismissHeart: expect.any(Function),
        isFavorited: false,
        toggleFavorite: expect.any(Function),
      }),
    );
  });

  it("shows auth modal when unauthenticated", () => {
    mockedUseFavorite.mockReturnValue({
      isFavorited: false,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: false,
    });

    const { result } = renderHook(() => useDoubleTapFavorite({ climbUuid: "test-uuid" }));

    act(() => {
      result.current.handleDoubleTap();
    });

    expect(mockOpenAuthModal).toHaveBeenCalledWith({
      title: "Sign in to like climbs",
      description: "Save your favorite climbs so you can find them later.",
    });
    expect(result.current.showHeart).toBe(false);
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it("toggles favorite and shows heart when not yet favorited", () => {
    const { result } = renderHook(() => useDoubleTapFavorite({ climbUuid: "test-uuid" }));

    act(() => {
      result.current.handleDoubleTap();
    });

    expect(result.current.showHeart).toBe(true);
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("shows heart but does NOT unfavorite when already favorited", () => {
    mockedUseFavorite.mockReturnValue({
      isFavorited: true,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useDoubleTapFavorite({ climbUuid: "test-uuid" }));

    act(() => {
      result.current.handleDoubleTap();
    });

    expect(result.current.showHeart).toBe(true);
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it("dismissHeart resets showHeart to false", () => {
    const { result } = renderHook(() => useDoubleTapFavorite({ climbUuid: "test-uuid" }));

    act(() => {
      result.current.handleDoubleTap();
    });
    expect(result.current.showHeart).toBe(true);

    act(() => {
      result.current.dismissHeart();
    });
    expect(result.current.showHeart).toBe(false);
  });

  it("passes isFavorited and toggleFavorite through from useFavorite", () => {
    mockedUseFavorite.mockReturnValue({
      isFavorited: true,
      isLoading: false,
      toggleFavorite: mockToggleFavorite,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useDoubleTapFavorite({ climbUuid: "test-uuid" }));

    expect(result.current.isFavorited).toBe(true);
    expect(result.current.toggleFavorite).toBeDefined();
  });
});

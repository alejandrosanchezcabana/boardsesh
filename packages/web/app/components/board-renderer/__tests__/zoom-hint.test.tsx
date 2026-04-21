import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ZoomHint from "../zoom-hint";

// Mock IndexedDB preferences
const mockGetPreference = vi.fn();
const mockSetPreference = vi.fn();

vi.mock("@/app/lib/user-preferences-db", () => ({
  getPreference: (...args: unknown[]) => mockGetPreference(...args),
  setPreference: (...args: unknown[]) => mockSetPreference(...args),
}));

describe("ZoomHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetPreference.mockResolvedValue(null);
    mockSetPreference.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders hint when preference is not set and visible is true", async () => {
    render(<ZoomHint visible />);

    // Flush the async getPreference call
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText("Pinch to zoom")).toBeTruthy();
  });

  it("does not render when visible is false", async () => {
    render(<ZoomHint visible={false} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("Pinch to zoom")).toBeNull();
  });

  it("does not render when preference is already set", async () => {
    mockGetPreference.mockResolvedValue(true);

    render(<ZoomHint visible />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("Pinch to zoom")).toBeNull();
  });

  it("auto-dismisses after 4 seconds and saves preference", async () => {
    render(<ZoomHint visible />);

    // Flush the getPreference call to show the hint
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Pinch to zoom")).toBeTruthy();

    // Advance past the auto-dismiss timer
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Pinch to zoom")).toBeNull();
    expect(mockSetPreference).toHaveBeenCalledWith("playview:zoomHintSeen", true);
  });

  it("dismisses on click and saves preference", async () => {
    render(<ZoomHint visible />);

    await act(async () => {
      await Promise.resolve();
    });

    const overlay = screen.getByText("Pinch to zoom").parentElement?.parentElement;
    expect(overlay).toBeTruthy();

    await act(async () => {
      fireEvent.click(overlay!);
    });

    expect(screen.queryByText("Pinch to zoom")).toBeNull();
    expect(mockSetPreference).toHaveBeenCalledWith("playview:zoomHintSeen", true);
  });

  it("checks the correct preference key", async () => {
    render(<ZoomHint visible />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetPreference).toHaveBeenCalledWith("playview:zoomHintSeen");
  });
});
